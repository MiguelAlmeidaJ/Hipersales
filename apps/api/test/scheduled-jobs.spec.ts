import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { EnvService } from "../src/config/env.service.js";
import type { DatabaseService } from "../src/database/database.service.js";
import { SQLITE_SCHEMA } from "../src/database/schema.js";
import { GoalsService } from "../src/goals/goals.service.js";
import { ScheduledJobsService } from "../src/jobs/scheduled-jobs.service.js";
import { SettingsService } from "../src/settings/settings.service.js";

describe("scheduled jobs", () => {
  it("queues weekly summaries and goal reminders idempotently", async () => {
    const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON"); db.exec(SQLITE_SCHEMA);
    const now = new Date("2026-01-30T15:00:00.000Z");
    db.prepare("INSERT INTO tenants VALUES (1,'HiperMix','hipermix','active',NULL,?)").run(now.toISOString());
    db.prepare(`INSERT INTO users (id,tenant_id,name,email,password_hash,role,active,created_at)
      VALUES (1,1,'Admin','admin@example.com','x','admin',1,?),(2,1,'Vendedor','seller@example.com','x','seller',1,?)`)
      .run(now.toISOString(), now.toISOString());
    db.prepare(`INSERT INTO seller_goals (tenant_id,seller_id,year,month,sales_goal,updated_at)
      VALUES (1,2,2026,1,1000,?)`).run(now.toISOString());
    const database = { db } as DatabaseService;
    const env = { reportTimezone: "America/Sao_Paulo" } as EnvService;
    const service = new ScheduledJobsService(database, env, new GoalsService(database, env), new SettingsService(database));
    await expect(service.run(now)).resolves.toEqual({ weekly: 1, reminders: 1 });
    expect(db.prepare("SELECT kind FROM email_outbox ORDER BY id").all()).toEqual([
      { kind: "weekly_manager_report" }, { kind: "goal_reminder_email" },
    ]);
    await expect(service.run(now)).resolves.toEqual({ weekly: 0, reminders: 0 });
    expect(db.prepare("SELECT COUNT(*) total FROM email_outbox").get()).toEqual({ total: 2 });
    db.close();
  });
});
