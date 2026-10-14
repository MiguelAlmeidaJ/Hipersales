import { config } from "dotenv";
import sql from "mssql";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

function connection(value) {
  if (!value?.startsWith("sqlserver://")) throw new Error("SQLSERVER_DATABASE_URL ausente.");
  const raw = value.slice("sqlserver://".length);
  const separator = raw.indexOf(";");
  const [server, port = "1433"] = raw.slice(0, separator).split(":");
  const fields = {};
  const options = raw.slice(separator + 1);
  let index = 0;
  while (index < options.length) {
    const equals = options.indexOf("=", index);
    if (equals < 0) break;
    const key = options.slice(index, equals).trim().toLowerCase();
    index = equals + 1;
    if (options[index] === "{") {
      const end = options.indexOf("}", index + 1);
      if (end < 0) throw new Error("SQLSERVER_DATABASE_URL inválida.");
      fields[key] = options.slice(index + 1, end);
      index = end + 2;
    } else {
      const end = options.indexOf(";", index);
      fields[key] = options.slice(index, end < 0 ? options.length : end);
      index = end < 0 ? options.length : end + 1;
    }
  }
  return {
    server,
    port: Number(port),
    database: fields.database,
    user: fields.user,
    password: fields.password,
    options: { encrypt: fields.encrypt !== "false", trustServerCertificate: fields.trustservercertificate === "true" },
  };
}

const pool = await sql.connect(connection(process.env.SQLSERVER_DATABASE_URL));
try {
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM dbo.tenants) AS tenant_count,
      (SELECT COUNT_BIG(*) FROM dbo.tenants WHERE slug=N'hipermix' AND status=N'active') AS hipermix_count,
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE role NOT IN (N'dev',N'admin',N'seller')) AS invalid_roles,
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE (LOWER(LTRIM(RTRIM(name)))=N'nivel3' OR LOWER(LTRIM(RTRIM(email)))=N'nivel3') AND role=N'dev') AS nivel3_dev,
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE tenant_id IS NULL) AS users_without_organization;
  `);
  const state = result.recordset[0];
  if (
    Number(state.tenant_count) !== 1
    || Number(state.hipermix_count) !== 1
    || Number(state.invalid_roles) !== 0
    || Number(state.nivel3_dev) !== 1
    || Number(state.users_without_organization) !== 0
  ) throw new Error(`Modelo de acesso inválido: ${JSON.stringify(state)}`);
  console.log("Modelo de acesso válido: HiperMix única; Nivel3=dev; perfis dev/admin/seller.");
} finally {
  await pool.close();
}
