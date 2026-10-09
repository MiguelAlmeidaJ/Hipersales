import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "../src/auth/password.js";
import type { EnvService } from "../src/config/env.service.js";
import { BootstrapAdminService } from "../src/database/bootstrap-admin.service.js";
import type { DatabaseService } from "../src/database/database.service.js";

function fixture(password = "senha-inicial-segura") {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,email TEXT UNIQUE,password_hash TEXT,
    role TEXT,active INTEGER,must_change_password INTEGER,password_updated_at TEXT,created_at TEXT);`);
  const env = { bootstrapAdminName: "Admin Inicial", bootstrapAdminEmail: "ADMIN",
    bootstrapAdminPassword: password } as EnvService;
  return { db, service: new BootstrapAdminService({ db } as DatabaseService, env) };
}

describe("initial administrator bootstrap", () => {
  it("creates one forced-password-change administrator without logging its secret", () => {
    const { db, service } = fixture();
    service.onApplicationBootstrap();
    service.onApplicationBootstrap();
    const rows = db.prepare("SELECT * FROM users").all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tenant_id: 1, name: "Admin Inicial", email: "admin", role: "admin", active: 1, must_change_password: 1 });
    expect(verifyPassword("senha-inicial-segura", String(rows[0]?.password_hash))).toBe(true);
    db.close();
  });

  it("refuses an empty database without strong bootstrap credentials", () => {
    const { db, service } = fixture("curta");
    expect(() => service.onApplicationBootstrap()).toThrow(/Banco sem administrador/);
    db.close();
  });
});
