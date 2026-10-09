import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { CustomersWriteService } from "../src/customers/customers-write.service.js";

const admin: PublicUser = {
  id: 1, name: "Admin", email: "admin", role: "admin", tenant_id: 1,
  is_super_admin: false, is_dev: false, active: true, must_change_password: false,
};

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, tenant_id INTEGER, legal_name TEXT,
      trade_name TEXT, cnpj TEXT, state_registration TEXT, address TEXT, phone TEXT,
      email TEXT, form_payload TEXT, active INTEGER, created_at TEXT);
    CREATE TABLE customer_sellers (customer_id INTEGER, seller_id INTEGER);
    CREATE TABLE proposals (id INTEGER, customer_id INTEGER, tenant_id INTEGER);
  `);
  const database = {
    db,
    transaction: <T>(fn: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try { const result = fn(); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  return { db, service: new CustomersWriteService(database) };
}

describe("customer writes", () => {
  it("creates and updates while keeping customer identity and form fields", () => {
    const { db, service } = fixture();
    const id = service.create(admin, {legal_name:"Empresa Um",cnpj:"12.345.678/0001-90",phone:"31999999999"}).id;
    const result = service.update(admin, id, {legal_name:"Empresa Nova",cnpj:"12345678000190",phone:"31999999999"});
    expect(result.id).toBe(id);
    expect(db.prepare("SELECT legal_name, phone FROM customers WHERE id=?").get(id))
      .toMatchObject({legal_name:"Empresa Nova",phone:"31999999999"});
    db.close();
  });

  it("rejects duplicate CNPJ with different punctuation", () => {
    const { db, service } = fixture();
    service.create(admin, {legal_name:"Primeiro",cnpj:"12.345.678/0001-90"});
    expect(() => service.create(admin, {legal_name:"Segundo",cnpj:"12345678000190"})).toThrow();
    db.close();
  });

  it("prevents editing records belonging to another tenant", () => {
    const { db, service } = fixture();
    const id = service.create(admin, {legal_name:"Primeiro",cnpj:"12345678000190"}).id;
    expect(() => service.update({...admin,tenant_id:2},id,{legal_name:"Outro",cnpj:"12345678000190"})).toThrow();
    db.close();
  });

  it("blocks deletion with orders and deletes unused customer assignments", () => {
    const { db, service } = fixture();
    const id = service.create(admin, {legal_name:"Primeiro",cnpj:"12345678000190"}).id;
    db.prepare("INSERT INTO customer_sellers VALUES (?,?)").run(id,10);
    db.prepare("INSERT INTO proposals VALUES (?,?,?)").run(1,id,1);
    expect(() => service.remove(admin,id)).toThrow();
    db.prepare("DELETE FROM proposals WHERE customer_id=?").run(id);
    expect(service.remove(admin,id).message).toBe("Cliente excluido.");
    expect(db.prepare("SELECT 1 FROM customer_sellers WHERE customer_id=?").get(id)).toBeUndefined();
    db.close();
  });
});
