import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  PublicUser,
} from "@hipersales/contracts";
import { randomBytes } from "node:crypto";
import { DatabaseService } from "../database/database.service.js";
import { EnvService } from "../config/env.service.js";
import { hashPassword, verifyPassword } from "./password.js";

interface UserRow {
  id: number;
  tenant_id: number | null;
  tenant_name?: string | null;
  name: string;
  email: string;
  communication_email?: string | null;
  whatsapp_phone?: string | null;
  role: "admin" | "seller";
  is_super_admin?: number;
  is_dev?: number;
  active: number;
  must_change_password?: number;
  password_updated_at?: string | null;
  password_hash?: string;
}

const USER_SELECT = `
  SELECT u.id, u.tenant_id, t.name AS tenant_name, u.name, u.email,
         u.communication_email, u.whatsapp_phone, u.role, u.is_super_admin,
         u.is_dev, u.active, u.must_change_password, u.password_updated_at,
         u.password_hash
  FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
`;

function normalizeUsername(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized.split("@", 1)[0]! : normalized;
}

function publicUser(row: UserRow): PublicUser {
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

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = hashPassword(randomBytes(24).toString("base64url"));

  constructor(
    private readonly database: DatabaseService,
    private readonly env: EnvService,
  ) {}

  get sessionCookieName(): string {
    return this.env.sessionCookie;
  }

  get cookieOptions() {
    return {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: this.env.cookieSameSite,
      path: "/",
      maxAge: this.env.sessionTtlSeconds * 1000,
    } as const;
  }

  login(input: LoginRequest): { token: string; user: PublicUser } {
    const username = normalizeUsername(input.username || input.email || "");
    const row = this.database.db
      .prepare(`${USER_SELECT} WHERE u.email = ? AND u.active = 1 LIMIT 1`)
      .get(username) as UserRow | undefined;

    const valid = verifyPassword(input.password, row?.password_hash ?? this.dummyPasswordHash);
    if (!row || !valid) throw new UnauthorizedException("Usuario ou senha invalidos.");

    const token = randomBytes(32).toString("base64url");
    const nowSeconds = Math.floor(Date.now() / 1000);
    const nowIso = new Date().toISOString();
    this.database.transaction(() => {
      this.database.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowSeconds);
      this.database.db
        .prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
        .run(token, row.id, nowSeconds + this.env.sessionTtlSeconds, nowIso);
    });

    return { token, user: publicUser(row) };
  }

  logout(token?: string): void {
    if (token) this.database.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  findSessionUser(token: string): PublicUser | null {
    const row = this.database.db
      .prepare(
        `${USER_SELECT}
         JOIN sessions s ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at >= ? AND u.active = 1
         LIMIT 1`,
      )
      .get(token, Math.floor(Date.now() / 1000)) as UserRow | undefined;
    return row ? publicUser(row) : null;
  }

  changePassword(
    user: PublicUser,
    sessionToken: string,
    input: ChangePasswordRequest,
  ): ChangePasswordResponse {
    const row = this.database.db
      .prepare(`${USER_SELECT} WHERE u.id = ? AND u.active = 1 LIMIT 1`)
      .get(user.id) as UserRow | undefined;
    if (!row) throw new UnauthorizedException("Sessao expirada. Faca login novamente.");

    if (!row.must_change_password && !verifyPassword(input.current_password, row.password_hash ?? "")) {
      throw new BadRequestException("Senha atual invalida.");
    }
    if (verifyPassword(input.new_password, row.password_hash ?? "")) {
      throw new BadRequestException("A nova senha deve ser diferente da senha atual.");
    }

    const updatedAt = new Date().toISOString();
    this.database.transaction(() => {
      this.database.db
        .prepare(
          "UPDATE users SET password_hash = ?, must_change_password = 0, password_updated_at = ? WHERE id = ?",
        )
        .run(hashPassword(input.new_password), updatedAt, row.id);
      this.database.db
        .prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?")
        .run(row.id, sessionToken);
    });

    const updated = { ...row, must_change_password: 0, password_updated_at: updatedAt };
    return { message: "Senha atualizada com sucesso.", user: publicUser(updated) };
  }
}
