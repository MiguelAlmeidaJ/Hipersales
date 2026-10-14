import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const local = process.argv.includes("--local");
const errors = [];

function keys(relativePath, required = true) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    if (required) errors.push(`${relativePath}: arquivo ausente.`);
    return new Map();
  }
  const entries = new Map();
  for (const [index, line] of readFileSync(path, "utf8").split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) {
      errors.push(`${relativePath}:${index + 1}: declaração inválida.`);
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    if (entries.has(key)) errors.push(`${relativePath}: variável duplicada ${key}.`);
    entries.set(key, trimmed.slice(separator + 1));
  }
  return entries;
}

function requireKeys(file, entries, required) {
  for (const key of required) if (!entries.has(key)) errors.push(`${file}: variável obrigatória ausente: ${key}.`);
}

const runtimeFile = local ? ".env" : ".env.example";
const infrastructureFile = local ? ".env.infrastructure" : ".env.infrastructure.example";
const mobileFile = local ? "apps/mobile/.env.local" : "apps/mobile/.env.example";
const runtime = keys(runtimeFile);
const infrastructure = keys(infrastructureFile);
const mobileExists = existsSync(resolve(root, mobileFile));
const mobile = keys(mobileFile, !local);

requireKeys(runtimeFile, runtime, [
  "SQLSERVER_DATABASE_URL", "DATABASE_POOL_SIZE", "HYPERSALES_PUBLIC_URL",
  "HYPERSALES_SESSION_TTL_SECONDS", "EVOLUTION_API_URL", "EVOLUTION_API_KEY",
]);
requireKeys(infrastructureFile, infrastructure, [
  "SQLSERVER_ADMIN_USER", "HIPERSALES_DATABASE_ADMIN_PASSWORD", "EVOLUTION_DB_PASSWORD",
]);
if (!local || mobileExists) {
  requireKeys(mobileFile, mobile, ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_PRIVACY_URL", "EXPO_PUBLIC_SUPPORT_URL"]);
}

const forbiddenRuntime = [
  "DATABASE_URL", "DATABASE_ADMIN_PASSWORD", "HIPERSALES_DB_PASSWORD",
  "HIPERSALES_SQLSERVER_SA_PASSWORD", "HIPERSALES_DATABASE_ADMIN_PASSWORD", "EVOLUTION_DB_PASSWORD",
];
for (const key of forbiddenRuntime) {
  if (runtime.has(key)) errors.push(`${runtimeFile}: ${key} pertence à infraestrutura ou é uma variável legada.`);
}
for (const key of mobile.keys()) {
  if (!key.startsWith("EXPO_PUBLIC_")) errors.push(`${mobileFile}: ${key} não pode ser incluída no aplicativo.`);
}
for (const key of infrastructure.keys()) {
  if (runtime.has(key)) errors.push(`${key} não pode existir simultaneamente no runtime e na infraestrutura.`);
}

const connection = runtime.get("SQLSERVER_DATABASE_URL") ?? "";
const databaseUser = connection.match(/(?:^|;)\s*user\s*=\s*(\{[^}]*\}|[^;]*)/i)?.[1]?.replace(/^\{|\}$/g, "").trim();
if (!databaseUser) errors.push(`${runtimeFile}: SQLSERVER_DATABASE_URL não informa user.`);
if (databaseUser?.toLowerCase() === "sa") errors.push(`${runtimeFile}: SQLSERVER_DATABASE_URL não pode usar sa.`);

if (errors.length) {
  console.error(`Ambiente inválido (${errors.length} problema(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Ambiente válido: ${local ? "arquivos locais" : "templates versionados"}.`);
}
