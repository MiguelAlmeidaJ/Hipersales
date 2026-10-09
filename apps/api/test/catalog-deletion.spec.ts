import { NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.service.js";
import type { DatabaseService } from "../src/database/database.service.js";

const admin = { id: 1, role: "admin", tenant_id: 1 } as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE companies (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, name TEXT);
    CREATE TABLE products (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, company_id INTEGER NOT NULL);
    CREATE TABLE proposals (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, company_id INTEGER NOT NULL);
    CREATE TABLE proposal_items (proposal_id INTEGER NOT NULL, product_id INTEGER);
    CREATE TABLE proposal_events (proposal_id INTEGER NOT NULL, event TEXT);
    INSERT INTO companies VALUES (1,1,'Empresa A'), (2,2,'Empresa B');
    INSERT INTO products VALUES (10,1,1), (20,2,2);
    INSERT INTO proposals VALUES (100,1,1), (200,2,2);
    INSERT INTO proposal_items VALUES (100,10), (200,20);
    INSERT INTO proposal_events VALUES (100,'created'), (200,'created');
  `);
  const database = {
    db,
    transaction: <T>(callback: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = callback();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  } as DatabaseService;
  return { db, service: new CatalogService(database) };
}

describe("company deletion", () => {
  it("removes the company aggregate only from the authenticated tenant", () => {
    const { db, service } = fixture();

    expect(service.deleteCompany(admin, 1)).toEqual({ message: "Empresa excluida definitivamente." });
    expect(db.prepare("SELECT COUNT(*) AS total FROM companies WHERE tenant_id=1").get()).toEqual({ total: 0 });
    expect(db.prepare("SELECT COUNT(*) AS total FROM products WHERE tenant_id=1").get()).toEqual({ total: 0 });
    expect(db.prepare("SELECT COUNT(*) AS total FROM proposals WHERE tenant_id=1").get()).toEqual({ total: 0 });
    expect(db.prepare("SELECT COUNT(*) AS total FROM companies WHERE tenant_id=2").get()).toEqual({ total: 1 });
    expect(db.prepare("SELECT COUNT(*) AS total FROM proposal_items WHERE proposal_id=200").get()).toEqual({ total: 1 });
    db.close();
  });

  it("hides companies owned by another tenant", () => {
    const { db, service } = fixture();
    expect(() => service.deleteCompany(admin, 2)).toThrow(NotFoundException);
    expect(db.prepare("SELECT COUNT(*) AS total FROM companies").get()).toEqual({ total: 2 });
    db.close();
  });
});
