import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

type Dict = Record<string, unknown>;
const dict = (input: unknown): Dict =>
  input && typeof input === "object" && !Array.isArray(input) ? input as Dict : {};
const str = (value: unknown) => String(value ?? "");

export function renderNotificationTemplate(template: string, context: Dict): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => str(context[key]));
}

export function appendApprovalNotice(body: string, notice: string): string {
  if (!notice || body.includes(notice)) return body;
  const html = '<div style="margin-top:16px;padding:12px 14px;border-radius:12px;background:#eef9f4;color:#0b6f50;font-size:14px;line-height:1.6;font-weight:700;">' + notice + "</div>";
  return body.includes("</body>") ? body.replace("</body>", html + "</body>") : body + "\n\n" + notice;
}

@Injectable()
export class ApprovalNotificationsService {
  constructor(private readonly database: DatabaseService) {}

  private setting(tenantId: number, name: string): Dict {
    const db = this.database.db;
    const tenant = db.prepare("SELECT value FROM tenant_settings WHERE tenant_id=? AND key=?")
      .get(tenantId, name) as {value:string}|undefined;
    const global = tenant ?? db.prepare("SELECT value FROM system_settings WHERE key=?")
      .get(name) as {value:string}|undefined;
    if (!global) return {};
    try { return dict(JSON.parse(global.value)); } catch { return {}; }
  }

  /**
   * Called from the registration transaction, without sending HTTP requests.
   * Throws if templates have not yet been configured, preventing silent loss of notifications.
   */
  queue(tenantId: number, requestId: number, status: string): void {
    const db = this.database.db;
    const row = db.prepare(`SELECT rr.*, u.name AS seller_name, u.email AS seller_email,
      COALESCE(NULLIF(u.communication_email, ''),u.email) AS seller_contact_email,
      u.whatsapp_phone AS seller_whatsapp_phone
      FROM registration_requests rr
      JOIN users u ON u.id=rr.seller_id AND u.tenant_id=rr.tenant_id
      WHERE rr.id=? AND rr.tenant_id=?`).get(requestId,tenantId) as Dict|undefined;
    if (!row) throw new Error("Solicitacao nao encontrada para notificacao.");
    const templates = this.setting(tenantId,"message_templates");
    const email = dict(dict(templates.email).customer_approved);
    if (!str(email.subject).trim() || !str(email.body).trim()) {
      throw new Error("Template de aprovacao nao configurado; usar processamento legado.");
    }
    const whatsapp = this.setting(tenantId,"whatsapp");
    const context: Dict = {
      solicitacao_id: str(row.id), logo_email: "", cliente: row.trade_name || row.legal_name,
      cliente_email: row.email || "", empresa: "", vendedor: row.seller_name,
      vendedor_email: row.seller_contact_email || row.seller_email,
      vendedor_whatsapp: row.seller_whatsapp_phone || "", cnpj: row.cnpj,
      status, status_label: "Aprovada", observacoes: row.notes || "",
      apto_novos_pedidos: "O cliente esta apto para emitir novos pedidos, pois esta vinculado a base.",
      data: new Date().toISOString(),
    };
    const insert = db.prepare(`INSERT INTO email_outbox
      (tenant_id,kind,recipients,subject,body,created_at) VALUES (?,?,?,?,?,?)`);
    insert.run(tenantId,"customer_status_email","vendas@hipermixrepresentacoes.com.br",
      renderNotificationTemplate(str(email.subject),context),
      appendApprovalNotice(renderNotificationTemplate(str(email.body),context),str(context.apto_novos_pedidos)),
      new Date().toISOString());
    if (whatsapp.enabled) {
      const template = dict(dict(templates.whatsapp).customer_approved);
      if (!str(template.subject).trim() || !str(template.body).trim())
        throw new Error("Template WhatsApp de aprovacao nao configurado; usar processamento legado.");
      const target = str(context.vendedor_whatsapp || whatsapp.alert_phone || whatsapp.instance_id || whatsapp.connection_name || "whatsapp");
      insert.run(tenantId,"customer_status_whatsapp","whatsapp:"+target,
        renderNotificationTemplate(str(template.subject),context),
        renderNotificationTemplate(str(template.body),context),new Date().toISOString());
    }
  }
}
