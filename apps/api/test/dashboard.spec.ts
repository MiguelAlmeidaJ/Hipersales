import { BadRequestException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { DashboardService } from "../src/dashboard/dashboard.service.js";
import type { DatabaseService } from "../src/database/database.service.js";

const admin = { id: 1, tenant_id: 1, role: "admin" } as PublicUser;
const seller = { id: 2, tenant_id: 1, role: "seller" } as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE tenants (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, role TEXT, active INTEGER,
      email TEXT, communication_email TEXT, whatsapp_phone TEXT);
    CREATE TABLE companies (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, active INTEGER);
    CREATE TABLE products (id INTEGER PRIMARY KEY, tenant_id INTEGER, company_id INTEGER, code TEXT, name TEXT, unit TEXT, active INTEGER);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, tenant_id INTEGER, legal_name TEXT, trade_name TEXT, cnpj TEXT,
      state_registration TEXT, address TEXT, phone TEXT, email TEXT, active INTEGER);
    CREATE TABLE customer_sellers (customer_id INTEGER, seller_id INTEGER);
    CREATE TABLE proposals (id INTEGER PRIMARY KEY, tenant_id INTEGER, seller_id INTEGER, customer_id INTEGER,
      company_id INTEGER, order_number INTEGER, status TEXT, created_at TEXT);
    CREATE TABLE proposal_items (id INTEGER PRIMARY KEY, proposal_id INTEGER, product_id INTEGER, quantity REAL, negotiated_price REAL);
    CREATE TABLE proposal_events (id INTEGER PRIMARY KEY, proposal_id INTEGER, status TEXT, created_by INTEGER, created_at TEXT);
    CREATE TABLE registration_requests (id INTEGER PRIMARY KEY, tenant_id INTEGER, seller_id INTEGER, status TEXT, created_at TEXT);
    CREATE TABLE email_outbox (id INTEGER PRIMARY KEY, tenant_id INTEGER);
    INSERT INTO tenants VALUES (1,'HiperMix'),(2,'Outra');
    INSERT INTO users VALUES (1,1,'Admin','admin',1,'admin@a',NULL,NULL),(2,1,'Vendedor','seller',1,'v@a',NULL,NULL),(3,2,'Outro','seller',1,'o@b',NULL,NULL);
    INSERT INTO companies VALUES (1,1,'Industria A',1),(2,2,'Industria B',1);
    INSERT INTO products VALUES (1,1,1,'A','Produto A','UN',1),(2,2,2,'B','Produto B','UN',1);
    INSERT INTO customers VALUES (1,1,'Cliente A','A','111',NULL,NULL,NULL,NULL,1),(2,1,'Cliente B','B','222',NULL,NULL,NULL,NULL,1),(3,2,'Cliente C','C','333',NULL,NULL,NULL,NULL,1);
    INSERT INTO customer_sellers VALUES (1,2),(2,2),(3,2);
    INSERT INTO proposals VALUES
      (1,1,2,1,1,101,'pedido_aprovado','2026-05-10T12:00:00Z'),
      (2,1,2,2,1,102,'em_analise','2026-06-10T12:00:00Z'),
      (3,2,3,3,2,201,'pedido_aprovado','2026-05-10T12:00:00Z');
    INSERT INTO proposal_items VALUES (1,1,1,2,10),(2,2,1,1,5),(3,3,2,100,100);
    INSERT INTO proposal_events VALUES (1,1,'em_analise',2,'2026-05-10T12:00:00Z'),(2,3,'em_analise',3,'2026-05-10T12:00:00Z');
    INSERT INTO registration_requests VALUES (1,1,2,'pendente','2026-05-10'),(2,2,3,'pendente','2026-05-10');
    INSERT INTO email_outbox VALUES (1,1),(2,2);
  `);
  return { service: new DashboardService({ db } as DatabaseService) };
}

describe("dashboard service", () => {
  it("isolates seller and admin summaries by tenant", () => {
    const { service } = fixture();
    expect(service.summary(admin).summary).toMatchObject({ customers: 2, proposals: 2, orders: 1, pending_requests: 1 });
    expect(service.summary(seller).summary).toMatchObject({ customers: 2, proposals: 2, orders: 1, pending_requests: 1 });
    expect(service.adminOverview(admin).summary).toMatchObject({ sellers: 1, companies: 1, products: 1, outbox: 1 });
    const adminSummary = service.adminSummary(admin);
    expect(adminSummary.registration_requests).toHaveLength(1);
    expect(adminSummary.proposals).toHaveLength(2);
    expect(adminSummary.proposals[0]).toHaveProperty("items");
  });

  it("builds the filtered executive view without cross-tenant totals", () => {
    const { service } = fixture();
    const result = service.executive(admin, { date_from: "2026-05-01", date_to: "2026-05-31", q: "Produto A" });
    expect(result.summary).toMatchObject({ orders: 1, revenue: 20, average_ticket: 20, customers: 2 });
    expect(result.company_ranking).toEqual([{ name: "Industria A", orders: 1, total: 20 }]);
    expect(result.seller_ranking).toEqual([{ name: "Vendedor", orders: 1, total: 20 }]);
    expect(result.top_products).toEqual([{ name: "Produto A", company: "Industria A", quantity: 2, total: 20 }]);
    expect(result.recent_orders).toHaveLength(1);
  });

  it("rejects invalid filters before querying", () => {
    const { service } = fixture();
    expect(() => service.executive(admin, { status: "injetado" })).toThrow(BadRequestException);
    expect(() => service.executive(admin, { date_from: "2026-02-30" })).toThrow(BadRequestException);
    expect(() => service.executive(admin, { date_from: "2026-06-01", date_to: "2026-05-01" })).toThrow(
      BadRequestException,
    );
  });
});
