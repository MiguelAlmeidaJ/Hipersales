export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const apiDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(value);
  return match
    ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0))
    : new Date(value);
};

export const shortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = apiDate(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
};

export const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = apiDate(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export const formatCnpj = (value: string) => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  return normalized.length === 14
    ? normalized.replace(/^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : value;
};

export const digitsOnly = (value: string) => value.replace(/\D/g, "");
