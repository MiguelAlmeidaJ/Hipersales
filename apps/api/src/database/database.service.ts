import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EnvService } from "../config/env.service.js";
import { SQLITE_SCHEMA } from "./schema.js";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: DatabaseSync;

  constructor(env: EnvService) {
    mkdirSync(dirname(env.databasePath), { recursive: true });
    this.db = new DatabaseSync(env.databasePath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(SQLITE_SCHEMA);
    if (!this.db.prepare("SELECT id FROM tenants WHERE id=1").get()) {
      this.db.prepare(`INSERT INTO tenants (id,name,slug,status,owner_email,created_at)
        VALUES (1,'HiperMix Representacoes','hipermix','active',NULL,?)`).run(new Date().toISOString());
    }
  }

  transaction<T>(callback: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = callback();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}
