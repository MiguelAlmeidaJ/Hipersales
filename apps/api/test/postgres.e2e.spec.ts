import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request, { type Agent } from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { ApiExceptionFilter } from "../src/common/filters/api-exception.filter.js";
import { hashPassword } from "../src/auth/password.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(testDatabaseUrl);
const suite = enabled ? describe : describe.skip;

suite("PostgreSQL API homologation", () => {
  let app: INestApplication;
  let agent: Agent;
  let pool: Pool;
  let sellerId = 0;
  let companyId = 0;
  let productId = 0;
  let customerId = 0;
  let proposalId = 0;
  let occurrenceId = 0;

  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!/(?:_test|_validation)$/.test(url.pathname)) {
      throw new Error("TEST_DATABASE_URL deve apontar para um banco terminado em _test ou _validation.");
    }
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = url.toString();
    process.env.HIPERSALES_SCHEDULED_JOBS = "false";
    process.env.HIPERSALES_OUTBOX_WORKER = "false";
    process.env.HYPERSALES_PUBLIC_URL = "http://localhost:8000";
    process.env.HYPERSALES_BOOTSTRAP_ADMIN_EMAIL = "";
    process.env.HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD = "";

    pool = new Pool({ connectionString: url.toString() });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const migration = await readFile(resolve(import.meta.dirname, "../prisma/migrations/20261013100000_init_postgresql/migration.sql"), "utf8");
    await pool.query(migration);
    const outboxMigration = await readFile(resolve(import.meta.dirname, "../prisma/migrations/20261013110000_outbox_lease/migration.sql"), "utf8");
    await pool.query(outboxMigration);
    const tenant = await pool.query(
      "INSERT INTO tenants (name,slug,status,created_at) VALUES ($1,$2,'active',NOW()) RETURNING id",
      ["Tenant PostgreSQL", "postgres-test"],
    );
    await pool.query(
      `INSERT INTO users (tenant_id,name,email,password_hash,role,active,is_super_admin,is_dev,must_change_password,created_at)
       VALUES ($1,$2,$3,$4,'admin',TRUE,FALSE,FALSE,FALSE,NOW())`,
      [tenant.rows[0].id, "Admin PostgreSQL", "postgres.admin", hashPassword("Postgres-Test-123!")],
    );
    const foreignTenant = await pool.query(
      "INSERT INTO tenants (name,slug,status,created_at) VALUES ('Outro tenant','foreign-test','active',NOW()) RETURNING id",
    );
    const foreignCompany = await pool.query(
      "INSERT INTO companies (tenant_id,name,active) VALUES ($1,'Empresa estrangeira',TRUE) RETURNING id",
      [foreignTenant.rows[0].id],
    );
    await pool.query(
      "INSERT INTO products (tenant_id,company_id,code,name,unit,price,active) VALUES ($1,$2,'FOREIGN','Produto estrangeiro','UN',1,TRUE)",
      [foreignTenant.rows[0].id, foreignCompany.rows[0].id],
    );

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    agent = request.agent(app.getHttpServer());
  }, 30_000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app?.close();
    await pool?.end();
  });

  it("authenticates and protects sessions", async () => {
    await request(app.getHttpServer()).get("/api/me").expect(401);
    const login = await agent.post("/api/login").set("Origin", "http://localhost:8000")
      .send({ username: "postgres.admin@example.test", password: "Postgres-Test-123!" }).expect(200);
    expect(login.body.user).toMatchObject({ role: "admin", tenant_name: "Tenant PostgreSQL" });
    await agent.get("/api/me").expect(200);
  });

  it("creates the catalog, customer and seller with tenant-scoped assignments", async () => {
    sellerId = (await agent.post("/api/admin/users").send({
      name: "Seller PostgreSQL", email: "postgres.seller", role: "seller", active: true,
      communication_email: "seller@example.test", temporary_password: "Postgres-Seller-123!",
    }).expect(200)).body.id;
    companyId = (await agent.post("/api/admin/companies").send({ name: "Empresa PostgreSQL", active: true }).expect(201)).body.id;
    productId = (await agent.post("/api/admin/products").send({
      company_id: companyId, code: "PG-001", name: "Produto PostgreSQL", unit: "UN", price: 19.9, active: true,
    }).expect(201)).body.id;
    customerId = (await agent.post("/api/admin/customers").send({
      legal_name: "Cliente PostgreSQL LTDA", trade_name: "Cliente PostgreSQL",
      cnpj: "12.345.678/0001-95", phone: "32999999999", email: "customer@example.test", active: true,
    }).expect(201)).body.id;
    await agent.patch("/api/admin/company-assignments").send({ company_id: companyId, seller_id: sellerId, assigned: true }).expect(200);
    await agent.patch("/api/admin/customer-assignments").send({ customer_id: customerId, seller_id: sellerId, assigned: true }).expect(200);
    expect((await agent.get("/api/admin/products").expect(200)).body.products).toHaveLength(1);
    expect((await agent.get(`/api/admin/users/${sellerId}/customers`).expect(200)).body.assigned_count).toBe(1);
    const seller = request.agent(app.getHttpServer());
    await seller.post("/api/login").send({ username: "postgres.seller", password: "Postgres-Seller-123!" }).expect(200);
    await seller.get("/api/admin/products").expect(403);
    const sellerCompanies = await seller.get("/api/companies").expect(200);
    expect(sellerCompanies.body.companies).toHaveLength(1);
    expect(sellerCompanies.body.companies[0].id).toBe(companyId);
  });

  it("persists a complete order lifecycle and its PDF", async () => {
    proposalId = (await agent.post("/api/proposals").send({
      company_id: companyId, customer_id: customerId, seller_id: sellerId,
      order_type: "Venda", commission_percent: 5, invoice_type: "Com nota cheia",
      tax_operator_invoice: false, freight_type: "CIF", delivery_type: "Entrega Normal",
      discount_percent: 0, discount_on: "Sem descontos", payment_terms: "30 dias",
      items: [{ product_id: productId, quantity: 2, negotiated_price: 18.5 }],
    }).expect(201)).body.id;
    await agent.patch(`/api/admin/proposals/${proposalId}`).send({
      status: "pedido_aprovado", delivery_forecast: "2026-11-01", admin_notes: "Aprovado",
    }).expect(200);
    const list = await agent.get("/api/proposals").expect(200);
    const proposal = list.body.proposals.find((item: { id: number }) => item.id === proposalId);
    expect(proposal).toMatchObject({ status: "pedido_aprovado", commission_percent: 5 });
    expect(proposal.items[0]).toMatchObject({ quantity: 2, negotiated_price: 18.5 });
    expect((await agent.get(`/api/proposals/${proposalId}/pdf`).expect(200)).headers["content-type"]).toContain("application/pdf");
  });

  it("persists occurrence attachments and status history", async () => {
    occurrenceId = (await agent.post("/api/occurrences").send({
      seller_id: sellerId, customer_id: customerId, reason: "Teste",
      description: "Ocorrencia PostgreSQL",
      attachments: [{ filename: "teste.txt", mimetype: "text/plain", content: "dGVzdGU=" }],
    }).expect(201)).body.id;
    await agent.patch(`/api/admin/occurrences/${occurrenceId}`).send({ status: "solucionada", resolution: "Validada" }).expect(200);
    const list = await agent.get("/api/occurrences").expect(200);
    const occurrence = list.body.occurrences.find((item: { id: number }) => item.id === occurrenceId);
    expect(occurrence).toMatchObject({ status: "solucionada", resolution: "Validada" });
    const attachment = await agent.get(`/api/occurrences/${occurrenceId}/attachments/${occurrence.attachments[0].id}`).expect(200);
    expect(attachment.text).toBe("teste");
  });

  it("serves dashboards, settings and tenant-scoped administration", async () => {
    for (const path of [
      "/api/admin/companies", "/api/admin/customers", "/api/admin/requests", "/api/admin/outbox",
      "/api/admin/goals", "/api/dashboard", "/api/admin/summary", "/api/admin/overview",
      "/api/admin/executive-dashboard", "/api/admin/settings",
    ]) await agent.get(path).expect(200);
  });

  it("deletes aggregates without leaving dependent rows", async () => {
    await agent.delete(`/api/admin/occurrences/${occurrenceId}`).expect(200);
    await agent.delete(`/api/admin/proposals/${proposalId}`).expect(200);
    await agent.delete(`/api/admin/products/${productId}`).expect(200);
    await agent.delete(`/api/admin/companies/${companyId}`).expect(200);
    await agent.delete(`/api/admin/customers/${customerId}`).expect(200);
    const counts = await pool.query(`SELECT
      (SELECT COUNT(*) FROM proposals WHERE id=$1)::int proposals,
      (SELECT COUNT(*) FROM proposal_items WHERE proposal_id=$1)::int proposal_items,
      (SELECT COUNT(*) FROM occurrences WHERE id=$2)::int occurrences,
      (SELECT COUNT(*) FROM occurrence_attachments WHERE occurrence_id=$2)::int attachments`, [proposalId, occurrenceId]);
    expect(counts.rows[0]).toEqual({ proposals: 0, proposal_items: 0, occurrences: 0, attachments: 0 });
  });
});
