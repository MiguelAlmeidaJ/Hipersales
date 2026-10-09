import { DatabaseSync } from "node:sqlite";
import { describe,expect,it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { PublicUser } from "@hipersales/contracts";
import { OccurrencesService } from "../src/occurrences/occurrences.service.js";
import { OccurrenceCreationService,decodeOccurrenceAttachments } from "../src/occurrences/occurrence-creation.service.js";
const seller={id:10,role:"seller",tenant_id:1} as PublicUser;
function setup(){
 const db=new DatabaseSync(":memory:");
 db.exec(`
 CREATE TABLE customers(id INTEGER PRIMARY KEY,tenant_id INTEGER,active INTEGER,legal_name TEXT,cnpj TEXT);
 CREATE TABLE users(id INTEGER PRIMARY KEY,tenant_id INTEGER,role TEXT,active INTEGER);
 CREATE TABLE customer_sellers(customer_id INTEGER,seller_id INTEGER);
 CREATE TABLE occurrences(id INTEGER PRIMARY KEY,tenant_id INTEGER,seller_id INTEGER,customer_id INTEGER,reason TEXT,description TEXT,attachment_names TEXT,status TEXT,resolution TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE occurrence_events(id INTEGER PRIMARY KEY,occurrence_id INTEGER,tenant_id INTEGER,status TEXT,title TEXT,notes TEXT,created_by INTEGER,created_at TEXT);
 CREATE TABLE occurrence_attachments(id INTEGER PRIMARY KEY,occurrence_id INTEGER,tenant_id INTEGER,filename TEXT,mimetype TEXT,content BLOB,created_at TEXT);
 CREATE TABLE email_outbox(id INTEGER PRIMARY KEY,tenant_id INTEGER,kind TEXT,recipients TEXT,subject TEXT,body TEXT,created_at TEXT);
 INSERT INTO customers VALUES (1,1,1,'Cliente A','123'),(2,2,1,'Cliente B','456');
 INSERT INTO users VALUES (10,1,'seller',1);
 INSERT INTO customer_sellers VALUES(1,10);
 `);
 const database={db,transaction:<T>(fn:()=>T):T=>{db.exec("BEGIN IMMEDIATE");try{const result=fn();db.exec("COMMIT");return result;}catch(e){db.exec("ROLLBACK");throw e;}}} as DatabaseService;
 return {db,service:new OccurrenceCreationService(database),occurrences:new OccurrencesService(database)};
}
describe("occurrence creation",()=>{
 it("creates case, event, binary attachment and email outbox in one transaction",()=>{
  const {db,service,occurrences}=setup();
  const result=service.create(seller,{customer_id:1,reason:"Entrega",description:"Atraso",
    attachments:[{filename:"foto.txt",mimetype:"text/plain",content:Buffer.from("teste").toString("base64")}]});
  expect(result.id).toBeGreaterThan(0);
  expect(db.prepare("SELECT attachment_names FROM occurrences").get()).toMatchObject({attachment_names:'["foto.txt"]'});
  expect(db.prepare("SELECT COUNT(*) AS total FROM occurrence_events").get()).toMatchObject({total:1});
  expect(db.prepare("SELECT COUNT(*) AS total FROM occurrence_attachments").get()).toMatchObject({total:1});
  expect(db.prepare("SELECT kind FROM email_outbox").get()).toMatchObject({kind:"occurrence_created"});
  const file=occurrences.attachment(seller,result.id,1);
  expect(file.content.toString()).toBe("teste");
  expect(()=>occurrences.attachment({...seller,id:20},result.id,1)).toThrow();
  expect(()=>occurrences.attachment({...seller,tenant_id:2},result.id,1)).toThrow();
  db.close();
 });
 it("rejects an unassigned or foreign-tenant customer",()=>{
  const {db,service}=setup();
  expect(()=>service.create(seller,{customer_id:2,reason:"Entrega",description:"Teste"})).toThrow();
  expect(db.prepare("SELECT COUNT(*) AS total FROM occurrences").get()).toMatchObject({total:0});
  db.close();
 });
 it("rejects corrupt attachments and rejects outbox failures atomically",()=>{
  expect(()=>decodeOccurrenceAttachments([{filename:"bad",content:"???"}])).toThrow();
  const {db,service}=setup();
  db.exec("DROP TABLE email_outbox");
  expect(()=>service.create(seller,{customer_id:1,reason:"A",description:"B"})).toThrow();
  expect(db.prepare("SELECT COUNT(*) AS total FROM occurrences").get()).toMatchObject({total:0});
  db.close();
 });
});
