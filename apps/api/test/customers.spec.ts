import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { CustomersService } from "../src/customers/customers.service.js";

const account = (role: "admin" | "seller", id = 1, tenant_id = 1): PublicUser => ({
  id, name: "Tester", email: "tester", role, tenant_id,
  is_super_admin: false, is_dev: false, active: true, must_change_password: false,
});

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY, tenant_id INTEGER, legal_name TEXT,
      trade_name TEXT, cnpj TEXT, phone TEXT, email TEXT, address TEXT,
      state_registration TEXT, form_payload TEXT, active INTEGER
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, name TEXT, email TEXT, communication_email TEXT
    );
    CREATE TABLE customer_sellers (customer_id INTEGER, seller_id INTEGER);
    INSERT INTO customers VALUES
      (1,1,'Cliente Alpha','Alpha','111','','','',NULL,'{"buyer_phone_1":"31999999999","buyer_email":"compras@alpha.com"}',1),
      (2,1,'Cliente Beta','Beta','222',NULL,NULL,NULL,NULL,'{}',0),
      (3,2,'Cliente Outro','Outro','333',NULL,NULL,NULL,NULL,'{}',1);
    INSERT INTO users VALUES (10,'Vendedor Dez','usuario10','vendas@teste.com');
    INSERT INTO customer_sellers VALUES (1,10),(3,10);
  `);
  return { db, service: new CustomersService({ db } as DatabaseService) };
}

describe("customer listing contract", () => {
  it("returns active customers in the correct tenant and enriches stored form fields", () => {
    const { db, service } = fixture();
    const data = service.list(account("admin")).customers;
    expect(data.map(row => row.id)).toEqual([1]);
    expect(data[0]?.phone).toBe("31999999999");
    expect(data[0]?.email).toBe("compras@alpha.com");
    expect(data[0]?.form_payload).toMatchObject({buyer_phone_1:"31999999999"});
    db.close();
  });

  it("restricts seller records using customer_sellers and tenant_id", () => {
    const { db, service } = fixture();
    expect(service.list(account("seller",10)).customers.map(row => row.id)).toEqual([1]);
    expect(service.list(account("seller",11)).customers).toHaveLength(0);
    db.close();
  });

  it("returns admin metadata, filters inactive and never leaks another tenant", () => {
    const { db, service } = fixture();
    const inactive = service.adminList(account("admin"), "", "inactive").customers;
    expect(inactive.map(row => row.id)).toEqual([2]);
    const active = service.adminList(account("admin"), "Alpha", "active").customers;
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({seller_name:"Vendedor Dez",seller_count:1});
    expect(service.adminList(account("admin",1,2)).customers.map(row => row.id)).toEqual([3]);
    db.close();
  });
});
