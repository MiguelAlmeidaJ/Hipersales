import { DatabaseSync } from "node:sqlite";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { describe, expect, it } from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import { verifyPassword } from "../src/auth/password.js";
import { UsersService } from "../src/users/users.service.js";

const admin = {
  id: 1,
  tenant_id: 1,
  tenant_name: "HiperMix",
  name: "Admin",
  email: "admin",
  role: "admin",
  is_super_admin: false,
  is_dev: false,
  active: true,
  must_change_password: false,
} as PublicUser;

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE tenants (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, communication_email TEXT, whatsapp_phone TEXT,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, is_super_admin INTEGER DEFAULT 0,
      is_dev INTEGER DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0, password_updated_at TEXT, created_at TEXT
    );
    CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER, expires_at INTEGER, created_at TEXT);
    INSERT INTO tenants VALUES (1, 'HiperMix'), (2, 'Outra');
    INSERT INTO users
      (id, tenant_id, name, email, password_hash, role, active, must_change_password, created_at)
      VALUES
      (1, 1, 'Admin', 'admin', 'hash', 'admin', 1, 0, 'now'),
      (2, 1, 'Vendedor', 'seller', 'hash', 'seller', 1, 0, 'now'),
      (3, 2, 'Outro tenant', 'other', 'hash', 'admin', 1, 0, 'now');
    INSERT INTO sessions VALUES ('current', 1, 9999999999, 'now'), ('old', 1, 9999999999, 'now'),
      ('seller-session', 2, 9999999999, 'now');
  `);
  const database = {
    db,
    transaction: <T>(callback: () => T): T => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = callback();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  } as DatabaseService;
  return { db, service: new UsersService(database) };
}

describe("users service", () => {
  it("lists only non-super-admin users from the current tenant", () => {
    const { db, service } = fixture();
    db.exec(`INSERT INTO users
      (tenant_id, name, email, password_hash, role, active, is_super_admin)
      VALUES (1, 'Oculto', 'root', 'hash', 'admin', 1, 1)`);
    expect(service.list(admin).users.map((user) => user.email)).toEqual(["admin", "seller"]);
  });

  it("creates a normalized user with a forced temporary password change", () => {
    const { db, service } = fixture();
    const result = service.create(admin, {
      name: "Novo Vendedor",
      email: "Novo@empresa.test",
      communication_email: "NOVO@EXAMPLE.COM",
      whatsapp_phone: "(32) 99914-1230",
      role: "seller",
      active: true,
      temporary_password: "temporaria-segura",
    });
    expect(result.user).toMatchObject({
      email: "novo",
      communication_email: "novo@example.com",
      whatsapp_phone: "5532999141230",
      must_change_password: true,
    });
    const stored = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(result.id!) as {
      password_hash: string;
    };
    expect(verifyPassword("temporaria-segura", stored.password_hash)).toBe(true);
  });

  it("enforces tenant isolation on updates", () => {
    const { service } = fixture();
    expect(() => service.update(admin, 3, { name: "Invasao" }, "current")).toThrow(NotFoundException);
  });

  it("prevents self-demotion and removal of the last active admin", () => {
    const { service } = fixture();
    expect(() => service.update(admin, 1, { role: "seller" }, "current")).toThrow(BadRequestException);
    expect(() => service.update(admin, 1, { active: false }, "current")).toThrow(BadRequestException);

    const otherAdmin = { ...admin, id: 9 };
    expect(() => service.update(otherAdmin, 1, { active: false }, "other-session")).toThrow(
      ConflictException,
    );
  });

  it("revokes all sessions of another user after a credential change", () => {
    const { db, service } = fixture();
    const result = service.update(
      admin,
      2,
      { temporary_password: "outra-senha-segura" },
      "current",
    );
    expect(result.user.must_change_password).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS total FROM sessions WHERE user_id = 2").get()).toEqual({ total: 0 });
  });
});
