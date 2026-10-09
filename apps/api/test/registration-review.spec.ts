import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { RegistrationReviewService } from "../src/customers/registration-review.service.js";
import type { ApprovalNotificationsService } from "../src/customers/approval-notifications.service.js";

const admin={id:1,role:"admin",tenant_id:1} as PublicUser;
function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE registration_requests (id INTEGER PRIMARY KEY,tenant_id INTEGER,seller_id INTEGER,
      status TEXT DEFAULT 'pendente',legal_name TEXT,trade_name TEXT,cnpj TEXT,state_registration TEXT,
      address TEXT,phone TEXT,email TEXT,notes TEXT,form_payload TEXT);
    CREATE TABLE customers (id INTEGER PRIMARY KEY,tenant_id INTEGER,legal_name TEXT,trade_name TEXT,
      cnpj TEXT,state_registration TEXT,address TEXT,phone TEXT,email TEXT,form_payload TEXT,active INTEGER,created_at TEXT);
    CREATE TABLE customer_sellers(customer_id INTEGER,seller_id INTEGER,UNIQUE(customer_id,seller_id));
    INSERT INTO registration_requests VALUES
      (1,1,10,'pendente','Empresa A','Fantasia','12.345.678/0001-90','','Rua A','319999','','','{}'),
      (2,2,20,'pendente','Empresa B','Outra','98.765.432/0001-10','','Rua B','','','','{}');
  `);
  const database={db,transaction:<T>(fn:()=>T):T=>{
    db.exec("BEGIN IMMEDIATE");
    try{const v=fn();db.exec("COMMIT");return v}
    catch(e){db.exec("ROLLBACK");throw e}
  }} as DatabaseService;
  const notifications = {queue: () => undefined} as unknown as ApprovalNotificationsService;
  return {db,review:new RegistrationReviewService(database,notifications)};
}
describe("registration review",()=>{
  it("rejects cross-tenant modifications without data changes",()=>{
    const {db,review}=fixture();
    expect(()=>review.review(admin,2,{status:"aprovada"})).toThrow();
    expect(db.prepare("SELECT status FROM registration_requests WHERE id=2").get()).toMatchObject({status:"pendente"});
    db.close();
  });
  it("approves and assigns a customer in one transaction",()=>{
    const {db,review}=fixture();
    review.review(admin,1,{status:"aprovada"});
    expect(db.prepare("SELECT active FROM customers").get()).toMatchObject({active:1});
    expect(db.prepare("SELECT seller_id FROM customer_sellers").get()).toMatchObject({seller_id:10});
    review.review(admin,1,{status:"aprovada"});
    expect(db.prepare("SELECT COUNT(*) AS total FROM customers").get()).toMatchObject({total:1});
    db.close();
  });
  it("preserves customer records on invalid statuses",()=>{
    const {db,review}=fixture();
    expect(()=>review.review(admin,1,{status:"desconhecido"})).toThrow();
    expect(db.prepare("SELECT status FROM registration_requests WHERE id=1").get()).toMatchObject({status:"pendente"});
    db.close();
  });
});
