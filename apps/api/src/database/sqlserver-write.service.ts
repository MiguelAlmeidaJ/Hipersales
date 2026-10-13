import { Injectable } from "@nestjs/common";
import sql from "mssql";
import { AsyncLocalStorage } from "node:async_hooks";
import { bindSqlServerParameters } from "./sqlserver-dialect.js";
import { SqlServerReadService } from "./sqlserver-read.service.js";

export type SqlServerWriteResult = { changes: number; lastInsertRowid: number };

/**
 * Isolated transactional writer for T-SQL statements.
 * This is NOT enabled on the existing DatabaseService until the legacy
 * SQL queries/upserts have been ported and integration tests pass.
 */
@Injectable()
export class SqlServerWriteService {
  private readonly transactions = new AsyncLocalStorage<sql.Transaction>();

  constructor(private readonly database: SqlServerReadService) {}

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Nested calls reuse the same transaction; the outermost scope owns commit.
    if (this.transactions.getStore()) return callback();
    const pool = await this.database.connection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await this.transactions.run(transaction, callback);
      await transaction.commit();
      return result;
    } catch (error) {
      try { await transaction.rollback(); } catch { /* original error wins */ }
      throw error;
    }
  }

  async execute(statement: string, params: readonly unknown[] = []): Promise<SqlServerWriteResult> {
    let command = statement.trim().replace(/;$/, "");
    // Prepared legacy INSERT OR IGNORE / ON CONFLICT need table-specific
    // implementations; blindly rewriting them changes unique semantics.
    if (!/^(?:INSERT\s+INTO\b|UPDATE\s+\[?[a-z_]+\]?|DELETE\s+FROM\b)/i.test(command) ||
        /\b(?:ON\s+CONFLICT|RETURNING|OR\s+IGNORE|MERGE|DROP|ALTER|TRUNCATE|EXEC)\b/i.test(command)) {
      throw new Error("Unsupported SQL Server mutation; explicit T-SQL rewrite required.");
    }
    const insert = /^INSERT\s+INTO\s+(?:dbo\.)?\[?([a-z_]+)\]?\s*\(/i.exec(command);
    if (insert && !/\bOUTPUT\s+INSERTED\./i.test(command)) {
      // Capture only the identity, without a subsequent race-prone SCOPE_IDENTITY query.
      const values = /\s+VALUES\s*\(/i.exec(command);
      if (!values) throw new Error("Only INSERT ... VALUES is supported by the transitional writer.");
      const identityTables = new Set([
        "tenants", "users", "companies", "customers", "products", "registration_requests",
        "proposals", "proposal_items", "email_outbox", "proposal_events", "occurrences",
        "occurrence_attachments", "occurrence_events", "seller_goals",
      ]);
      if (identityTables.has(insert[1]!.toLowerCase())) {
        command = command.slice(0, values.index) + " OUTPUT INSERTED.id" + command.slice(values.index);
      }
    }
    const bound = bindSqlServerParameters(command, params);
    const tx = this.transactions.getStore();
    const request = tx ? new sql.Request(tx) : (await this.database.connection()).request();
    for (const { name, value } of bound.bindings) request.input(name, value === undefined ? null : value);
    const result = await request.query<Record<string, unknown>>(bound.sql);
    return {
      changes: result.rowsAffected.reduce((sum, count) => sum + count, 0),
      lastInsertRowid: Number(result.recordset?.[0]?.id ?? 0),
    };
  }
}
