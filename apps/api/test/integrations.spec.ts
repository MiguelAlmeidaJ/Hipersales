import { ForbiddenException } from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { EnvService } from "../src/config/env.service.js";
import { IntegrationsService } from "../src/settings/integrations.service.js";
import { SettingsService } from "../src/settings/settings.service.js";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE tenant_settings (tenant_id INTEGER,key TEXT,value TEXT,updated_at TEXT,UNIQUE(tenant_id,key));
    CREATE TABLE system_settings (key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
    CREATE TABLE email_outbox (id INTEGER PRIMARY KEY,tenant_id INTEGER,kind TEXT,recipients TEXT,subject TEXT,
      body TEXT,attempts INTEGER DEFAULT 0,created_at TEXT,sent_at TEXT,error TEXT);
    CREATE TABLE whatsapp_auto_replies (tenant_id INTEGER,instance_id TEXT,message_id TEXT,remote_jid TEXT,replied_at TEXT,
      UNIQUE(tenant_id,instance_id,message_id));
  `);
  const database = { db, transaction: <T>(callback: () => T) => callback() } as DatabaseService;
  const env = {
    whatsappInternalToken: "internal-secret", evolutionApiUrl: new URL("http://evolution:8080"),
    evolutionApiKey: "evolution-key", publicUrl: new URL("https://hipersales.example"),
  } as EnvService;
  const settings = new SettingsService(database);
  return { db, settings, service: new IntegrationsService(database, env, settings) };
}

afterEach(() => vi.unstubAllGlobals());

describe("external integrations", () => {
  it("uses constant-time token verification semantics", () => {
    const { db, service } = fixture();
    expect(() => service.verifyInternalToken("wrong")).toThrow(ForbiddenException);
    expect(() => service.verifyInternalToken("internal-secret")).not.toThrow();
    db.close();
  });

  it("returns pending WhatsApp messages and records delivery", () => {
    const { db, service } = fixture();
    db.prepare("INSERT INTO email_outbox (id,tenant_id,kind,recipients,subject,body,created_at) VALUES (1,1,'status','whatsapp:32999999999','S','B','now')").run();
    expect(service.pendingMessages().messages[0]).toMatchObject({ id: 1, phone: "5532999999999" });
    expect(service.updateOutbox(1, { sent: true })).toEqual({ ok: true });
    expect(db.prepare("SELECT sent_at,error FROM email_outbox WHERE id=1").get()).toMatchObject({ error: null });
    db.close();
  });

  it("deduplicates automatic replies received from Evolution", async () => {
    const { db, settings, service } = fixture();
    settings.write(1, "whatsapp", { enabled: true, unavailable_reply_enabled: true,
      unavailable_reply_message: "Canal indisponivel", instance_id: "hipersales-tenant-1" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: "sent" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const event = { instance: "hipersales-tenant-1", data: { key: { id: "message-1", remoteJid: "5532999999999@s.whatsapp.net", fromMe: false } } };
    await expect(service.webhook(event)).resolves.toEqual({ ok: true, sent: 1 });
    await expect(service.webhook(event)).resolves.toEqual({ ok: true, sent: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.prepare("SELECT COUNT(*) AS total FROM whatsapp_auto_replies").get()).toEqual({ total: 1 });
    db.close();
  });
});
