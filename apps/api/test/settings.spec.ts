import { BadRequestException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import { SettingsService } from "../src/settings/settings.service.js";

const admin = { id: 1, tenant_id: 1, role: "admin" } as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE tenant_settings (tenant_id INTEGER, key TEXT, value TEXT, updated_at TEXT,
    UNIQUE(tenant_id,key)); CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);`);
  const database = {
    db,
    transaction: <T>(callback: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try { const result = callback(); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  return { db, service: new SettingsService(database) };
}

describe("settings service", () => {
  it("stores settings per tenant and never returns the SMTP secret", () => {
    const { db, service } = fixture();
    service.save(admin, { section: "smtp", data: {
      host: "smtp.example.com", port: 587, username: "mailer", password: "secret",
      from_name: "HiperSales", from_email: "sales@example.com", use_tls: true, use_ssl: false,
    }});
    const response = service.get(admin);
    expect(response.settings.smtp).toMatchObject({ host: "smtp.example.com", password: "", password_configured: true });
    service.save(admin, { section: "smtp", data: { ...response.settings.smtp, port: 465, use_ssl: true } });
    const stored = JSON.parse((db.prepare("SELECT value FROM tenant_settings WHERE tenant_id=1 AND key='smtp'").get() as {value:string}).value);
    expect(stored.password).toBe("secret");
    db.close();
  });

  it("prevents a tenant from changing another tenant's settings", () => {
    const { db, service } = fixture();
    service.save(admin, { section: "customer_funnel", data: [{ name: "Novo", color: "#123456" }] });
    service.save({ ...admin, tenant_id: 2 }, { section: "customer_funnel", data: [{ name: "Outro", color: "#654321" }] });
    expect(service.get(admin).settings.customer_funnel).toEqual([{ name: "Novo", color: "#123456" }]);
    expect(service.get({ ...admin, tenant_id: 2 }).settings.customer_funnel).toEqual([{ name: "Outro", color: "#654321" }]);
    db.close();
  });

  it("rejects invalid ports, colors and empty templates", () => {
    const { db, service } = fixture();
    expect(() => service.save(admin, { section: "smtp", data: { port: 70_000 } })).toThrow(BadRequestException);
    expect(() => service.save(admin, { section: "customer_funnel", data: [{ name: "X", color: "red" }] })).toThrow(BadRequestException);
    expect(() => service.save(admin, { section: "message_templates", data: {
      email: { order_status_changed: { body: "" }, customer_approved: { body: "ok" } },
      whatsapp: { order_status_changed: { body: "ok" }, customer_approved: { body: "ok" } },
    }})).toThrow(BadRequestException);
    db.close();
  });

  it("does not let the admin overwrite runtime WhatsApp state", () => {
    const { db, service } = fixture();
    db.prepare("INSERT INTO tenant_settings VALUES (1,'whatsapp',?,?)").run(JSON.stringify({
      enabled: true, connected: true, instance_id: "trusted", qr_token: "server-secret",
      unavailable_reply_enabled: false, unavailable_reply_message: "Mensagem", connection_name: "Conexao",
    }), new Date().toISOString());
    service.save(admin, { section: "whatsapp", data: { connected: false, qr_token: "attacker", alert_phone: "5532999999999" } });
    expect(service.get(admin).settings.whatsapp).toMatchObject({ connected: true, qr_token: "server-secret", alert_phone: "5532999999999" });
    db.close();
  });
});
