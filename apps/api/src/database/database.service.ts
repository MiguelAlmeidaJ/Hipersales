import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { EnvService } from "../config/env.service.js";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: DatabaseSync;

  constructor(env: EnvService) {
    if (!existsSync(env.databasePath)) {
      throw new Error(`SQLite database not found: ${env.databasePath}. Refusing to initialize an empty production database.`);
    }
    this.db = new DatabaseSync(env.databasePath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
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
