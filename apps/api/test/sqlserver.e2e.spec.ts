import { describe, expect, it } from "vitest";
import { SqlServerReadService } from "../src/database/sqlserver-read.service.js";
import { SqlServerWriteService } from "../src/database/sqlserver-write.service.js";
import type { EnvService } from "../src/config/env.service.js";

// Opt-in: connects to imported SQL Server but NEVER writes or modifies data.
// Enable in a local terminal with HIPERSALES_SQLSERVER_E2E=true.
const enabled = process.env.HIPERSALES_SQLSERVER_E2E === "true";
const suite = enabled ? describe : describe.skip;

suite("SQL Server imported data (read-only integration)", () => {
  it("fetches the imported user count using parameterized T-SQL", async () => {
    const env = {
      sqlserverDatabaseUrl: process.env.SQLSERVER_DATABASE_URL ?? "",
      databasePoolSize: 3,
    } as EnvService;
    const reader = new SqlServerReadService(env);
    const writer = new SqlServerWriteService(reader);
    try {
      const rows = await reader.query("SELECT COUNT_BIG(*) AS total FROM dbo.users WHERE tenant_id = ?", [1]);
      expect(Number(rows[0]?.total)).toBeGreaterThan(0);
      const transactionalRows = await writer.transaction(async () =>
        writer.query("SELECT TOP (1) id, email FROM dbo.users WHERE tenant_id = ? ORDER BY id", [1]),
      );
      expect(transactionalRows.length).toBe(1);
      expect(Number(transactionalRows[0]?.id)).toBeGreaterThan(0);
    } finally {
      await reader.onModuleDestroy();
    }
  }, 20000);
});
