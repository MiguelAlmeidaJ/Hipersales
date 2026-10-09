import { DatabaseSync } from "node:sqlite";
import { describe,expect,it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { PublicUser } from "@hipersales/contracts";
import { ProposalCreationService } from "../src/proposals/proposal-creation.service.js";
import { ProposalNotificationService } from "../src/proposals/proposal-notification.service.js";

const seller={id:10,tenant_id:1,role:"seller"} as PublicUser;
const order={company_id:1,customer_id:1,order_type:"Pedido",freight_type:"CIF",delivery_type:"Normal",payment_terms:"30 dias",
  items:[{product_id:1,quantity:2,negotiated_price:25}]};
function setup(){
 const db=new DatabaseSync(":memory:");
 db.exec(`
 CREATE TABLE companies(id INTEGER PRIMARY KEY,tenant_id INTEGER,active INTEGER);
 CREATE TABLE customers(id INTEGER PRIMARY KEY,tenant_id INTEGER,active INTEGER,legal_name TEXT,cnpj TEXT);
 CREATE TABLE users(id INTEGER PRIMARY KEY,tenant_id INTEGER,role TEXT,active INTEGER,name TEXT);
 CREATE TABLE company_sellers(company_id INTEGER,seller_id INTEGER);
 CREATE TABLE customer_sellers(customer_id INTEGER,seller_id INTEGER,UNIQUE(customer_id,seller_id));
 CREATE TABLE products(id INTEGER PRIMARY KEY,tenant_id INTEGER,company_id INTEGER,active INTEGER);
 CREATE TABLE proposals(id INTEGER PRIMARY KEY,tenant_id INTEGER,order_number INTEGER,seller_id INTEGER,company_id INTEGER,customer_id INTEGER,order_type TEXT,purchase_order TEXT,commission_percent REAL,invoice_type TEXT,tax_operator_invoice INTEGER,freight_type TEXT,delivery_type TEXT,scheduled_delivery_date TEXT,discount_percent REAL,discount_on TEXT,payment_terms TEXT,notes TEXT,status TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE proposal_items(id INTEGER PRIMARY KEY,proposal_id INTEGER,product_id INTEGER,quantity REAL,negotiated_price REAL);
 CREATE TABLE proposal_events(id INTEGER PRIMARY KEY,proposal_id INTEGER,status TEXT,title TEXT,notes TEXT,created_by INTEGER,created_at TEXT);
 CREATE TABLE email_outbox(id INTEGER PRIMARY KEY,tenant_id INTEGER,kind TEXT,recipients TEXT,subject TEXT,body TEXT,created_at TEXT);
 INSERT INTO companies VALUES (1,1,1),(2,2,1);
 INSERT INTO customers VALUES (1,1,1,'Cliente A','123'),(2,2,1,'Cliente B','456');
 INSERT INTO users VALUES (10,1,'seller',1,'Maria'),(20,2,'seller',1,'Joao');
 INSERT INTO company_sellers VALUES (1,10);
 INSERT INTO customer_sellers VALUES (1,10);
 INSERT INTO products VALUES (1,1,1,1),(2,2,2,1);
 `);
 const database={db,transaction:<T>(fn:()=>T):T=>{db.exec("BEGIN IMMEDIATE");try{const result=fn();db.exec("COMMIT");return result}catch(e){db.exec("ROLLBACK");throw e}}} as DatabaseService;
 return {db,service:new ProposalCreationService(database,new ProposalNotificationService(database))};
}
describe("proposal creation",()=>{
 it("creates orders, items, event and sequential identifiers",()=>{
   const {db,service}=setup();
   expect(service.create(seller,order).order_number).toBe(10840);
   expect(service.create(seller,order).order_number).toBe(10841);
   expect(db.prepare("SELECT COUNT(*) AS n FROM proposal_items").get()).toMatchObject({n:2});
   expect(db.prepare("SELECT COUNT(*) AS n FROM proposal_events").get()).toMatchObject({n:2});
   expect(db.prepare("SELECT COUNT(*) AS n FROM email_outbox").get()).toMatchObject({n:2});
   db.close();
 });
 it("rejects cross tenant products without leaving partial records",()=>{
   const {db,service}=setup();
   expect(()=>service.create(seller,{...order,items:[{product_id:2,quantity:1,negotiated_price:5}]})).toThrow();
   expect(db.prepare("SELECT COUNT(*) AS n FROM proposals").get()).toMatchObject({n:0});
   db.close();
 });
 it("prevents a seller from impersonating another seller or using foreign customers",()=>{
   const {db,service}=setup();
   expect(()=>service.create(seller,{...order,seller_id:20})).toThrow();
   expect(()=>service.create(seller,{...order,customer_id:2})).toThrow();
   db.close();
 });
 it("rejects bad quantity and invalid payment terms",()=>{
   const {db,service}=setup();
   expect(()=>service.create(seller,{...order,items:[{product_id:1,quantity:-1,negotiated_price:1}]})).toThrow();
   expect(()=>service.create(seller,{...order,payment_terms:""})).toThrow();
   db.close();
 });
});
