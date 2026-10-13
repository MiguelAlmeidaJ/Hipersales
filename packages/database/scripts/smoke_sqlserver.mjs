import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import sql from "mssql";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });

function parsePrismaSqlServerUrl(value) {
  if (!value?.startsWith("sqlserver://")) throw new Error("Defina SQLSERVER_DATABASE_URL em .env.");
  // Connection properties may be braced to contain ; and =.
  const raw = value.slice("sqlserver://".length);
  const separator = raw.indexOf(";");
  const authority = separator < 0 ? raw : raw.slice(0, separator);
  const [server, portText] = authority.split(":");
  if (!server) throw new Error("Host SQL Server ausente.");
  const props = {};
  const opts = raw.slice(separator + 1);
  for (let i = 0; i < opts.length;) {
    let end = opts.indexOf("=", i);
    if (end < 0) break;
    const name = opts.slice(i, end).trim().toLowerCase();
    i = end + 1;
    let value = "";
    if (opts[i] === "{") {
      i++;
      const close = opts.indexOf("}", i);
      if (close < 0) throw new Error("Falta fechar chave na URL SQL Server.");
      value = opts.slice(i, close);
      i = close + 1;
      if (opts[i] === ";") i++;
    } else {
      end = opts.indexOf(";", i);
      if (end < 0) end = opts.length;
      value = opts.slice(i, end);
      i = end + 1;
    }
    props[name] = value;
  }
  return {
    server,
    port: Number(portText || 1433),
    database: props.database,
    user: props.user,
    password: props.password,
    options: {
      encrypt: props.encrypt !== "false",
      trustServerCertificate: props.trustservercertificate === "true",
    },
    pool: { min: 0, max: 2 },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };
}

const expected = {
  tenants: 1,
  users: 23,
  customers: 308,
  proposals: 212,
  products: 300,
  proposal_items: 576,
  email_outbox: 2154,
  registration_requests: 39,
};

let pool;
try {
  pool = await sql.connect(parsePrismaSqlServerUrl(process.env.SQLSERVER_DATABASE_URL));
  const rows = await pool.request().query(
    "SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo')"
  );
  const existing = new Set(rows.recordset.map(({ name }) => name));
  for (const table of Object.keys(expected)) {
    if (!existing.has(table)) throw new Error("Tabela ausente: " + table);
    const result = await pool.request().query("SELECT COUNT_BIG(*) AS total FROM dbo.[" + table + "]");
    const actual = Number(result.recordset[0].total);
    console.log(table.padEnd(24), actual, actual === expected[table] ? "OK" : "DIVERGENTE");
    if (actual !== expected[table]) process.exitCode = 1;
  }
  const constraints = await pool.request().query(
    "SELECT COUNT(*) AS total FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1"
  );
  if (constraints.recordset[0].total > 0) {
    console.error("ATENCAO: foreign keys desabilitadas ou nao confiaveis:", constraints.recordset[0].total);
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Falha SQL Server:", error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}
