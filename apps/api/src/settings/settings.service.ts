import { BadRequestException, Injectable } from "@nestjs/common";
import type { PublicUser, SettingsSection, UpdateSettingsRequest } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { DEFAULT_SETTINGS, PLACEHOLDERS, STATUS_LABELS } from "./settings.constants.js";

type JsonObject = Record<string, unknown>;
const COLOR = /^#[0-9A-F]{6}$/;

function object(value: unknown, message: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(message);
  return value as JsonObject;
}

function text(value: unknown, maximum = 255): string {
  return String(value ?? "").trim().slice(0, maximum);
}

function boolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "sim"].includes(String(value).toLowerCase());
}

@Injectable()
export class SettingsService {
  constructor(private readonly database: DatabaseService) {}

  read(tenantId: number, key: SettingsSection): unknown {
    const tenant = this.database.db.prepare("SELECT value FROM tenant_settings WHERE tenant_id=? AND key=?")
      .get(tenantId, key) as { value: string } | undefined;
    const system = tenant ? undefined : this.database.db.prepare("SELECT value FROM system_settings WHERE key=?")
      .get(key) as { value: string } | undefined;
    try { return JSON.parse(tenant?.value ?? system?.value ?? JSON.stringify(DEFAULT_SETTINGS[key])); }
    catch { return structuredClone(DEFAULT_SETTINGS[key]); }
  }

  write(tenantId: number, key: SettingsSection, value: unknown): void {
    this.database.db.prepare(`INSERT INTO tenant_settings (tenant_id,key,value,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(tenant_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
      .run(tenantId, key, JSON.stringify(value), new Date().toISOString());
  }

  get(user: PublicUser) {
    const settings = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) =>
      [key, this.read(user.tenant_id, key as SettingsSection)])) as JsonObject;
    const smtp = object(settings.smtp, "Configuracao SMTP invalida.");
    settings.smtp = { ...smtp, password_configured: Boolean(smtp.password), password: "" };
    const whatsapp = object(settings.whatsapp, "Configuracao WhatsApp invalida.");
    settings.whatsapp = {
      ...whatsapp,
      status_label: whatsapp.connected ? "Conectado" : "Aguardando QR",
    };
    return { settings, placeholders: PLACEHOLDERS, status_labels: STATUS_LABELS };
  }

  save(user: PublicUser, input: UpdateSettingsRequest) {
    const normalized = this.normalize(user.tenant_id, input.section, input.data);
    this.database.transaction(() => this.write(user.tenant_id, input.section, normalized));
    return { message: "Configuracao salva.", ...this.get(user) };
  }

  smtpConfiguration(tenantId: number, override?: unknown): JsonObject {
    return this.normalize(tenantId, "smtp", override ?? this.read(tenantId, "smtp")) as JsonObject;
  }

  private normalize(tenantId: number, section: SettingsSection, value: unknown): unknown {
    if (section === "customer_funnel" || section === "product_funnel") {
      if (!Array.isArray(value)) throw new BadRequestException("Etapas invalidas.");
      const stages = value.slice(0, 50).map((item) => object(item, "Etapa invalida.")).map((item) => {
        const name = text(item.name, 80);
        const color = text(item.color || "#0D6FD8", 7).toUpperCase();
        if (!name || !COLOR.test(color)) throw new BadRequestException("Etapa ou cor invalida.");
        return { name, color };
      });
      if (!stages.length) throw new BadRequestException("Inclua ao menos uma etapa valida.");
      return stages;
    }
    if (section === "order_statuses") {
      if (!Array.isArray(value)) throw new BadRequestException("Status invalidos.");
      const colors = new Map(value.map((item) => {
        const row = object(item, "Status invalido.");
        return [text(row.key, 40), text(row.color, 7).toUpperCase()];
      }));
      return Object.entries(STATUS_LABELS).map(([key, name]) => {
        const color = colors.get(key) ?? "#0D6FD8";
        if (!COLOR.test(color)) throw new BadRequestException("Cor invalida. Use o formato #RRGGBB.");
        return { key, name, color };
      });
    }
    if (section === "smtp") {
      const row = object(value, "Configuracao SMTP invalida.");
      const current = object(this.read(tenantId, "smtp"), "Configuracao SMTP invalida.");
      const port = Number(row.port ?? 587);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new BadRequestException("Porta SMTP invalida.");
      return {
        host: text(row.host), port, username: text(row.username),
        password: String(row.password || current.password || "").slice(0, 1024),
        from_name: text(row.from_name || "Hipersales"), from_email: text(row.from_email),
        use_tls: boolean(row.use_tls, true), use_ssl: boolean(row.use_ssl),
      };
    }
    if (section === "whatsapp") {
      const row = object(value, "Configuracao WhatsApp invalida.");
      const current = object(this.read(tenantId, "whatsapp"), "Configuracao WhatsApp invalida.");
      return {
        ...current,
        enabled: boolean(row.enabled, Boolean(current.enabled)), connection_name: text(row.connection_name || current.connection_name),
        alert_phone: text(row.alert_phone || current.alert_phone, 30), instance_id: text(row.instance_id || current.instance_id, 120),
        unavailable_reply_enabled: boolean(row.unavailable_reply_enabled, Boolean(current.unavailable_reply_enabled)),
        unavailable_reply_message: text(row.unavailable_reply_message || current.unavailable_reply_message, 2000), provider: "evolution",
      };
    }
    const row = object(value, "Modelos de mensagem invalidos.");
    const result: JsonObject = {};
    for (const channel of ["email", "whatsapp"] as const) {
      const source = object(row[channel], "Modelos de mensagem invalidos.");
      result[channel] = Object.fromEntries(["order_status_changed", "customer_approved"].map((key) => {
        const template = object(source[key], "Modelo de mensagem invalido.");
        const body = text(template.body, 500_000);
        if (!body) throw new BadRequestException("Preencha o corpo do modelo de mensagem.");
        return [key, { subject: text(template.subject, 240), body }];
      }));
    }
    return result;
  }
}
