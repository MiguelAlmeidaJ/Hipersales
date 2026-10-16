import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@hipersales/database";
import { PrismaService } from "./prisma.service.js";
import { bindParameters, prepareSelect } from "./query-parameters.js";

type Row = Record<string, unknown>;
type QueryClient = PrismaService | Prisma.TransactionClient;
export type ClaimedOutboxRow = { id: number; tenant_id: number; recipients: string; subject: string; body: string };
export type ClaimedPushNotification = {
  id: number;
  user_id: number;
  title: string;
  body: string;
  route: string | null;
  data: string | null;
};

export type RunResult = { changes: number; lastInsertRowid: number };

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
  constructor(private readonly database: DatabaseRepository, private readonly sql: string) {}

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
export class DatabaseRepository {
  readonly db = this;
  private readonly transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  private get client(): QueryClient {
    return this.transactionStorage.getStore() ?? this.prisma;
  }

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this, sql);
  }

  async query(sql: string, parameters: unknown[] = []): Promise<Row[]> {
    const bound = bindParameters(prepareSelect(sql), parameters);
    const values = parameters.map((value) => value === undefined ? null : value);
    const rows = await this.client.$queryRawUnsafe<Row[]>(bound.sql, ...values);
    return rows.map((row) => normalizeValue(row) as Row);
  }

  async execute(sql: string, parameters: unknown[] = []): Promise<RunResult> {
    let command = sql.trim().replace(/;$/, "");
    if (!/^(?:INSERT\s+INTO\b|UPDATE\s+\[?[a-z_]+\]?|DELETE\s+FROM\b)/i.test(command) ||
        /\b(?:ON\s+CONFLICT|RETURNING|OR\s+IGNORE|MERGE|DROP|ALTER|TRUNCATE|EXEC)\b/i.test(command)) {
      throw new Error("Unsupported database mutation.");
    }
    const insert = /^INSERT\s+INTO\s+(?:dbo\.)?\[?([a-z_]+)\]?\s*\(/i.exec(command);
    const identityTables = new Set([
      "tenants", "users", "companies", "customers", "products", "registration_requests",
      "proposals", "proposal_items", "email_outbox", "proposal_events", "occurrences",
      "occurrence_attachments", "occurrence_events", "seller_goals",
      "push_tokens", "notifications",
    ]);
    const identityInsert = insert && identityTables.has(insert[1]!.toLowerCase());
    if (identityInsert && !/\bOUTPUT\s+INSERTED\./i.test(command)) {
      const values = /\s+VALUES\s*\(/i.exec(command);
      if (!values) throw new Error("Only INSERT ... VALUES is supported.");
      command = command.slice(0, values.index) + " OUTPUT INSERTED.id" + command.slice(values.index);
    }
    const bound = bindParameters(command, parameters);
    const values = parameters.map((value) => value === undefined ? null : value);
    if (identityInsert) {
      const rows = await this.client.$queryRawUnsafe<Row[]>(bound.sql, ...values);
      return { changes: rows.length, lastInsertRowid: Number(rows[0]?.id ?? 0) };
    }
    const changes = await this.client.$executeRawUnsafe(bound.sql, ...values);
    return { changes, lastInsertRowid: 0 };
  }

  async transaction<T>(callback: () => Promise<T> | T): Promise<T> {
    if (this.transactionStorage.getStore()) return callback();
    return this.prisma.$transaction(
      (transaction) => this.transactionStorage.run(transaction, async () => callback()),
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  async claimEmailOutbox(limit = 10): Promise<ClaimedOutboxRow[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return this.client.$queryRawUnsafe<ClaimedOutboxRow[]>(`;WITH next_messages AS (
      SELECT TOP (${safeLimit}) id,tenant_id,recipients,subject,body,attempts,claimed_until,error
      FROM dbo.email_outbox WITH (UPDLOCK, READPAST, ROWLOCK)
      WHERE recipients NOT LIKE 'whatsapp:%' AND sent_at IS NULL
        AND COALESCE(attempts,0) < 5
        AND (claimed_until IS NULL OR claimed_until < SYSUTCDATETIME())
      ORDER BY id
    )
    UPDATE next_messages
      SET attempts=COALESCE(attempts,0)+1,
          claimed_until=DATEADD(minute,5,SYSUTCDATETIME()), error=NULL
      OUTPUT INSERTED.id,INSERTED.tenant_id,INSERTED.recipients,INSERTED.subject,INSERTED.body;`);
  }

  async claimPushNotifications(limit = 20): Promise<ClaimedPushNotification[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return this.client.$queryRawUnsafe<ClaimedPushNotification[]>(`;WITH next_notifications AS (
      SELECT TOP (${safeLimit}) id,user_id,title,body,route,data,push_attempts,push_claimed_until,push_error
      FROM dbo.notifications WITH (UPDLOCK, READPAST, ROWLOCK)
      WHERE push_sent_at IS NULL AND COALESCE(push_attempts,0) < 5
        AND (push_claimed_until IS NULL OR push_claimed_until < SYSUTCDATETIME())
      ORDER BY id
    )
    UPDATE next_notifications
      SET push_attempts=COALESCE(push_attempts,0)+1,
          push_claimed_until=DATEADD(minute,5,SYSUTCDATETIME()), push_error=NULL
      OUTPUT INSERTED.id,INSERTED.user_id,INSERTED.title,INSERTED.body,INSERTED.route,INSERTED.data;`);
  }
}
