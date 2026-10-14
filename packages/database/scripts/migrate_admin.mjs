import { config } from "dotenv";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const root = resolve(packageRoot, "../..");
const inheritedAdminUser = process.env.SQLSERVER_ADMIN_USER;
const inheritedAdminPassword = process.env.HIPERSALES_DATABASE_ADMIN_PASSWORD;
const runtime = config({ path: resolve(root, ".env"), quiet: true }).parsed ?? {};
const infrastructure = config({ path: resolve(root, ".env.infrastructure"), quiet: true }).parsed ?? {};

const runtimeUrl = process.env.SQLSERVER_DATABASE_URL ?? runtime.SQLSERVER_DATABASE_URL;
const adminUser = inheritedAdminUser ?? infrastructure.SQLSERVER_ADMIN_USER ?? "sa";
const adminPassword = inheritedAdminPassword ?? infrastructure.HIPERSALES_DATABASE_ADMIN_PASSWORD;
if (!runtimeUrl || !adminPassword) {
  throw new Error("Configure .env e .env.infrastructure antes de executar migrations administrativas.");
}

function segments(value) {
  const result = [];
  let current = "";
  let braced = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "{" && !braced) braced = true;
    if (character === "}" && braced) {
      if (value[index + 1] === "}") {
        current += "}}";
        index += 1;
        continue;
      }
      braced = false;
    }
    if (character === ";" && !braced) {
      result.push(current);
      current = "";
    } else current += character;
  }
  if (braced) throw new Error("SQLSERVER_DATABASE_URL possui chaves não balanceadas.");
  if (current) result.push(current);
  return result;
}

if (!runtimeUrl.startsWith("sqlserver://")) throw new Error("SQLSERVER_DATABASE_URL inválida.");
const [address, ...options] = segments(runtimeUrl.slice("sqlserver://".length));
const values = Object.fromEntries(options.map((option) => {
  const separator = option.indexOf("=");
  if (separator < 1) throw new Error("SQLSERVER_DATABASE_URL inválida.");
  return [option.slice(0, separator).trim().toLowerCase(), option.slice(separator + 1)];
}));
if (!address || !values.database) throw new Error("SQLSERVER_DATABASE_URL não informa servidor ou banco.");

const brace = (value) => `{${String(value).replaceAll("}", "}}")}}`;
const adminUrl = [
  `sqlserver://${address}`,
  `database=${values.database}`,
  `user=${adminUser}`,
  `password=${brace(adminPassword)}`,
  `encrypt=${values.encrypt ?? "true"}`,
  `trustServerCertificate=${values.trustservercertificate ?? "false"}`,
].join(";");

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Execute este script por meio do pnpm.");
const migrationArguments = process.argv.slice(2);
const child = spawn(process.execPath, [pnpmCli, "exec", "prisma", "migrate", ...(migrationArguments.length ? migrationArguments : ["deploy"])], {
  cwd: packageRoot,
  env: { ...process.env, SQLSERVER_DATABASE_URL: adminUrl },
  stdio: "inherit",
});
child.on("error", (error) => { throw error; });
const exitCode = await new Promise((resolveExit) => child.on("exit", (code) => resolveExit(code ?? 1)));
if (exitCode !== 0) process.exitCode = exitCode;
