import sql from "mssql";
import { config } from "dotenv";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const inheritedAdminUser = process.env.SQLSERVER_ADMIN_USER;
const inheritedAdminPassword = process.env.HIPERSALES_DATABASE_ADMIN_PASSWORD;
const runtime = config({ path: resolve(root, ".env"), quiet: true }).parsed ?? {};
const infrastructure = config({ path: resolve(root, ".env.infrastructure"), quiet: true }).parsed ?? {};

const url = process.env.SQLSERVER_DATABASE_URL ?? runtime.SQLSERVER_DATABASE_URL;
const adminUser = inheritedAdminUser ?? infrastructure.SQLSERVER_ADMIN_USER ?? "sa";
const adminPassword = inheritedAdminPassword ?? infrastructure.HIPERSALES_DATABASE_ADMIN_PASSWORD;

if (!url || !adminPassword) {
  throw new Error(
    "Configure SQLSERVER_DATABASE_URL em .env e HIPERSALES_DATABASE_ADMIN_PASSWORD em .env.infrastructure.",
  );
}

function splitConnectionString(value) {
  const segments = [];
  let current = "";
  let insideBraces = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "{" && !insideBraces) insideBraces = true;
    if (character === "}" && insideBraces) {
      if (value[index + 1] === "}") {
        current += "}}";
        index += 1;
        continue;
      }
      insideBraces = false;
    }
    if (character === ";" && !insideBraces) {
      segments.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  if (insideBraces) throw new Error("Chaves não balanceadas em SQLSERVER_DATABASE_URL.");
  if (current) segments.push(current);
  return segments;
}

function unwrap(value) {
  return value.startsWith("{") && value.endsWith("}")
    ? value.slice(1, -1).replaceAll("}}", "}")
    : value;
}

if (!url.startsWith("sqlserver://")) throw new Error("SQLSERVER_DATABASE_URL deve começar com sqlserver://.");
const [address, ...parameters] = splitConnectionString(url.slice("sqlserver://".length));
const separator = address.lastIndexOf(":");
const server = separator > 0 ? address.slice(0, separator) : address;
const port = separator > 0 ? address.slice(separator + 1) : "1433";
const fields = Object.fromEntries(
  parameters.map((parameter) => {
    const index = parameter.indexOf("=");
    if (index < 1) throw new Error("Parâmetro inválido em SQLSERVER_DATABASE_URL.");
    return [parameter.slice(0, index).toLowerCase(), unwrap(parameter.slice(index + 1))];
  }),
);
const { database, user, password } = fields;

if (!server || !/^\d+$/.test(port) || !database || !user || !password) {
  throw new Error("SQLSERVER_DATABASE_URL deve informar servidor, banco, usuário e senha.");
}
if (user.toLowerCase() === "sa" || user.toLowerCase() === adminUser.toLowerCase()) {
  throw new Error("O usuário da aplicação deve ser diferente do usuário administrativo.");
}
if (![database, user, adminUser].every((value) => /^[A-Za-z][A-Za-z0-9_]*$/.test(value))) {
  throw new Error("Nomes de banco e usuários devem conter somente letras, números e sublinhado.");
}

const identifier = (value) => `[${value}]`;
const literal = (value) => `N'${value.replaceAll("'", "''")}'`;
const connection = {
  server,
  port: Number(port),
  options: {
    encrypt: fields.encrypt !== "false",
    trustServerCertificate: fields.trustservercertificate === "true",
  },
};

const admin = await new sql.ConnectionPool({
  ...connection,
  database: "master",
  user: adminUser,
  password: adminPassword,
}).connect();

try {
  const existingDatabase = await admin
    .request()
    .input("database", sql.NVarChar, database)
    .query("SELECT DB_ID(@database) AS id");
  if (existingDatabase.recordset[0].id === null) {
    throw new Error(`O banco ${database} não existe. A criação do banco deve ocorrer pela migration de infraestrutura.`);
  }

  const existingLogin = await admin
    .request()
    .input("name", sql.NVarChar, user)
    .query("SELECT COUNT(*) AS count FROM sys.sql_logins WHERE name = @name");
  if (!existingLogin.recordset[0].count) {
    await admin.request().query(
      `CREATE LOGIN ${identifier(user)} WITH PASSWORD = ${literal(password)}, CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = ${identifier(database)}`,
    );
    console.log("Login de aplicação criado.");
  } else {
    console.log("Login de aplicação já existe; a senha atual foi preservada.");
  }

  const databaseConnection = await new sql.ConnectionPool({
    ...connection,
    database,
    user: adminUser,
    password: adminPassword,
  }).connect();
  try {
    await databaseConnection.request().query(`
      IF DATABASE_PRINCIPAL_ID(${literal(user)}) IS NULL
        CREATE USER ${identifier(user)} FOR LOGIN ${identifier(user)};
      IF IS_ROLEMEMBER('db_datareader', ${literal(user)}) = 0
        ALTER ROLE db_datareader ADD MEMBER ${identifier(user)};
      IF IS_ROLEMEMBER('db_datawriter', ${literal(user)}) = 0
        ALTER ROLE db_datawriter ADD MEMBER ${identifier(user)};
    `);
  } finally {
    await databaseConnection.close();
  }
} finally {
  await admin.close();
}

const application = await new sql.ConnectionPool({ ...connection, database, user, password }).connect();
try {
  const result = await application.request().query(`
    SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name,
      IS_ROLEMEMBER('db_datareader') AS can_read,
      IS_ROLEMEMBER('db_datawriter') AS can_write,
      IS_ROLEMEMBER('db_owner') AS is_owner,
      IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin,
      HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER') AS can_alter_database;
  `);
  const access = result.recordset[0];
  if (
    access.can_read !== 1
    || access.can_write !== 1
    || access.is_owner === 1
    || access.is_sysadmin === 1
    || access.can_alter_database === 1
  ) {
    throw new Error("As permissões do usuário de aplicação não correspondem ao perfil esperado.");
  }
  console.log(`Conexão validada: banco=${access.database_name}, login=${access.login_name}, administração/DDL=não.`);
} finally {
  await application.close();
}
