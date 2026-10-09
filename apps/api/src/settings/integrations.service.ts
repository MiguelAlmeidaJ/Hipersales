import { BadGatewayException, BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { DatabaseService } from "../database/database.service.js";
import { EnvService } from "../config/env.service.js";
import { SettingsService } from "./settings.service.js";

type Row = Record<string, unknown>;

function bool(value: unknown): boolean {
  return typeof value === "boolean" ? value : ["1", "true", "yes", "on", "sim"].includes(String(value ?? "").toLowerCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly database: DatabaseService, private readonly env: EnvService, private readonly settings: SettingsService) {}

  verifyInternalToken(provided: string): void {
    const expected = this.env.whatsappInternalToken;
    if (!expected || !provided) throw new ForbiddenException("Token interno invalido.");
    const left = createHash("sha256").update(expected).digest();
    const right = createHash("sha256").update(provided).digest();
    if (!timingSafeEqual(left, right)) throw new ForbiddenException("Token interno invalido.");
  }

  private smtpTransport(tenantId: number, override?: unknown) {
    const smtp = this.settings.smtpConfiguration(tenantId, override);
    if (!smtp.host) throw new BadRequestException("Informe o servidor SMTP para testar a conexao.");
    return nodemailer.createTransport({
      host: String(smtp.host), port: Number(smtp.port), secure: Boolean(smtp.use_ssl),
      ignoreTLS: !Boolean(smtp.use_tls) && !Boolean(smtp.use_ssl),
      requireTLS: Boolean(smtp.use_tls) && !Boolean(smtp.use_ssl),
      auth: smtp.username ? { user: String(smtp.username), pass: String(smtp.password ?? "") } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
    });
  }

  async testSmtp(user: PublicUser, input?: unknown) {
    const transport = this.smtpTransport(user.tenant_id, input);
    try { await transport.verify(); }
    catch (error) { throw new BadGatewayException(`Falha ao testar SMTP: ${errorMessage(error)}`); }
    finally { transport.close(); }
    return { message: "Conexao SMTP validada com sucesso." };
  }

  async sendEmail(tenantId: number, message: { recipients: string; subject: string; body: string }): Promise<void> {
    const smtp = this.settings.smtpConfiguration(tenantId);
    const transport = this.smtpTransport(tenantId);
    try {
      await transport.sendMail({
        from: { name: String(smtp.from_name || "Hipersales"), address: String(smtp.from_email || smtp.username || "") },
        to: message.recipients.split(/[;,]/).map((recipient) => recipient.trim()).filter(Boolean),
        subject: message.subject.slice(0, 998),
        ...(/<(?:html|body|table|div|p)\b/i.test(message.body) ? { html: message.body } : { text: message.body }),
      });
    } finally { transport.close(); }
  }

  private async evolution(method: string, path: string, payload?: unknown, tolerate = false): Promise<Row> {
    if (!this.env.evolutionApiKey) throw new BadGatewayException("Evolution API sem chave configurada.");
    try {
      const response = await fetch(new URL(path, this.env.evolutionApiUrl), {
        method, headers: { accept: "application/json", "content-type": "application/json", apikey: this.env.evolutionApiKey },
        body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(45_000),
      });
      const body = await response.text();
      const parsed = body ? JSON.parse(body) as Row : {};
      if (!response.ok && !(tolerate && response.status === 404)) throw new Error(body || `HTTP ${response.status}`);
      return parsed;
    } catch (error) {
      if (tolerate) return { error: true, message: errorMessage(error) };
      throw new BadGatewayException(`Falha Evolution API: ${errorMessage(error)}`);
    }
  }

  private instance(tenantId: number): string { return `hipersales-tenant-${tenantId}`; }

  private async configureWebhook(tenantId: number, instance: string): Promise<Row> {
    const token = encodeURIComponent(this.env.whatsappInternalToken);
    return this.evolution("POST", `/webhook/set/${encodeURIComponent(instance)}`, { webhook: {
      enabled: true, url: `${this.env.publicUrl.origin}/api/evolution/webhook?token=${token}`,
      webhook_by_events: false, webhook_base64: false, events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
    }}, true);
  }

  async connect(user: PublicUser, input: unknown) {
    this.settings.save(user, { section: "whatsapp", data: input });
    const current = this.settings.read(user.tenant_id, "whatsapp") as Row;
    const instance = this.instance(user.tenant_id);
    const old = String(current.instance_id ?? "");
    if (old && old !== instance) await this.evolution("DELETE", `/instance/delete/${encodeURIComponent(old)}`, undefined, true);
    await this.evolution("DELETE", `/instance/delete/${encodeURIComponent(instance)}`, undefined, true);
    const created = await this.evolution("POST", "/instance/create", { instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" });
    let qrcode = (created.qrcode && typeof created.qrcode === "object" ? created.qrcode : {}) as Row;
    if (!qrcode.base64 && !qrcode.code) {
      const connected = await this.evolution("GET", `/instance/connect/${encodeURIComponent(instance)}`);
      qrcode = (connected.qrcode && typeof connected.qrcode === "object" ? connected.qrcode : connected) as Row;
    }
    const webhook = await this.configureWebhook(user.tenant_id, instance);
    const value = { ...current, enabled: true, provider: "evolution", connected: false, instance_id: instance,
      qr_payload: String(qrcode.code ?? ""), qr_image_url: String(qrcode.base64 ?? ""),
      qr_token: randomBytes(24).toString("base64url"), last_qr_at: new Date().toISOString(), connected_at: null,
      last_error: webhook.error ? String(webhook.message ?? "Falha ao configurar webhook do WhatsApp.") : "" };
    this.settings.write(user.tenant_id, "whatsapp", value);
    return { message: "QR gerado pelo Evolution. Escaneie pelo WhatsApp.", whatsapp: { ...value, status_label: "Aguardando QR" } };
  }

  async disconnect(user: PublicUser) {
    const current = this.settings.read(user.tenant_id, "whatsapp") as Row;
    const instance = String(current.instance_id || this.instance(user.tenant_id));
    await this.evolution("DELETE", `/instance/logout/${encodeURIComponent(instance)}`, undefined, true);
    await this.evolution("DELETE", `/instance/delete/${encodeURIComponent(instance)}`, undefined, true);
    this.settings.write(user.tenant_id, "whatsapp", { ...current, enabled: false, connected: false, qr_payload: "",
      qr_image_url: "", qr_token: "", last_qr_at: null, last_error: "", connected_at: null });
    return { message: "Conexao WhatsApp desconectada.", ...this.settings.get(user) };
  }

  async refresh(user: PublicUser): Promise<void> {
    const current = this.settings.read(user.tenant_id, "whatsapp") as Row;
    if (!current.enabled || !this.env.evolutionApiKey) return;
    const instance = String(current.instance_id || this.instance(user.tenant_id));
    const result = await this.evolution("GET", `/instance/connectionState/${encodeURIComponent(instance)}`, undefined, true);
    const state = String((result.instance as Row | undefined)?.state ?? "").toLowerCase();
    if (state === "open") this.settings.write(user.tenant_id, "whatsapp", { ...current, connected: true,
      connected_at: current.connected_at || new Date().toISOString(), qr_payload: "", qr_image_url: "", last_error: "" });
    else if (["connecting", "close", "closed"].includes(state)) this.settings.write(user.tenant_id, "whatsapp", { ...current, connected: false });
  }

  internalSettings(tenantId: number) { return { whatsapp: this.settings.read(tenantId, "whatsapp") }; }

  updateInternalState(tenantId: number, input: Row) {
    const current = this.settings.read(tenantId, "whatsapp") as Row;
    const connected = input.connected === undefined ? current.connected : bool(input.connected);
    const value = { ...current,
      enabled: input.enabled === undefined ? current.enabled : bool(input.enabled), connected,
      connected_at: connected ? (current.connected_at || new Date().toISOString()) : null,
      qr_payload: connected ? "" : input.qr_payload === undefined ? current.qr_payload : String(input.qr_payload ?? "").trim(),
      last_error: connected ? "" : input.last_error === undefined ? current.last_error : String(input.last_error ?? "").trim(),
      instance_id: input.instance_id === undefined ? current.instance_id : String(input.instance_id ?? "").trim(),
    };
    this.settings.write(tenantId, "whatsapp", value);
    return { ok: true };
  }

  pendingMessages() {
    const rows = this.database.db.prepare(`SELECT id,tenant_id,kind,recipients,subject,body,attempts,created_at FROM email_outbox
      WHERE recipients LIKE 'whatsapp:%' AND sent_at IS NULL AND COALESCE(attempts,0)<5 ORDER BY id LIMIT 10`).all() as Row[];
    return { messages: rows.flatMap((row) => {
      let phone = String(row.recipients ?? "").replace(/^whatsapp:/, "").replace(/\D/g, "");
      if (phone && !phone.startsWith("55") && phone.length >= 10 && phone.length <= 11) phone = `55${phone}`;
      if (!phone) { this.database.db.prepare("UPDATE email_outbox SET attempts=attempts+1,error=? WHERE id=?").run("Numero de WhatsApp vazio ou invalido.", Number(row.id)); return []; }
      return [{ ...row, phone }];
    }) };
  }

  updateOutbox(id: number, input: Row) {
    if (bool(input.sent)) this.database.db.prepare("UPDATE email_outbox SET sent_at=?,error=NULL WHERE id=?").run(new Date().toISOString(), id);
    else this.database.db.prepare("UPDATE email_outbox SET attempts=attempts+1,error=? WHERE id=?").run(String(input.error || "Falha ao enviar WhatsApp."), id);
    return { ok: true };
  }

  async webhook(input: Row) {
    const instance = String(input.instance || input.instanceName || "");
    const tenantId = Number(/hipersales-tenant-(\d+)/.exec(instance)?.[1] || 1);
    const whatsapp = this.settings.read(tenantId, "whatsapp") as Row;
    if (!whatsapp.enabled || !whatsapp.unavailable_reply_enabled) return { ok: true, ignored: "auto_reply_disabled" };
    const raw = Array.isArray(input.data) ? input.data : [input.data];
    let sent = 0;
    for (const item of raw) if (await this.reply(tenantId, whatsapp, instance, item)) sent++;
    return { ok: true, sent };
  }

  private async reply(tenantId: number, whatsapp: Row, instance: string, raw: unknown): Promise<boolean> {
    if (!raw || typeof raw !== "object") return false;
    const message = raw as Row; const key = (message.key && typeof message.key === "object" ? message.key : {}) as Row;
    if (bool(key.fromMe)) return false;
    const remote = String(key.remoteJid || message.remoteJid || message.chatId || "");
    const id = String(key.id || message.id || "");
    if (!remote || !id || remote.includes("@g.us") || remote === "status@broadcast") return false;
    if (this.database.db.prepare("SELECT 1 FROM whatsapp_auto_replies WHERE tenant_id=? AND instance_id=? AND message_id=?").get(tenantId, instance, id)) return false;
    const result = await this.evolution("POST", `/message/sendText/${encodeURIComponent(instance)}`,
      { number: remote, text: String(whatsapp.unavailable_reply_message || "") }, true);
    if (result.error) return false;
    this.database.db.prepare(`INSERT OR IGNORE INTO whatsapp_auto_replies
      (tenant_id,instance_id,message_id,remote_jid,replied_at) VALUES (?,?,?,?,?)`)
      .run(tenantId, instance, id, remote, new Date().toISOString());
    return true;
  }
}
