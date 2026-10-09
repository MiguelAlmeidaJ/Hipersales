import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { CatalogService } from "../src/catalog/catalog.service.js";
import { CatalogTransferService } from "../src/catalog/catalog-transfer.service.js";

const admin: PublicUser = {
  id: 1, name: "Admin", email: "admin", role: "admin", tenant_id: 1,
  is_super_admin: false, is_dev: false, active: true, must_change_password: false,
};

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, legal_name TEXT, active INTEGER);
    CREATE TABLE products (id INTEGER PRIMARY KEY, tenant_id INTEGER, company_id INTEGER,
      code TEXT, name TEXT, unit TEXT, price REAL, active INTEGER, UNIQUE(company_id,code));
    INSERT INTO companies VALUES (1,1,'Empresa A','Razao A',1),(2,2,'Empresa B','Razao B',1);
    INSERT INTO products VALUES (1,1,1,'A1','Original','UN',10,1);
  `);
  const database = { db, transaction: <T>(fn: () => T) => {
    db.exec("BEGIN IMMEDIATE");
    try { const output = fn(); db.exec("COMMIT"); return output; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }} as DatabaseService;
  const catalog = new CatalogService(database);
  return { db, transfers: new CatalogTransferService(database,catalog) };
}

describe("catalog transfer", () => {
  it("exports only the user's company records using the existing CSV contract", () => {
    const {db,transfers} = fixture();
    const result = transfers.exportProducts(admin);
    expect(result.csv).toContain("company_id,company_name,code,name,unit,price,active");
    expect(result.csv).toContain("Original");
    expect(result.csv).not.toContain("Empresa B");
    db.close();
  });

  it("upserts products and skips foreign tenant companies", () => {
    const {db,transfers} = fixture();
    const result = transfers.importProducts(admin,{rows:[
      {company_id:1,code:"A1",name:"Alterado",price:12},
      {company_id:1,code:"A2",name:"Novo",price:8},
      {company_id:2,code:"B1",name:"Proibido"},
    ]});
    expect(result).toMatchObject({created:1,updated:1});
    expect(db.prepare("SELECT name FROM products WHERE id=1").get()).toMatchObject({name:"Alterado"});
    expect(db.prepare("SELECT 1 FROM products WHERE code='B1'").get()).toBeUndefined();
    db.close();
  });

  it("rolls back all writes if a row fails validation", () => {
    const {db,transfers} = fixture();
    expect(() => transfers.importProducts(admin,{rows:[
      {company_id:1,code:"A2",name:"Novo",price:8},
      {company_id:1,code:"A3",name:"Invalido",price:"abc"},
    ]})).toThrow();
    expect(db.prepare("SELECT id FROM products WHERE code='A2'").get()).toBeUndefined();
    db.close();
  });
});
