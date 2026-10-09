import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { RegistrationReviewService } from "../src/customers/registration-review.service.js";
import { ApprovalNotificationsService } from "../src/customers/approval-notifications.service.js";

const admin = { id: 1, role: "admin", tenant_id: 1 } as PublicUser;

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE registration_requests (
      id INTEGER PRIMARY KEY,tenant_id INTEGER,seller_id INTEGER,status TEXT,legal_name TEXT,
      trade_name TEXT,cnpj TEXT,state_registration TEXT,address TEXT,phone TEXT,email TEXT,
      notes TEXT,form_payload TEXT);
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,tenant_id INTEGER,legal_name TEXT,trade_name TEXT,cnpj TEXT,
      state_registration TEXT,address TEXT,phone TEXT,email TEXT,form_payload TEXT,active INTEGER,created_at TEXT);
    CREATE TABLE customer_sellers (customer_id INTEGER,seller_id INTEGER,UNIQUE(customer_id,seller_id));
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,email TEXT,
      communication_email TEXT,whatsapp_phone TEXT);
    CREATE TABLE tenant_settings (tenant_id INTEGER,key TEXT,value TEXT);
    CREATE TABLE system_settings (key TEXT,value TEXT);
    CREATE TABLE email_outbox (
      id INTEGER PRIMARY KEY,tenant_id INTEGER,kind TEXT,recipients TEXT,
      subject TEXT,body TEXT,created_at TEXT);
    INSERT INTO registration_requests VALUES
      (1,1,10,'pendente','Empresa A','Fantasia','12.345.678/0001-90','','Rua A','319999','','','{}');
    INSERT INTO users VALUES (10,1,'Maria','maria@teste.com','contato@teste.com','31999999999');
  `);
  const database = {
    db, transaction: <T>(callback: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try { const result = callback(); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  const notification = new ApprovalNotificationsService(database);
  const review = new RegistrationReviewService(database, notification);
  const config = (name: string, value: unknown) => db.prepare(
    "INSERT INTO tenant_settings (tenant_id,key,value) VALUES (?,?,?)",
  ).run(1,name,JSON.stringify(value));
  return { db, review, config };
}

describe("registration approval integration", () => {
  it("commits customer, seller association and outbox once", () => {
    const { db, review, config } = setup();
    config("message_templates", {
      email: { customer_approved: {
        subject: "Aprovacao {{cliente}}", body: "<body>Ola {{vendedor}}</body>",
      } },
    });
    config("whatsapp", { enabled: true });
    expect(() => review.review(admin,1,{status:"aprovada"})).toThrow();
    expect(db.prepare("SELECT count(*) AS total FROM customers").get()).toMatchObject({total:0});
    expect(db.prepare("SELECT status FROM registration_requests WHERE id=1").get())
      .toMatchObject({status:"pendente"});
    db.prepare("UPDATE tenant_settings SET value=? WHERE tenant_id=1 AND key='whatsapp'").run(JSON.stringify({enabled:false}));
    review.review(admin,1,{status:"aprovada"});
    review.review(admin,1,{status:"aprovada"});
    expect(db.prepare("SELECT count(*) AS total FROM customers").get()).toMatchObject({total:1});
    expect(db.prepare("SELECT count(*) AS total FROM customer_sellers").get()).toMatchObject({total:1});
    expect(db.prepare("SELECT count(*) AS total FROM email_outbox").get()).toMatchObject({total:1});
    const message = db.prepare("SELECT subject,body FROM email_outbox").get() as {subject:string;body:string};
    expect(message.subject).toBe("Aprovacao Fantasia");
    expect(message.body).toContain("Ola Maria");
    db.close();
  });

  it("queues both channels atomically when WhatsApp is configured", () => {
    const { db, review, config } = setup();
    config("message_templates",{
      email:{customer_approved:{subject:"Email {{cliente}}",body:"Email {{cnpj}}"}},
      whatsapp:{customer_approved:{subject:"WhatsApp {{cliente}}",body:"Aprovado: {{vendedor}}"}},
    });
    config("whatsapp",{enabled:true});
    review.review(admin,1,{status:"aprovada"});
    const rows = db.prepare("SELECT kind,recipients FROM email_outbox ORDER BY id").all() as {kind:string;recipients:string}[];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.kind).toBe("customer_status_email");
    expect(rows[1]).toMatchObject({kind:"customer_status_whatsapp",recipients:"whatsapp:31999999999"});
    db.close();
  });
});
