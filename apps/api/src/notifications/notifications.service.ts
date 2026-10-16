import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseRepository, type ClaimedPushNotification } from "../database/database.repository.js";
import { EnvService } from "../config/env.service.js";

type NotificationInput = {
  kind: string;
  title: string;
  body: string;
  route?: string;
  data?: Record<string, unknown>;
};
type ExpoTicket = { status?: string; id?: string; message?: string; details?: { error?: string } };

const expoTokenPattern = /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(private readonly database: DatabaseRepository, private readonly env: EnvService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processPushQueue(), 15_000);
    this.timer.unref();
    setTimeout(() => void this.processPushQueue(), 2_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async registerToken(user: PublicUser, input: Record<string, unknown>) {
    const token = String(input.token ?? "").trim();
    const platform = String(input.platform ?? "").trim().toLowerCase();
    const deviceName = String(input.device_name ?? "").trim().slice(0, 191) || null;
    if (!expoTokenPattern.test(token)) throw new BadRequestException("Token de notificacao invalido.");
    if (!["android", "ios"].includes(platform)) throw new BadRequestException("Plataforma invalida.");
    const now = new Date().toISOString();
    await this.database.transaction(async () => {
      const existing = await this.database.db.prepare("SELECT id FROM push_tokens WHERE token=?").get(token) as {id:number}|undefined;
      if (existing) {
        await this.database.db.prepare(`UPDATE push_tokens SET tenant_id=?,user_id=?,platform=?,device_name=?,active=1,last_seen_at=? WHERE id=?`)
          .run(user.tenant_id,user.id,platform,deviceName,now,existing.id);
      } else {
        await this.database.db.prepare(`INSERT INTO push_tokens
          (tenant_id,user_id,token,platform,device_name,active,last_seen_at,created_at) VALUES (?,?,?,?,?,1,?,?)`)
          .run(user.tenant_id,user.id,token,platform,deviceName,now,now);
      }
    });
    return { ok: true };
  }

  async unregisterToken(user: PublicUser, token: unknown) {
    const value = String(token ?? "").trim();
    if (value) await this.database.db.prepare("UPDATE push_tokens SET active=0 WHERE token=? AND user_id=? AND tenant_id=?")
      .run(value,user.id,user.tenant_id);
    return { ok: true };
  }

  async list(user: PublicUser) {
    const rows = await this.database.db.prepare(`SELECT TOP (50) id,kind,title,body,route,data,read_at,created_at
      FROM notifications WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC,id DESC`)
      .all(user.tenant_id,user.id);
    const unread = await this.unreadCount(user);
    return { notifications: rows.map(row => ({...row,data:this.parseData(row.data)})), unread_count: unread.unread_count };
  }

  async unreadCount(user: PublicUser) {
    const row = await this.database.db.prepare("SELECT COUNT_BIG(*) AS total FROM notifications WHERE tenant_id=? AND user_id=? AND read_at IS NULL")
      .get(user.tenant_id,user.id) as {total:number}|undefined;
    return { unread_count: Number(row?.total ?? 0) };
  }

  async markRead(user: PublicUser, id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException("Notificacao invalida.");
    await this.database.db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND tenant_id=? AND user_id=?")
      .run(new Date().toISOString(),id,user.tenant_id,user.id);
    return this.unreadCount(user);
  }

  async markAllRead(user: PublicUser) {
    await this.database.db.prepare("UPDATE notifications SET read_at=? WHERE tenant_id=? AND user_id=? AND read_at IS NULL")
      .run(new Date().toISOString(),user.tenant_id,user.id);
    return { unread_count: 0 };
  }

  async notifyUser(tenantId: number, userId: number, input: NotificationInput) {
    await this.database.db.prepare(`INSERT INTO notifications
      (tenant_id,user_id,kind,title,body,route,data,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(tenantId,userId,input.kind.slice(0,50),input.title.slice(0,191),input.body,
        input.route ?? null,input.data ? JSON.stringify(input.data) : null,new Date().toISOString());
  }

  async notifyAdmins(tenantId: number, input: NotificationInput, exceptUserId?: number) {
    const admins = await this.database.db.prepare(`SELECT id FROM users
      WHERE tenant_id=? AND active=1 AND role IN ('admin','dev')`).all(tenantId) as {id:number}[];
    for (const admin of admins) if (admin.id !== exceptUserId) await this.notifyUser(tenantId,admin.id,input);
  }

  private parseData(value: unknown): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(String(value ?? "{}"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string,unknown> : {};
    } catch { return {}; }
  }

  private async processPushQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      const notifications = await this.database.claimPushNotifications();
      for (const notification of notifications) await this.sendPush(notification);
    } catch (cause) {
      this.logger.error("Falha ao processar fila de push.", cause instanceof Error ? cause.stack : String(cause));
    } finally { this.processing = false; }
  }

  private async sendPush(notification: ClaimedPushNotification) {
    try {
      const tokens = await this.database.db.prepare("SELECT id,token FROM push_tokens WHERE user_id=? AND active=1")
        .all(notification.user_id) as {id:number;token:string}[];
      if (!tokens.length) {
        await this.complete(notification.id, "Sem dispositivo habilitado; aviso mantido na central.");
        return;
      }
      const data = {...this.parseData(notification.data),notificationId:notification.id,route:notification.route ?? undefined};
      const messages = tokens.map(row => ({to:row.token,sound:"default",channelId:"default",title:notification.title,body:notification.body,data}));
      const headers:Record<string,string>={Accept:"application/json","Content-Type":"application/json"};
      if(this.env.expoPushAccessToken) headers.Authorization=`Bearer ${this.env.expoPushAccessToken}`;
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method:"POST",headers,body:JSON.stringify(messages),
        signal:AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Expo Push respondeu HTTP ${response.status}.`);
      const payload = await response.json() as {data?: ExpoTicket[]};
      const tickets = Array.isArray(payload.data) ? payload.data : [];
      for (let index=0;index<tickets.length;index++) {
        const ticket=tickets[index];
        if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          await this.database.db.prepare("UPDATE push_tokens SET active=0 WHERE id=?").run(tokens[index]?.id);
        }
      }
      await this.complete(notification.id, null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0,1000) : "Falha desconhecida no push.";
      await this.database.db.prepare("UPDATE notifications SET push_claimed_until=NULL,push_error=? WHERE id=?")
        .run(message,notification.id);
    }
  }

  private async complete(id: number, note: string | null) {
    await this.database.db.prepare("UPDATE notifications SET push_sent_at=?,push_claimed_until=NULL,push_error=? WHERE id=?")
      .run(new Date().toISOString(),note,id);
  }
}
