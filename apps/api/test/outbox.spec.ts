import { DatabaseSync } from "node:sqlite";
import { describe,expect,it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { AuthenticatedRequest } from "../src/common/http/authenticated-request.js";
import { OutboxController } from "../src/occurrences/outbox.controller.js";
describe("admin outbox tenant isolation",()=>{
 it("returns newest 20 messages from current tenant",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE email_outbox (id INTEGER PRIMARY KEY,tenant_id INTEGER,kind TEXT)");
  for(let id=1;id<=23;id++) db.prepare("INSERT INTO email_outbox VALUES (?,?,?)").run(id,id===23?2:1,"test");
  const controller=new OutboxController({db} as DatabaseService);
  const req={user:{id:1,role:"admin",tenant_id:1}} as AuthenticatedRequest;
  const rows=controller.list(req).outbox as {id:number;tenant_id:number}[];
  expect(rows).toHaveLength(20);
  expect(rows[0]?.id).toBe(22);
  expect(rows[19]?.id).toBe(3);
  expect(rows.every(x=>x.tenant_id===1)).toBe(true);
  db.close();
 });
});
