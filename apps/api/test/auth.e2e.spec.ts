import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/password.js";
import { ApiExceptionFilter } from "../src/common/filters/api-exception.filter.js";

describe("authentication API", () => {
  let app: INestApplication;
  let temporaryDirectory: string;

  beforeAll(async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "hipersales-api-"));
    const databasePath = join(temporaryDirectory, "test.sqlite3");
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE tenants (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        tenant_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        communication_email TEXT,
        whatsapp_phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_super_admin INTEGER NOT NULL DEFAULT 0,
        is_dev INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        password_updated_at TEXT
      );
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    database.prepare("INSERT INTO tenants (id, name) VALUES (?, ?)").run(1, "HiperMix");
    database
      .prepare(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(1, 1, "Admin Teste", "admin", hashPassword("senha-atual-segura"), "admin");
    database.close();

    process.env.NODE_ENV = "test";
    process.env.HYPERSALES_DB_PATH = databasePath;
    process.env.HYPERSALES_PUBLIC_URL = "http://127.0.0.1";
    process.env.HYPERSALES_ALLOWED_ORIGINS = "http://127.0.0.1";

    app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
    app.use(express.json({ limit: "5mb", strict: true }));
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("rejects an unauthenticated request with the legacy error contract", async () => {
    const response = await request(app.getHttpServer()).get("/api/me").expect(401);
    expect(response.body).toEqual({ error: "Sessao expirada. Faca login novamente." });
  });

  it("rejects cross-site mutations", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/login")
      .set("Origin", "https://evil.example")
      .send({ username: "admin", password: "senha-atual-segura" })
      .expect(403);
    expect(response.body).toEqual({ error: "Origem da requisicao nao permitida." });
  });

  it("validates the contract and does not accept extra fields", async () => {
    await request(app.getHttpServer())
      .post("/api/login")
      .send({ username: "admin", password: "senha-atual-segura", role: "admin" })
      .expect(400);
  });

  it("creates an HttpOnly session and resolves /api/me", async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post("/api/login")
      .send({ username: "admin", password: "senha-atual-segura" })
      .expect(200);

    const cookie = login.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("hypersales_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const session = await agent.get("/api/me").expect(200);
    expect(session.body.user).toMatchObject({ email: "admin", role: "admin", is_super_admin: false });
  });

  it("enforces the stronger password contract", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post("/api/login")
      .send({ username: "admin", password: "senha-atual-segura" })
      .expect(200);

    await agent
      .post("/api/me/password")
      .send({ current_password: "senha-atual-segura", new_password: "curta" })
      .expect(400);
  });
});
