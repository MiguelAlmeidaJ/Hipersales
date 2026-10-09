import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { PublicUser } from "@hipersales/contracts";
import { RegistrationRequestsService } from "../src/customers/registration-requests.service.js";

describe("registration request admin listing", () => {
  it("scopes requests to tenant and exposes seller contact details", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT,
        email TEXT, communication_email TEXT, whatsapp_phone TEXT);
      CREATE TABLE registration_requests (id INTEGER PRIMARY KEY, tenant_id INTEGER,
        seller_id INTEGER, legal_name TEXT, created_at TEXT, status TEXT);
      INSERT INTO users VALUES
        (10,1,'Representante A','a@teste.com','vendas@teste.com','31999999999'),
        (20,2,'Representante B','b@teste.com',NULL,NULL);
      INSERT INTO registration_requests VALUES
        (1,1,10,'Cliente A','2026-10-01','pendente'),
        (2,2,20,'Cliente B','2026-10-02','pendente');
    `);
    const service = new RegistrationRequestsService({ db } as DatabaseService);
    const tenantOne = { tenant_id: 1 } as PublicUser;
    const result = service.list(tenantOne).requests as Array<Record<string,unknown>>;
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id:1,seller_name:"Representante A",seller_email:"vendas@teste.com",
    });
    expect(result.some(row => row.legal_name === "Cliente B")).toBe(false);
    db.close();
  });
});
