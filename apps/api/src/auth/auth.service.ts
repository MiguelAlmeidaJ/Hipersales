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
import { normalizeUsername, toPublicUser, USER_SELECT, type UserRow } from "../users/user.mapper.js";

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

    return { token, user: toPublicUser(row) };
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
    return row ? toPublicUser(row) : null;
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
    return { message: "Senha atualizada com sucesso.", user: toPublicUser(updated) };
  }
}
