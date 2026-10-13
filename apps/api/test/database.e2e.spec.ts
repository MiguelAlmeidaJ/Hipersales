import { describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { DatabaseRepository } from "../src/database/database.repository.js";
import { PrismaService } from "../src/database/prisma.service.js";
import type { EnvService } from "../src/config/env.service.js";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });

// Opt-in: connects to the imported operational database but never writes data.
// Enable in a local terminal with HIPERSALES_DATABASE_E2E=true.
const enabled = process.env.HIPERSALES_DATABASE_E2E === "true";
const suite = enabled ? describe : describe.skip;

suite("imported database (read-only integration)", () => {
  it("fetches the imported user count through Prisma", async () => {
    const env = {
      databaseUrl: process.env.SQLSERVER_DATABASE_URL ?? "",
      databasePoolSize: 3,
    } as EnvService;
    const prisma = new PrismaService(env);
    const repository = new DatabaseRepository(prisma);
    try {
      await prisma.onModuleInit();
      const rows = await repository.query("SELECT COUNT_BIG(*) AS total FROM dbo.users WHERE tenant_id = ?", [1]);
      expect(Number(rows[0]?.total)).toBeGreaterThan(0);
      const transactionalRows = await repository.transaction(async () =>
        repository.query("SELECT TOP (1) id, email FROM dbo.users WHERE tenant_id = ? ORDER BY id", [1]),
      );
      expect(transactionalRows.length).toBe(1);
      expect(Number(transactionalRows[0]?.id)).toBeGreaterThan(0);
    } finally {
      await prisma.onModuleDestroy();
    }
  }, 20000);
});
