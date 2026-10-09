import { DatabaseSync } from "node:sqlite";
import type { PublicUser } from "@hipersales/contracts";
import { describe, expect, it } from "vitest";
import type { EnvService } from "../src/config/env.service.js";
import type { DatabaseService } from "../src/database/database.service.js";
import { GoalsService } from "../src/goals/goals.service.js";

const admin = { id: 1, role: "admin", tenant_id: 1 } as PublicUser;
const seller = { id: 2, role: "seller", tenant_id: 1 } as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, tenant_id INTEGER, role TEXT, name TEXT, email TEXT,
      communication_email TEXT, whatsapp_phone TEXT, active INTEGER);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, tenant_id INTEGER, active INTEGER);
    CREATE TABLE customer_sellers (customer_id INTEGER, seller_id INTEGER);
    CREATE TABLE proposals (id INTEGER PRIMARY KEY, tenant_id INTEGER, seller_id INTEGER,
      customer_id INTEGER, status TEXT, created_at TEXT);
    CREATE TABLE proposal_items (proposal_id INTEGER, quantity REAL, negotiated_price REAL);
    CREATE TABLE registration_requests (id INTEGER PRIMARY KEY, tenant_id INTEGER, seller_id INTEGER,
      status TEXT, created_at TEXT);
    CREATE TABLE seller_goals (id INTEGER PRIMARY KEY, tenant_id INTEGER, seller_id INTEGER,
      year INTEGER, month INTEGER, sales_goal REAL, new_customers_goal INTEGER,
      customer_positivation_goal REAL, updated_at TEXT,
      UNIQUE(tenant_id, seller_id, year, month));
    INSERT INTO users VALUES
      (1,1,'admin','Admin','admin','','',1),
      (2,1,'seller','Vendedor','seller','','',1),
      (3,2,'seller','Outro','other','','',1);
    INSERT INTO customers VALUES (10,1,1),(11,1,1),(12,2,1);
    INSERT INTO customer_sellers VALUES (10,2),(11,2);
    INSERT INTO proposals VALUES
      (100,1,2,10,'pedido_aprovado','2026-06-15T12:00:00.000Z'),
      (101,1,2,11,'recusado','2026-06-16T12:00:00.000Z'),
      (102,1,2,11,'pedido_aprovado','2026-07-01T03:00:00.000Z'),
      (103,2,3,12,'pedido_aprovado','2026-06-15T12:00:00.000Z');
    INSERT INTO proposal_items VALUES (100,2,10),(101,50,10),(102,3,10),(103,999,10);
    INSERT INTO registration_requests VALUES
      (1,1,2,'aprovada','2026-06-20T12:00:00.000Z'),
      (2,1,2,'pendente','2026-06-20T12:00:00.000Z'),
      (3,2,3,'aprovada','2026-06-20T12:00:00.000Z');
    INSERT INTO seller_goals
      (tenant_id,seller_id,year,month,sales_goal,new_customers_goal,customer_positivation_goal,updated_at)
      VALUES (1,2,2026,6,100,2,80,'now');
  `);
  const database = {
    db,
    transaction: <T>(callback: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try { const value = callback(); db.exec("COMMIT"); return value; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  const env = { reportTimezone: "America/Sao_Paulo" } as EnvService;
  return { db, service: new GoalsService(database, env) };
}

describe("goals service", () => {
  it("calculates the monthly seller performance with tenant and period isolation", () => {
    const { service } = fixture();
    const result = service.performance(1, 2, 2026, 6);
    expect(result.sales).toMatchObject({ goal: 100, realized: 20, missing: 80, percent: 20 });
    expect(result.new_customers).toMatchObject({ goal: 2, realized: 1, percent: 50 });
    expect(result.customer_positivation).toMatchObject({ goal: 80, realized: 50, missing: 30 });
    expect(result.portfolio).toEqual({ customers: 2, attended: 1 });
  });

  it("returns the seller payload and admin rows", () => {
    const { service } = fixture();
    expect(service.mine(seller, "2026", "6").seller).toMatchObject({ id: 2, name: "Vendedor" });
    const rows = service.admin(admin, "2026", "6");
    expect(rows.rows).toHaveLength(1);
    expect(rows.reminder_days).toEqual([10, 15, 20, 25, 27, 28, 29, 30]);
  });

  it("upserts valid goals, ignores another tenant and removes an empty row atomically", () => {
    const { db, service } = fixture();
    const saved = service.save(admin, {
      year: 2026,
      month: 7,
      goals: [
        { seller_id: 2, sales_goal: "1.250,50", new_customers_goal: "3", customer_positivation_goal: "75" },
        { seller_id: 3, sales_goal: 999, new_customers_goal: null, customer_positivation_goal: null },
      ],
    });
    expect(saved).toMatchObject({ saved: 1, removed: 0 });
    expect(db.prepare("SELECT sales_goal,new_customers_goal FROM seller_goals WHERE tenant_id=1 AND month=7").get())
      .toEqual({ sales_goal: 1250.5, new_customers_goal: 3 });

    const removed = service.save(admin, {
      year: 2026,
      month: 7,
      goals: [{ seller_id: 2, sales_goal: null, new_customers_goal: null, customer_positivation_goal: null }],
    });
    expect(removed.removed).toBe(1);
  });
});
