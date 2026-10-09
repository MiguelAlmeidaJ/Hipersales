import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { CatalogService } from "../src/catalog/catalog.service.js";

function user(role: "admin" | "seller", id = 1): PublicUser {
  return {
    id, name: "Teste", email: "teste", role, tenant_id: 1, tenant_name: "HiperMix",
    is_super_admin: false, is_dev: false, active: true,
    must_change_password: false,
  };
}

describe("Nest catalog read parity", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, legal_name TEXT, active INTEGER);
    CREATE TABLE products (id INTEGER PRIMARY KEY, tenant_id INTEGER, company_id INTEGER, code TEXT, name TEXT, price REAL, active INTEGER);
    CREATE TABLE company_sellers (company_id INTEGER, seller_id INTEGER);
    INSERT INTO companies VALUES (1,1,'Industria A','Razao A',1),(2,1,'Industria B','Razao B',0),(3,2,'Outra Empresa','Outra',1);
    INSERT INTO products VALUES (1,1,1,'A01','Produto A',2,1),(2,1,2,'B01','Produto B',3,1),(3,2,3,'C01','Produto C',4,1);
    INSERT INTO company_sellers VALUES (1,10);
  `);
  const service = new CatalogService({ db } as DatabaseService);

  afterEach(() => { /* shared immutable test fixture */ });

  it("lists only active companies in the authenticated company", () => {
    const result = service.companies(user("admin"));
    expect(result.companies.map((row) => row.id)).toEqual([1]);
  });

  it("does not reveal another seller's assigned companies", () => {
    expect(service.companies(user("seller", 10)).companies.map((row) => row.id)).toEqual([1]);
    expect(service.companies(user("seller", 11)).companies).toHaveLength(0);
  });

  it("requires seller association for product queries", () => {
    expect(service.products(user("seller", 10), 1).products).toHaveLength(1);
    expect(() => service.products(user("seller", 10), 3)).toThrow();
  });

  it("preserves the admin company count and inactive filter", () => {
    const result = service.adminCompanies(user("admin"), "", "inactive");
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]?.product_count).toBe(1);
  });

  it("filters products by tenant, company, active flag and name", () => {
    expect(service.adminProducts(user("admin"), "", "", "all").products).toHaveLength(2);
    expect(service.adminProducts(user("admin"), "1", "Produto A").products).toHaveLength(1);
    expect(service.adminProducts(user("admin"), "", "Produto C").products).toHaveLength(0);
  });
});
