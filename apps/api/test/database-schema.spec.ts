import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EnvService } from "../src/config/env.service.js";
import { DatabaseService } from "../src/database/database.service.js";

describe("SQLite bootstrap", () => {
  it("creates a complete database without the former Python initializer", () => {
    const directory = mkdtempSync(join(tmpdir(), "hipersales-schema-"));
    const database = new DatabaseService({ databasePath: join(directory, "new.sqlite3") } as EnvService);
    const tables = database.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name:string}>;
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining([
      "tenants", "users", "sessions", "customers", "companies", "products", "proposals",
      "occurrences", "email_outbox", "tenant_settings", "seller_goals",
    ]));
    expect(database.db.prepare("SELECT name FROM tenants WHERE id=1").get()).toEqual({ name: "HiperMix Representacoes" });
    database.onModuleDestroy();
    rmSync(directory, { recursive: true, force: true });
  });
});
