import type { PublicUser, Role } from "@hipersales/contracts";

export interface UserRow {
  id: number;
  tenant_id: number | null;
  tenant_name?: string | null;
  name: string;
  email: string;
  communication_email?: string | null;
  whatsapp_phone?: string | null;
  role: Role;
  is_super_admin?: number;
  is_dev?: number;
  active: number;
  must_change_password?: number;
  password_updated_at?: string | null;
  password_hash?: string;
}

export const USER_SELECT = `
  SELECT u.id, u.tenant_id, t.name AS tenant_name, u.name, u.email,
         u.communication_email, u.whatsapp_phone, u.role, u.is_super_admin,
         u.is_dev, u.active, u.must_change_password, u.password_updated_at,
         u.password_hash
  FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
`;

export function normalizeUsername(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized.split("@", 1)[0]! : normalized;
}

export function normalizeWhatsappPhone(value: string): string {
  let digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55") && digits.length >= 10 && digits.length <= 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) {
    throw new Error("Informe o WhatsApp com DDD. Exemplo: 5532999141230.");
  }
  return digits;
}

export function toPublicUser(row: UserRow): PublicUser {
  const wasSuperAdmin = Boolean(row.is_super_admin);
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    communication_email: row.communication_email ?? null,
    whatsapp_phone: row.whatsapp_phone ?? null,
    role: wasSuperAdmin ? "admin" : row.role,
    tenant_id: Number(row.tenant_id || 1),
    tenant_name: wasSuperAdmin ? "HiperMix Representacoes" : (row.tenant_name ?? null),
    is_super_admin: false,
    is_dev: Boolean(row.is_dev),
    active: Boolean(row.active),
    must_change_password: Boolean(row.must_change_password),
    password_updated_at: row.password_updated_at ?? null,
  };
}
