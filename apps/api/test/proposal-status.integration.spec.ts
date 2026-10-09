import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@hipersales/contracts";
import type { DatabaseService } from "../src/database/database.service.js";
import { ProposalUpdateService } from "../src/proposals/proposal-update.service.js";
import { ProposalStatusNotificationsService } from "../src/proposals/proposal-status-notifications.service.js";

const admin = {id:1,role:"admin",tenant_id:1} as PublicUser;

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE proposals (
      id INTEGER PRIMARY KEY,tenant_id INTEGER,order_number INTEGER,seller_id INTEGER,company_id INTEGER,
      customer_id INTEGER,status TEXT,admin_notes TEXT,delivery_forecast TEXT,industry_order_number TEXT,
      invoice_number TEXT,order_type TEXT,purchase_order TEXT,commission_percent REAL,invoice_type TEXT,
      tax_operator_invoice INTEGER,freight_type TEXT,delivery_type TEXT,scheduled_delivery_date TEXT,
      discount_percent REAL,discount_on TEXT,payment_terms TEXT,notes TEXT,updated_at TEXT,created_at TEXT);
    CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT,communication_email TEXT,whatsapp_phone TEXT);
    CREATE TABLE customers(id INTEGER PRIMARY KEY,legal_name TEXT,trade_name TEXT,cnpj TEXT,address TEXT);
    CREATE TABLE companies(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE products(id INTEGER PRIMARY KEY,tenant_id INTEGER,company_id INTEGER,active INTEGER,code TEXT,name TEXT,unit TEXT);
    CREATE TABLE proposal_items(id INTEGER PRIMARY KEY,proposal_id INTEGER,product_id INTEGER,quantity REAL,negotiated_price REAL);
    CREATE TABLE proposal_events(id INTEGER PRIMARY KEY,proposal_id INTEGER,status TEXT,title TEXT,notes TEXT,created_by INTEGER,created_at TEXT);
    CREATE TABLE tenant_settings(tenant_id INTEGER,key TEXT,value TEXT);
    CREATE TABLE system_settings(key TEXT,value TEXT);
    CREATE TABLE email_outbox(id INTEGER PRIMARY KEY,tenant_id INTEGER,kind TEXT,recipients TEXT,subject TEXT,body TEXT,created_at TEXT);
    INSERT INTO users VALUES (10,'Maria','maria@teste.com','vendas@teste.com','31999999999');
    INSERT INTO customers VALUES (20,'Cliente Teste','Fantasia','123','Rua A');
    INSERT INTO companies VALUES (30,'Industria A');
    INSERT INTO products VALUES (40,1,30,1,'A01','Produto A','UN');
    INSERT INTO proposals
      (id,tenant_id,order_number,seller_id,company_id,customer_id,status,order_type,
       payment_terms,freight_type,delivery_type,discount_percent,commission_percent,created_at)
      VALUES (50,1,10840,10,30,20,'em_analise','Pedido','30 dias','CIF','Normal',0,0,'2026-10-09T15:00:00-03:00'),
             (51,2,10841,10,30,20,'em_analise','Pedido','30 dias','CIF','Normal',0,0,'2026-10-09T15:00:00-03:00');
    INSERT INTO proposal_items VALUES(1,50,40,2,25.5);
  `);
  const database={db,transaction:<T>(fn:()=>T):T=>{
    db.exec("BEGIN IMMEDIATE");
    try{const value=fn();db.exec("COMMIT");return value;}
    catch(error){db.exec("ROLLBACK");throw error;}
  }} as DatabaseService;
  const notifications=new ProposalStatusNotificationsService(database);
  return {db, service:new ProposalUpdateService(database,notifications)};
}
describe("proposal status integration",()=>{
  it("approves a proposal, queues two email messages and records one event",()=>{
    const {db,service}=fixture();
    expect(service.update(admin,50,{status:"pedido_aprovado"}).message).toBe("Status atualizado.");
    expect(db.prepare("SELECT status FROM proposals WHERE id=50").get()).toMatchObject({status:"pedido_aprovado"});
    const outbox=db.prepare("SELECT kind,body FROM email_outbox ORDER BY id").all() as {kind:string;body:string}[];
    expect(outbox.map(v=>v.kind)).toEqual(["status_update_seller","approved_order_backoffice"]);
    expect(outbox[1]?.body).toContain("Item 01: A01");
    expect(db.prepare("SELECT COUNT(*) AS count FROM proposal_events").get()).toMatchObject({count:1});
    expect(service.update(admin,50,{status:"pedido_aprovado"}).message).toBe("Pedido atualizado.");
    expect(db.prepare("SELECT COUNT(*) AS count FROM email_outbox").get()).toMatchObject({count:2});
    db.close();
  });
  it("prevents cross-tenant updates and status regression",()=>{
    const {db,service}=fixture();
    expect(()=>service.update(admin,51,{status:"faturado"})).toThrow();
    service.update(admin,50,{status:"faturado"});
    expect(()=>service.update(admin,50,{status:"em_analise"})).toThrow();
    expect(db.prepare("SELECT status FROM proposals WHERE id=50").get()).toMatchObject({status:"faturado"});
    db.close();
  });
  it("queues rejection and optional WhatsApp once, with no duplicate on retry",()=>{
    const {db,service}=fixture();
    db.prepare("INSERT INTO tenant_settings (tenant_id,key,value) VALUES (1,'whatsapp',?)").run(JSON.stringify({enabled:true}));
    service.update(admin,50,{status:"proposta_recusada"});
    expect(db.prepare("SELECT status FROM proposals WHERE id=50").get()).toMatchObject({status:"recusado"});
    expect(db.prepare("SELECT COUNT(*) AS count FROM email_outbox").get()).toMatchObject({count:2});
    service.update(admin,50,{status:"recusado"});
    expect(db.prepare("SELECT COUNT(*) AS count FROM email_outbox").get()).toMatchObject({count:2});
    db.close();
  });
  it("rolls back order changes if the outbox cannot be written",()=>{
    const {db,service}=fixture();
    db.exec("DROP TABLE email_outbox");
    expect(()=>service.update(admin,50,{status:"pedido_aprovado"})).toThrow();
    expect(db.prepare("SELECT status FROM proposals WHERE id=50").get()).toMatchObject({status:"em_analise"});
    expect(db.prepare("SELECT COUNT(*) AS count FROM proposal_events").get()).toMatchObject({count:0});
    db.close();
  });
});
