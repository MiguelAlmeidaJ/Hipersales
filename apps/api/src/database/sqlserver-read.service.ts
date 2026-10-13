import { Injectable, OnModuleDestroy } from "@nestjs/common";
import sql from "mssql";
import { EnvService } from "../config/env.service.js";
import { bindSqlServerParameters, toSqlServerSelect } from "./sqlserver-dialect.js";

type Row = Record<string, unknown>;

/**
 * Isolated SQL Server read bridge. Not a replacement for DatabaseService:
 * writes, transactions, upserts, and pagination still require T-SQL migration.
 */
@Injectable()
export class SqlServerReadService implements OnModuleDestroy {
  private pool?: sql.ConnectionPool;
  private connecting?: Promise<sql.ConnectionPool>;

  constructor(private readonly env: EnvService) {}

  private parseConnection(): sql.config {
    const uri = this.env.sqlserverDatabaseUrl;
    if (!uri.startsWith("sqlserver://")) throw new Error("Configure SQLSERVER_DATABASE_URL before testing SQL Server reads.");
    const raw = uri.slice("sqlserver://".length);
    const split = raw.indexOf(";");
    const host = split < 0 ? raw : raw.slice(0, split);
    const options = split < 0 ? "" : raw.slice(split + 1);
    const [server, portText] = host.split(":");
    if (!server || (portText && !/^\d+$/.test(portText))) throw new Error("SQL Server host/port invalid.");
    const attributes: Record<string, string> = {};
    let i = 0;
    while (i < options.length) {
      const eq = options.indexOf("=", i);
      if (eq < 0) throw new Error("SQL Server connection option malformed.");
      const key = options.slice(i, eq).toLowerCase();
      i = eq + 1;
      let value: string;
      if (options[i] === "{") {
        const close = options.indexOf("}", i + 1);
        if (close < 0) throw new Error("Unclosed SQL Server connection option.");
        value = options.slice(i + 1, close);
        i = close + 1;
        if (i < options.length && options[i++] !== ";") throw new Error("Malformed SQL Server connection option.");
      } else {
        const end = options.indexOf(";", i);
        value = options.slice(i, end < 0 ? options.length : end);
        i = end < 0 ? options.length : end + 1;
      }
      attributes[key] = value;
    }
    if (!attributes.database || !attributes.user || !attributes.password) throw new Error("Missing SQL Server database credentials.");
    return {
      server,
      port: Number(portText ?? 1433),
      database: attributes.database,
      user: attributes.user,
      password: attributes.password,
      options: {
        encrypt: attributes.encrypt !== "false",
        trustServerCertificate: attributes.trustservercertificate === "true",
      },
      pool: { min: 0, max: this.env.databasePoolSize, idleTimeoutMillis: 30_000 },
      connectionTimeout: 10_000,
      requestTimeout: 30_000,
    };
  }

  async connection(): Promise<sql.ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    if (!this.connecting) {
      const pool = new sql.ConnectionPool(this.parseConnection());
      this.connecting = pool.connect().then((connected) => {
        this.pool = connected;
        return connected;
      }).catch((error: unknown) => {
        this.connecting = undefined;
        throw error;
      });
    }
    return this.connecting;
  }

  async query(source: string, values: readonly unknown[] = []): Promise<Row[]> {
    const statement = toSqlServerSelect(source);
    const { sql: command, bindings } = bindSqlServerParameters(statement, values);
    const pool = await this.connection();
    const request = pool.request();
    for (const binding of bindings) request.input(binding.name, binding.value === undefined ? null : binding.value);
    const result = await request.query<Row>(command);
    return result.recordset;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.close();
  }
}
