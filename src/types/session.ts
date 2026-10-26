// Contrato local do app. Ajustar quando a API externa publicar seu formato definitivo.
export type Role = "dev" | "admin" | "seller";
export type PublicUser = {
  id: number;
  name: string;
  email: string;
  communication_email?: string | null;
  whatsapp_phone?: string | null;
  role: Role;
  tenant_id: number;
  tenant_name?: string | null;
  active: boolean;
  must_change_password: boolean;
  representative_id?: number | null;
  representative_name?: string | null;
  password_updated_at?: string | null;
};
export type SessionResponse = { user: PublicUser };
export type MobileSessionResponse = SessionResponse & { session_token: string };
