import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@hipersales/database";
import { PrismaService } from "./prisma.service.js";

type QueryClient = PrismaService | Prisma.TransactionClient;
type Row = Record<string, unknown>;

export type RunResult = { changes: number; lastInsertRowid: number };

const booleanColumns = "active|is_super_admin|is_dev|must_change_password|tax_operator_invoice";
const tablesWithGeneratedId = new Set([
  "tenants", "users", "companies", "customers", "products", "registration_requests",
  "proposals", "proposal_items", "email_outbox", "proposal_events", "occurrences",
  "occurrence_attachments", "occurrence_events", "seller_goals",
]);

function postgresSql(sql: string): string {
  let parameter = 0;
  const statement = sql
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(/group_concat\s*\(([^,]+),\s*'([^']*)'\s*\)/gi, "string_agg($1, '$2')")
    .replace(/datetime\s*\(\s*'now'\s*,\s*'-7 days'\s*\)/gi, "CURRENT_TIMESTAMP - INTERVAL '7 days'")
    .replace(new RegExp(`COALESCE\\(([^,)]*\\b(?:${booleanColumns})\\b),\\s*0\\)\\s*=\\s*0`, "gi"), "COALESCE($1, FALSE) = FALSE")
    .replace(new RegExp(`\\b(${booleanColumns})\\b\\s*=\\s*1`, "gi"), "$1 = TRUE")
    .replace(new RegExp(`\\b(${booleanColumns})\\b\\s*=\\s*0`, "gi"), "$1 = FALSE")
    .replace(/\bLIKE\b/gi, "ILIKE")
    .replace(/\?/g, () => `$${++parameter}`);
  // PostgreSQL cannot infer a parameter type when it is used only by IS NULL.
  // These placeholders are sent exclusively as nullable filter sentinels.
  return statement.replace(/\$(\d+)\s+IS\s+NULL/gi, "$$$1::text IS NULL");
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object" && !Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    const decimal = value as { toNumber?: () => number };
    if (typeof decimal.toNumber === "function") return decimal.toNumber();
    return Object.fromEntries(Object.entries(value as Row).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
}

class PreparedStatement {
  constructor(private readonly database: DatabaseService, private readonly sql: string) {}

  async get(...parameters: unknown[]): Promise<Row | undefined> {
    const rows = await this.database.query(this.sql, parameters);
    return rows[0];
  }

  async all(...parameters: unknown[]): Promise<Row[]> {
    return this.database.query(this.sql, parameters);
  }

  async run(...parameters: unknown[]): Promise<RunResult> {
    return this.database.execute(this.sql, parameters);
  }
}

@Injectable()
export class DatabaseService {
  readonly db = this;
  private readonly transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this, sql);
  }

  async query(sql: string, parameters: unknown[] = []): Promise<Row[]> {
    const client: QueryClient = this.transactionStorage.getStore() ?? this.prisma;
    const rows = await client.$queryRawUnsafe<Row[]>(postgresSql(sql), ...parameters);
    return rows.map((row) => normalizeValue(row) as Row);
  }

  async execute(sql: string, parameters: unknown[] = []): Promise<RunResult> {
    const client: QueryClient = this.transactionStorage.getStore() ?? this.prisma;
    let statement = postgresSql(sql).trim().replace(/;$/, "");
    const insert = /^INSERT\s+INTO\s+"?([a-z_]+)"?/i.exec(statement);
    if (!insert) {
      const changes = await client.$executeRawUnsafe(statement, ...parameters);
      return { changes, lastInsertRowid: 0 };
    }
    if (/\bOR\s+IGNORE\b/i.test(sql) && !/\bON\s+CONFLICT\b/i.test(statement)) {
      statement += " ON CONFLICT DO NOTHING";
    }
    const table = insert[1]!.toLowerCase();
    statement += tablesWithGeneratedId.has(table) ? " RETURNING id" : " RETURNING 1 AS inserted";
    const rows = await client.$queryRawUnsafe<Row[]>(statement, ...parameters);
    return { changes: rows.length, lastInsertRowid: Number(rows[0]?.id ?? 0) };
  }

  async transaction<T>(callback: () => Promise<T> | T): Promise<T> {
    return this.prisma.$transaction(
      (transaction) => this.transactionStorage.run(transaction, async () => callback()),
      { maxWait: 10_000, timeout: 30_000 },
    );
  }
}
