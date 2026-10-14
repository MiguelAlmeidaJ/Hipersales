import sql from "mssql";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env") });
const url = process.env.SQLSERVER_DATABASE_URL;
const saPassword = process.env.HIPERSALES_DATABASE_ADMIN_PASSWORD;
if (!url || !saPassword) throw Error("Configure SQLSERVER_DATABASE_URL e HIPERSALES_DATABASE_ADMIN_PASSWORD no .env da raiz.");
const [address, ...parts] = url.replace(/^sqlserver:\/\//, "").split(";");
if (!url.startsWith("sqlserver://")) throw Error("URL SQL Server invalida.");
const [server, port = "1433"] = address.split(":");
const fields = Object.fromEntries(parts.map((part) => {
  const idx = part.indexOf("=");
  if (idx < 1) throw Error("Parametro SQL Server invalido.");
  const value = part.slice(idx + 1);
  return [part.slice(0, idx).toLowerCase(), value.startsWith("{") && value.endsWith("}") ? value.slice(1, -1) : value];
}));
const { database, user, password } = fields;
if (!server || !/^\d+$/.test(port) || !database || !user || !password || user.toLowerCase() === "sa") throw Error("URL deve informar banco, usuario nao-sa e senha.");
if (![database, user].every((v) => /^[A-Za-z][A-Za-z0-9_]*$/.test(v))) throw Error("Nomes de banco e login devem ser alfanumericos.");
const ident = (s) => "[" + s + "]";
const literal = (s) => "N'" + s.replaceAll("'", "''") + "'";
const opts = { server, port: Number(port), options: { encrypt: fields.encrypt !== "false", trustServerCertificate: fields.trustservercertificate === "true" } };
const admin = await new sql.ConnectionPool({ ...opts, user: "sa", password: saPassword, database: "master" }).connect();
try {
  await admin.request().query(`IF DB_ID(${literal(database)}) IS NULL CREATE DATABASE ${ident(database)}`);
  const found = await admin.request().input("name", sql.NVarChar, user).query("SELECT COUNT(*) AS count FROM sys.sql_logins WHERE name = @name");
  if (!found.recordset[0].count) {
    await admin.request().query(`CREATE LOGIN ${ident(user)} WITH PASSWORD = ${literal(password)}, CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = ${ident(database)}`);
  } else console.log("Login ja existe; senha preservada.");
  const db = await new sql.ConnectionPool({ ...opts, user: "sa", password: saPassword, database }).connect();
  try {
    await db.request().query(`
      IF DATABASE_PRINCIPAL_ID(${literal(user)}) IS NULL CREATE USER ${ident(user)} FOR LOGIN ${ident(user)};
      IF IS_ROLEMEMBER('db_datareader', ${literal(user)}) = 0 ALTER ROLE db_datareader ADD MEMBER ${ident(user)};
      IF IS_ROLEMEMBER('db_datawriter', ${literal(user)}) = 0 ALTER ROLE db_datawriter ADD MEMBER ${ident(user)};
      GRANT EXECUTE TO ${ident(user)};
    `);
  } finally { await db.close(); }
} finally { await admin.close(); }
const app = await new sql.ConnectionPool({ ...opts, database, user, password }).connect();
try {
  const result = await app.request().query("SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name");
  console.log("Conexao validada:", result.recordset[0].database_name, result.recordset[0].login_name);
} finally { await app.close(); }
