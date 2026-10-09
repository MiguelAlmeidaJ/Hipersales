import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { AssignmentsService } from "../src/customers/assignments.service.js";

const admin = {id:1,role:"admin",tenant_id:1,tenant_name:"HiperMix"} as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY,tenant_id INTEGER,role TEXT,name TEXT,email TEXT,
      communication_email TEXT,whatsapp_phone TEXT,is_dev INTEGER,active INTEGER,must_change_password INTEGER,password_updated_at TEXT);
    CREATE TABLE customers (id INTEGER PRIMARY KEY,tenant_id INTEGER,legal_name TEXT,trade_name TEXT,cnpj TEXT,active INTEGER);
    CREATE TABLE companies (id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,legal_name TEXT,active INTEGER);
    CREATE TABLE customer_sellers (customer_id INTEGER,seller_id INTEGER,UNIQUE(customer_id,seller_id));
    CREATE TABLE company_sellers (company_id INTEGER,seller_id INTEGER,UNIQUE(company_id,seller_id));
    INSERT INTO users (id,tenant_id,role,name,email,active) VALUES
      (10,1,'seller','Vendedor 10','v10',1),(11,2,'seller','Vendedor 11','v11',1);
    INSERT INTO customers VALUES (1,1,'Cliente A','A','111',1),(2,2,'Cliente B','B','222',1);
    INSERT INTO companies VALUES (1,1,'Empresa A','A',1),(2,2,'Empresa B','B',1);
  `);
  const database = {
    db, transaction: <T>(callback: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try { const result = callback(); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  return {db, service:new AssignmentsService(database)};
}

describe("representative assignments", () => {
  it("filters records by tenant and preserves assignment counts", () => {
    const {db,service}=fixture();
    expect(service.set(admin,"customers",{customer_id:1,seller_id:10,assigned:true})).toHaveProperty("message");
    const result=service.list(admin,"customers",10);
    expect(result.customers).toHaveLength(1);
    expect(result.assigned_count).toBe(1);
    db.close();
  });

  it("does not allow cross-tenant seller or company associations", () => {
    const {db,service}=fixture();
    expect(()=>service.set(admin,"companies",{company_id:2,seller_id:10,assigned:true})).toThrow();
    expect(()=>service.set(admin,"companies",{company_id:1,seller_id:11,assigned:true})).toThrow();
    expect(()=>service.list(admin,"customers",11)).toThrow();
    db.close();
  });

  it("associates idempotently and unlinks only selected representative", () => {
    const {db,service}=fixture();
    const action={company_id:1,seller_id:10,assigned:true};
    service.set(admin,"companies",action);
    service.set(admin,"companies",action);
    expect(service.list(admin,"companies",10).assigned_count).toBe(1);
    service.set(admin,"companies",{...action,assigned:false});
    expect(service.list(admin,"companies",10).assigned_count).toBe(0);
    db.close();
  });

  it("supports the legacy assign-customer contract without weakening tenant isolation", () => {
    const {db,service}=fixture();
    const input={customer_id:1,seller_id:10};
    expect(service.set(admin,"customers",{...input,assigned:true})).toEqual({
      message:"Cliente associado ao representante comercial.",
    });
    expect(service.list(admin,"customers",10).assigned_count).toBe(1);
    expect(()=>service.set(admin,"customers",{customer_id:2,seller_id:10,assigned:true})).toThrow();
    db.close();
  });
});
