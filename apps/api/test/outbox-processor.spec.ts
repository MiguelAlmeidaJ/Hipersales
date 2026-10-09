import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { IntegrationsService } from "../src/settings/integrations.service.js";
import { OutboxProcessorService } from "../src/settings/outbox-processor.service.js";

function fixture(sendEmail = vi.fn().mockResolvedValue(undefined)) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE email_outbox (id INTEGER PRIMARY KEY,tenant_id INTEGER,recipients TEXT,subject TEXT,body TEXT,
    attempts INTEGER DEFAULT 0,sent_at TEXT,error TEXT);`);
  const service = new OutboxProcessorService({ db } as DatabaseService, { sendEmail } as unknown as IntegrationsService);
  return { db, service, sendEmail };
}

describe("SMTP outbox processor", () => {
  it("delivers email rows and leaves WhatsApp rows for its channel", async () => {
    const { db, service, sendEmail } = fixture();
    db.exec(`INSERT INTO email_outbox VALUES (1,1,'a@example.com','Assunto','Corpo',0,NULL,NULL);
      INSERT INTO email_outbox VALUES (2,1,'whatsapp:5532999999999','Assunto','Corpo',0,NULL,NULL);`);
    await expect(service.processBatch()).resolves.toBe(1);
    expect(sendEmail).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 }));
    expect(db.prepare("SELECT sent_at FROM email_outbox WHERE id=1").get()).not.toMatchObject({ sent_at: null });
    expect(db.prepare("SELECT attempts FROM email_outbox WHERE id=2").get()).toEqual({ attempts: 0 });
    db.close();
  });

  it("records bounded errors and stops after five attempts", async () => {
    const failure = vi.fn().mockRejectedValue(new Error("SMTP offline"));
    const { db, service } = fixture(failure);
    db.exec("INSERT INTO email_outbox VALUES (1,1,'a@example.com','S','B',4,NULL,NULL)");
    await expect(service.processBatch()).resolves.toBe(0);
    expect(db.prepare("SELECT attempts,error FROM email_outbox WHERE id=1").get()).toEqual({ attempts: 5, error: "SMTP offline" });
    await service.processBatch();
    expect(failure).toHaveBeenCalledTimes(1);
    db.close();
  });
});
