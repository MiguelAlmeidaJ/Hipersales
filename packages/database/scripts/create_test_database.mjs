import sql from "mssql";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });

const password = process.env.DATABASE_ADMIN_PASSWORD ?? process.env.HIPERSALES_DATABASE_ADMIN_PASSWORD ?? process.env.HIPERSALES_SQLSERVER_SA_PASSWORD;
const database = process.env.TEST_DATABASE_NAME ?? "hipersales_test";
if (!password) throw new Error("DATABASE_ADMIN_PASSWORD ausente.");
if (!/^[A-Za-z0-9_]+_(?:test|validation)$/.test(database)) {
  throw new Error("Nome de banco de teste invalido.");
}

let pool;
let lastError;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    pool = await new sql.ConnectionPool({
      server: process.env.DATABASE_HOST ?? "127.0.0.1",
      port: Number(process.env.DATABASE_PORT ?? 1433), database: "master", user: "sa", password,
      options: { encrypt: false, trustServerCertificate: true },
      connectionTimeout: 3000,
    }).connect();
    break;
  } catch (error) {
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
if (!pool) throw lastError ?? new Error("SQL Server indisponivel.");
try {
  if (process.env.RESET_TEST_DATABASE === "true") {
    await pool.request().query(`IF DB_ID(N'${database}') IS NOT NULL BEGIN
      ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${database}];
    END`);
  }
  await pool.request().query(`IF DB_ID(N'${database}') IS NULL CREATE DATABASE [${database}]`);
} finally {
  await pool.close();
}
