const firstDigitWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const secondDigitWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(value: string) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const registration = raw.slice(0, 12);
  const checkDigits = raw.slice(12).replace(/\D/g, "").slice(0, 2);
  return `${registration}${checkDigits}`;
}

export function maskCnpj(value: string) {
  const raw = normalizeCnpj(value);
  return [raw.slice(0, 2), raw.slice(2, 5), raw.slice(5, 8), raw.slice(8, 12), raw.slice(12, 14)]
    .filter(Boolean)
    .map((part, index) => `${index === 1 || index === 2 ? "." : index === 3 ? "/" : index === 4 ? "-" : ""}${part}`)
    .join("");
}

function calculateDigit(base: string, weights: number[]) {
  const sum = base.split("").reduce((total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index], 0);
  const digit = 11 - (sum % 11);
  return digit >= 10 ? 0 : digit;
}

export function isValidCnpj(value: string) {
  const raw = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(raw) || (/^\d+$/.test(raw) && /^(\d)\1{13}$/.test(raw))) return false;
  const first = calculateDigit(raw.slice(0, 12), firstDigitWeights);
  const second = calculateDigit(`${raw.slice(0, 12)}${first}`, secondDigitWeights);
  return raw.endsWith(`${first}${second}`);
}
