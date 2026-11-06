import fs from "node:fs";
import path from "node:path";

for (const filename of [".env", ".env.local"]) {
  const filepath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filepath)) continue;
  for (const line of fs.readFileSync(filepath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

const isEasProduction = process.argv.includes("--eas") && process.env.EAS_BUILD_PROFILE === "production";
const isExplicitValidation = !process.argv.includes("--eas");

if (!isEasProduction && !isExplicitValidation) process.exit(0);

const requiredUrls = [
  ["EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL],
  ["EXPO_PUBLIC_PRIVACY_URL", process.env.EXPO_PUBLIC_PRIVACY_URL],
  ["EXPO_PUBLIC_SUPPORT_URL", process.env.EXPO_PUBLIC_SUPPORT_URL],
];
const failures = requiredUrls.flatMap(([name, value]) => {
  if (!value) return [`${name} não configurada.`];
  try {
    return new URL(value).protocol === "https:" ? [] : [`${name} deve usar HTTPS.`];
  } catch {
    return [`${name} não contém uma URL válida.`];
  }
});

if (failures.length) {
  console.error(`Build de produção bloqueado:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Configuração pública de produção validada.");
