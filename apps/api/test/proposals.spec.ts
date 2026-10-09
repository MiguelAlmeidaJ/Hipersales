import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { ProposalsService, normalizeProposalTimeline } from "../src/proposals/proposals.service.js";

const user = (id: number, role: "admin" | "seller", tenant_id = 1) =>
  ({id, role, tenant_id}) as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE proposals (id INTEGER PRIMARY KEY,tenant_id INTEGER,seller_id INTEGER,
      customer_id INTEGER,company_id INTEGER,created_at TEXT,status TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY,name TEXT,email TEXT,communication_email TEXT,whatsapp_phone TEXT);
    CREATE TABLE customers (id INTEGER PRIMARY KEY,legal_name TEXT,trade_name TEXT,cnpj TEXT,
      state_registration TEXT,address TEXT,phone TEXT,email TEXT);
    CREATE TABLE companies (id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE products (id INTEGER PRIMARY KEY,code TEXT,name TEXT,unit TEXT);
    CREATE TABLE proposal_items (id INTEGER PRIMARY KEY,proposal_id INTEGER,product_id INTEGER,quantity INTEGER);
    CREATE TABLE proposal_events (id INTEGER PRIMARY KEY,proposal_id INTEGER,created_by INTEGER,status TEXT,created_at TEXT);
    INSERT INTO users VALUES (10,'Maria','m@example.com',NULL,'31999'),(20,'Joao','j@example.com',NULL,'31888');
    INSERT INTO customers VALUES (1,'Cliente A','A','123',NULL,NULL,NULL,NULL);
    INSERT INTO companies VALUES (1,'Empresa A');
    INSERT INTO products VALUES (1,'P001','Produto','UN');
    INSERT INTO proposals VALUES
      (1,1,10,1,1,'2026-10-01','faturado'),
      (2,1,20,1,1,'2026-10-02','em_analise'),
      (3,2,10,1,1,'2026-10-03','em_analise');
    INSERT INTO proposal_items VALUES (1,1,1,5);
    INSERT INTO proposal_events VALUES
      (1,1,10,'em_analise','2026-10-01'),
      (2,1,10,'pedido_aprovado','2026-10-02'),
      (3,1,10,'em_analise','2026-10-03'),
      (4,1,10,'faturado','2026-10-04');
  `);
  return {db,service:new ProposalsService({db} as DatabaseService)};
}

describe("proposal listings", () => {
  it("limits seller results to assigned orders in the same tenant", () => {
    const {db,service}=fixture();
    const rows=service.list(user(10,"seller")).proposals;
    expect(rows.map(row=>row.id)).toEqual([1]);
    expect(rows[0]?.items).toHaveLength(1);
    expect(rows[0]?.timeline).toHaveLength(3);
    db.close();
  });

  it("lets admins see all tenant orders but no other tenant", () => {
    const {db,service}=fixture();
    expect(service.list(user(1,"admin")).proposals.map(row=>row.id)).toEqual([2,1]);
    expect(service.list(user(1,"admin",2)).proposals.map(row=>row.id)).toEqual([3]);
    db.close();
  });

  it("normalizes repeated and regressive statuses", () => {
    const result=normalizeProposalTimeline([
      {status:"em_analise"}, {status:"pedido_aprovado"}, {status:"em_analise"},
      {status:"faturado"}, {status:"em_producao"},
    ]);
    expect(result.map(row=>row.status)).toEqual(["em_analise","pedido_aprovado","faturado"]);
  });
});
