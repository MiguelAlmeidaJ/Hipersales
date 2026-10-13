import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { DatabaseRepository } from "../database/database.repository.js";
import { EnvService } from "../config/env.service.js";
import { GoalsService } from "../goals/goals.service.js";
import { SettingsService } from "../settings/settings.service.js";

type Row = Record<string, unknown>;
const REMINDER_DAYS = new Set([10, 15, 20, 25, 27, 28, 29, 30]);

@Injectable()
export class ScheduledJobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly database: DatabaseRepository, private readonly env: EnvService,
    private readonly goals: GoalsService, private readonly settings: SettingsService) {}
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === "test" || process.env.HIPERSALES_SCHEDULED_JOBS === "false") return;
    this.timer = setInterval(() => void this.run(), 3_600_000); this.timer.unref(); void this.run();
  }
  onApplicationShutdown(): void { if (this.timer) clearInterval(this.timer); }
  async run(now = new Date()): Promise<{weekly:number;reminders:number}> {
    if (this.running) return {weekly:0,reminders:0}; this.running = true;
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:this.env.reportTimezone,
        weekday:"short",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now)
        .filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
      const tenants=await this.database.db.prepare("SELECT id FROM tenants WHERE status='active'").all() as Row[];
      let weekly=0,reminders=0;
      for(const tenant of tenants){const id=Number(tenant.id); if(parts.weekday==="Fri") weekly+=await this.weekly(id,now);
        if(REMINDER_DAYS.has(Number(parts.day))) reminders+=await this.reminders(id,Number(parts.year),Number(parts.month),Number(parts.day));}
      return {weekly,reminders};
    } finally { this.running=false; }
  }
  private async enqueue(tenant:number,kind:string,to:string,subject:string,body:string){await this.database.db.prepare(
    "INSERT INTO email_outbox (tenant_id,kind,recipients,subject,body,created_at) VALUES (?,?,?,?,?,?)")
    .run(tenant,kind,to,subject,body,new Date().toISOString());}
  private async weekly(tenant:number,now:Date):Promise<number>{
    const key=now.toISOString().slice(0,10); const existing=await this.database.db.prepare(
      "SELECT value FROM tenant_settings WHERE tenant_id=? AND [key]='weekly_reports_last_week'").get(tenant) as {value:string}|undefined;
    if(existing?.value===JSON.stringify(key)) return 0;
    const total=await this.database.db.prepare(`SELECT COUNT(DISTINCT p.id) orders,COALESCE(SUM(pi.quantity*pi.negotiated_price),0) revenue
      FROM proposals p LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE p.tenant_id=? AND p.created_at>=DATEADD(day,-7,SYSUTCDATETIME())`).get(tenant) as Row;
    const admins=await this.database.db.prepare(`SELECT COALESCE(NULLIF(communication_email,''),email) recipient FROM users
      WHERE tenant_id=? AND role='admin' AND active=1`).all(tenant) as Row[];
    for(const admin of admins) if(admin.recipient) await this.enqueue(tenant,"weekly_manager_report",String(admin.recipient),"Relatorio semanal gerencial",
      `Pedidos nos ultimos 7 dias: ${total.orders||0}\nFaturamento: ${Number(total.revenue||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`);
    const value=JSON.stringify(key),updatedAt=new Date().toISOString();
    const updated=await this.database.db.prepare("UPDATE tenant_settings SET value=?,updated_at=? WHERE tenant_id=? AND [key]=?")
      .run(value,updatedAt,tenant,"weekly_reports_last_week");
    if(!updated.changes) await this.database.db.prepare("INSERT INTO tenant_settings (tenant_id,[key],value,updated_at) VALUES (?,?,?,?)")
      .run(tenant,"weekly_reports_last_week",value,updatedAt); return admins.length;
  }
  private async reminders(tenant:number,year:number,month:number,day:number):Promise<number>{
    const sellers=await this.database.db.prepare(`SELECT id,name,email,communication_email,whatsapp_phone FROM users
      WHERE tenant_id=? AND role='seller' AND active=1`).all(tenant) as Row[];
    const whatsapp=await this.settings.read(tenant,"whatsapp") as Row; let sent=0;
    for(const seller of sellers){const p=await this.goals.performance(tenant,Number(seller.id),year,month); if(!p.has_goals) continue;
      const alreadySent=await this.database.db.prepare(`SELECT 1 FROM seller_goal_reminders
        WHERE tenant_id=? AND seller_id=? AND year=? AND month=? AND day=?`).get(tenant,Number(seller.id),year,month,day);
      if(alreadySent) continue;
      const claim=await this.database.db.prepare(`INSERT INTO seller_goal_reminders
        (tenant_id,seller_id,year,month,day,sent_at) VALUES (?,?,?,?,?,?)`).run(tenant,Number(seller.id),year,month,day,new Date().toISOString());
      if(!claim.changes) continue; const body=[`Meta comercial ${month}/${year} - ${seller.name}`,
        `Vendas: ${p.sales.realized} de ${p.sales.goal??"sem meta"}`,`Novos clientes: ${p.new_customers.realized} de ${p.new_customers.goal??"sem meta"}`,
        `Positivacao: ${p.customer_positivation.realized.toFixed(2)}% de ${p.customer_positivation.goal??"sem meta"}%`].join("\n");
      const email=String(seller.communication_email||seller.email||""); if(email)await this.enqueue(tenant,"goal_reminder_email",email,`Meta comercial ${month}/${year}`,body);
      if(whatsapp.enabled&&whatsapp.connected&&seller.whatsapp_phone)await this.enqueue(tenant,"goal_reminder_whatsapp",`whatsapp:${seller.whatsapp_phone}`,`Meta comercial ${month}/${year}`,body); sent++;}
    return sent;
  }
}
