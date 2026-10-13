import type sql from "mssql";

export function parseDatabaseConnection(uri: string, poolSize = 10): sql.config {
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
    pool: { min: 0, max: poolSize, idleTimeoutMillis: 30_000 },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
  };
}
