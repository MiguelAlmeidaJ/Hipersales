import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import type { CnpjLookupService } from "../src/customers/cnpj-lookup.service.js";
import { RegistrationSubmissionService } from "../src/customers/registration-submission.service.js";

const seller = {id: 10, tenant_id: 1, role: "seller", name: "Representante",
  email: "seller@example.com", communication_email: "contact@example.com"} as PublicUser;
const input = { legal_name: "Empresa Teste", cnpj: "12345678000190",
  contact_person: "Ana", phone_1: "31999999999" };

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, tenant_id INTEGER, cnpj TEXT);
    CREATE TABLE registration_requests (id INTEGER PRIMARY KEY, tenant_id INTEGER, seller_id INTEGER,
      legal_name TEXT, trade_name TEXT, cnpj TEXT, state_registration TEXT, address TEXT,
      phone TEXT, email TEXT, notes TEXT, form_payload TEXT, created_at TEXT, status TEXT DEFAULT 'pendente');
    CREATE TABLE email_outbox (id INTEGER PRIMARY KEY, tenant_id INTEGER, kind TEXT,
      recipients TEXT, subject TEXT, body TEXT, created_at TEXT);
  `);
  const database = {
    db,
    transaction: <T>(callback: () => T) => {
      db.exec("BEGIN IMMEDIATE");
      try { const value = callback(); db.exec("COMMIT"); return value; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  const lookup = {lookup:vi.fn().mockResolvedValue({legal_name:"Empresa Teste",address:"Rua A"})};
  return {db,lookup,service:new RegistrationSubmissionService(database,lookup as unknown as CnpjLookupService)};
}

describe("registration request submission", () => {
  it("creates a pending request with its outbox notification atomically", async () => {
    const {db,service} = setup();
    const result = await service.submit(seller,input);
    expect(result).toHaveProperty("id");
    expect(db.prepare("SELECT status FROM registration_requests").get()).toMatchObject({status:"pendente"});
    expect(db.prepare("SELECT kind FROM email_outbox").get()).toMatchObject({kind:"customer_request"});
    db.close();
  });

  it("requires seller permission and required contact information", async () => {
    const {db,service,lookup}=setup();
    await expect(service.submit({...seller,role:"admin"},input)).rejects.toThrow();
    await expect(service.submit(seller,{...input,phone_1:""})).rejects.toThrow();
    expect(lookup.lookup).not.toHaveBeenCalled();
    db.close();
  });

  it("rejects duplicates and creates no notification", async () => {
    const {db,service}=setup();
    db.prepare("INSERT INTO customers (tenant_id,cnpj) VALUES (?,?)").run(1,"12.345.678/0001-90");
    await expect(service.submit(seller,input)).rejects.toThrow();
    expect(db.prepare("SELECT id FROM registration_requests").all()).toHaveLength(0);
    expect(db.prepare("SELECT id FROM email_outbox").all()).toHaveLength(0);
    db.close();
  });
});
