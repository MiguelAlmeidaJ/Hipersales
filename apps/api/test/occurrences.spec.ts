import { DatabaseSync } from "node:sqlite";
import { describe,expect,it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { PublicUser } from "@hipersales/contracts";
import { OccurrencesService,occurrenceStatus } from "../src/occurrences/occurrences.service.js";
const admin={id:1,role:"admin",tenant_id:1} as PublicUser;
const seller={id:10,role:"seller",tenant_id:1} as PublicUser;
function fixture(){
 const db=new DatabaseSync(":memory:");
 db.exec(`
 CREATE TABLE occurrences(id INTEGER PRIMARY KEY,tenant_id INTEGER,seller_id INTEGER,customer_id INTEGER,
  status TEXT,resolution TEXT,resolved_at TEXT,reason TEXT,attachment_names TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT,communication_email TEXT);
 CREATE TABLE customers(id INTEGER PRIMARY KEY,legal_name TEXT,trade_name TEXT,cnpj TEXT,state_registration TEXT,address TEXT,phone TEXT,email TEXT);
 CREATE TABLE occurrence_events(id INTEGER PRIMARY KEY,occurrence_id INTEGER,tenant_id INTEGER,status TEXT,title TEXT,notes TEXT,created_by INTEGER,created_at TEXT);
 CREATE TABLE occurrence_attachments(id INTEGER PRIMARY KEY,occurrence_id INTEGER,tenant_id INTEGER,filename TEXT,mimetype TEXT,created_at TEXT);
 INSERT INTO users VALUES(10,'Maria','m@example.com',NULL),(20,'Joao','j@example.com',NULL);
 INSERT INTO customers VALUES(1,'Cliente','Loja','123','','','','');
 INSERT INTO occurrences VALUES
 (1,1,10,1,'aberta','',NULL,'Entrega','[]','2026-10-09','2026-10-09'),
 (2,1,20,1,'aberta','',NULL,'Fatura','[]','2026-10-09','2026-10-09'),
 (3,2,10,1,'aberta','',NULL,'Outro','[]','2026-10-09','2026-10-09');
 `);
 const database={db,transaction:<T>(fn:()=>T):T=>{db.exec("BEGIN IMMEDIATE");try{const v=fn();db.exec("COMMIT");return v;}catch(e){db.exec("ROLLBACK");throw e;}}} as DatabaseService;
 return {db,service:new OccurrencesService(database)};
}
describe("occurrence administration",()=>{
 it("lists only own cases for sellers and all tenant cases for admins",()=>{
  const {db,service}=fixture();
  expect(service.list(seller).occurrences.map(x=>x.id)).toEqual([1]);
  expect(service.list(admin).occurrences).toHaveLength(2);
  db.close();
 });
 it("records updates and avoids duplicate event entries",()=>{
  const {db,service}=fixture();
  service.update(admin,1,{status:"solucionado",resolution:"Resolvido"});
  expect(db.prepare("SELECT status FROM occurrences WHERE id=1").get()).toMatchObject({status:"solucionada"});
  service.update(admin,1,{status:"solucionada",resolution:"Resolvido"});
  expect(db.prepare("SELECT COUNT(*) AS n FROM occurrence_events").get()).toMatchObject({n:1});
  db.close();
 });
 it("restricts mutation by tenant and deletes only selected occurrence",()=>{
  const {db,service}=fixture();
  expect(()=>service.update(admin,3,{status:"em_analise"})).toThrow();
  expect(()=>service.delete(admin,3)).toThrow();
  service.delete(admin,1);
  expect(db.prepare("SELECT COUNT(*) AS n FROM occurrences").get()).toMatchObject({n:2});
  db.close();
 });
 it("expires old solved attachment rows without touching active or other tenant records",()=>{
  const {db,service}=fixture();
  db.prepare("UPDATE occurrences SET status='solucionada',resolved_at=? WHERE id=1").run("2020-01-01T00:00:00Z");
  db.exec("INSERT INTO occurrence_attachments VALUES(1,1,1,'antigo.txt','text/plain','2020-01-01')");
  db.exec("INSERT INTO occurrence_attachments VALUES(2,2,1,'ativo.txt','text/plain','2020-01-01')");
  db.exec("INSERT INTO occurrence_attachments VALUES(3,3,2,'outro.txt','text/plain','2020-01-01')");
  expect(service.cleanupExpiredAttachments(1)).toBe(1);
  expect(db.prepare("SELECT id FROM occurrence_attachments ORDER BY id").all()).toEqual([{id:2},{id:3}]);
  db.close();
 });
 it("deletes related attachment and timeline records with a case",()=>{
  const {db,service}=fixture();
  db.exec("INSERT INTO occurrence_attachments VALUES(1,1,1,'foto.txt','text/plain','2026-10-09')");
  db.exec("INSERT INTO occurrence_events VALUES(1,1,1,'aberta','Aberta','Teste',10,'2026-10-09')");
  service.delete(admin,1);
  expect(db.prepare("SELECT COUNT(*) AS n FROM occurrence_attachments").get()).toMatchObject({n:0});
  expect(db.prepare("SELECT COUNT(*) AS n FROM occurrence_events").get()).toMatchObject({n:0});
  db.close();
 });
 it("normalizes legacy status aliases",()=>{
  expect(occurrenceStatus("tratada")).toBe("solucionada");
  expect(occurrenceStatus("em_tratamento")).toBe("em_analise");
 });
});
