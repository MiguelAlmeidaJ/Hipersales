import type { PublicUser } from "@hipersales/contracts";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import { DocumentsService } from "../src/documents/documents.service.js";

describe("PDF documents", () => {
  it("generates a tenant-scoped proposal PDF", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE users(id INTEGER,name TEXT); CREATE TABLE customers(id INTEGER,legal_name TEXT,cnpj TEXT);
      CREATE TABLE companies(id INTEGER,name TEXT); CREATE TABLE products(id INTEGER,code TEXT,name TEXT,unit TEXT);
      CREATE TABLE proposals(id INTEGER,tenant_id INTEGER,seller_id INTEGER,company_id INTEGER,customer_id INTEGER,
        order_number INTEGER,status TEXT,payment_terms TEXT,freight_type TEXT,delivery_type TEXT,purchase_order TEXT,
        notes TEXT,created_at TEXT); CREATE TABLE proposal_items(id INTEGER,proposal_id INTEGER,product_id INTEGER,
        quantity REAL,negotiated_price REAL);
      INSERT INTO users VALUES(2,'Vendedor'); INSERT INTO customers VALUES(3,'Cliente','123');
      INSERT INTO companies VALUES(4,'Industria'); INSERT INTO products VALUES(5,'P1','Produto','UN');
      INSERT INTO proposals VALUES(6,1,2,4,3,10840,'em_analise','30 dias','CIF','Normal','OC-1','Teste','2026-01-01');
      INSERT INTO proposal_items VALUES(1,6,5,2,10);
    `);
    const service = new DocumentsService({ db } as DatabaseService);
    const pdf = await service.proposal({ id: 2, tenant_id: 1, role: "seller" } as PublicUser, 6);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
    db.close();
  });
});
