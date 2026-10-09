import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import type { PublicUser } from "@hipersales/contracts";
import { ProposalDeletionService } from "../src/proposals/proposal-deletion.service.js";

const admin = { id: 1, tenant_id: 1, role: "admin" } as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE proposals (id INTEGER PRIMARY KEY,tenant_id INTEGER);
    CREATE TABLE proposal_items (id INTEGER PRIMARY KEY,proposal_id INTEGER);
    CREATE TABLE proposal_events (id INTEGER PRIMARY KEY,proposal_id INTEGER);
    INSERT INTO proposals VALUES (10,1),(20,2);
    INSERT INTO proposal_items VALUES (1,10),(2,20);
    INSERT INTO proposal_events VALUES (1,10),(2,20);
  `);
  const database = {
    db,
    transaction: <T>(fn: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try { const result=fn(); db.exec("COMMIT"); return result; }
      catch(error) { db.exec("ROLLBACK"); throw error; }
    },
  } as DatabaseService;
  return { db, service: new ProposalDeletionService(database) };
}
describe("proposal deletion", () => {
  it("deletes only selected tenant order and its dependencies", () => {
    const {db,service}=fixture();
    expect(service.delete(admin,10)).toEqual({message:"Pedido excluido definitivamente."});
    expect(db.prepare("SELECT id FROM proposals").all()).toEqual([{id:20,tenant_id:2}].map(({id})=>({id,tenant_id:2})));
    expect(db.prepare("SELECT COUNT(*) AS n FROM proposal_items").get()).toMatchObject({n:1});
    expect(db.prepare("SELECT COUNT(*) AS n FROM proposal_events").get()).toMatchObject({n:1});
    db.close();
  });
  it("blocks cross tenant deletion and unknown ids", () => {
    const {db,service}=fixture();
    expect(()=>service.delete(admin,20)).toThrow();
    expect(()=>service.delete(admin,999)).toThrow();
    expect(db.prepare("SELECT COUNT(*) AS n FROM proposals").get()).toMatchObject({n:2});
    db.close();
  });
});
