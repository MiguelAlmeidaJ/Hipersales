export function cnpjDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}
export function isValidCnpj(value: unknown): boolean {
  const digits = cnpjDigits(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const checksum = (length: number): number => {
    let weight = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index++) {
      sum += Number(digits[index]) * weight--;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checksum(12) === Number(digits[12]) && checksum(13) === Number(digits[13]);
}
