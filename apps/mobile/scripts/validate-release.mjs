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
