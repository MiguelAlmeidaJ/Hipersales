import { readFileSync } from "node:fs";

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function decodeValue(rawValue) {
  const value = rawValue.trim();
  if (!value) return "";
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, "").trim();
}

export function loadEnvFile(path) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  content.split(/\r?\n/).forEach((rawLine, index) => {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    if (line.startsWith("export ")) line = line.slice(7).trimStart();
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Linha invalida em ${path}:${index + 1}.`);
    const name = line.slice(0, separator).trim();
    if (!ENV_NAME_PATTERN.test(name)) throw new Error(`Nome de variavel invalido em ${path}:${index + 1}.`);
    if (process.env[name] === undefined) {
      process.env[name] = decodeValue(line.slice(separator + 1));
    }
  });
}

export function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}.`);
  return value;
}
