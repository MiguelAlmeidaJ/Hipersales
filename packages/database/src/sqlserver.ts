import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient as SqlServerPrismaClient } from "./generated/sqlserver/client.js";

export { SqlServerPrismaClient };
export type { Prisma as SqlServerPrisma } from "./generated/sqlserver/client.js";

/**
 * Separate SQL Server connection for cutover preparation. No mutation or
 * automatic replacement of the active PostgreSQL Prisma Client.
 */
export function createSqlServerClient(config: {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  poolSize?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}): SqlServerPrismaClient {
  const adapter = new PrismaMssql({
    server: config.server,
    port: config.port ?? 1433,
    database: config.database,
    user: config.user,
    password: config.password,
    pool: { min: 0, max: config.poolSize ?? 10, idleTimeoutMillis: 30_000 },
    connectionTimeout: 10_000,
    options: {
      encrypt: config.encrypt ?? true,
      trustServerCertificate: config.trustServerCertificate ?? false,
    },
  });
  return new SqlServerPrismaClient({ adapter });
}
