import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateUserRequest,
  PublicUser,
  UpdateUserRequest,
  UserMutationResponse,
  UsersResponse,
} from "@hipersales/contracts";
import { hashPassword } from "../auth/password.js";
import { DatabaseRepository } from "../database/database.repository.js";
import {
  normalizeUsername,
  normalizeWhatsappPhone,
  toPublicUser,
  USER_SELECT,
  USER_SELECT_ONE,
  type UserRow,
} from "./user.mapper.js";

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseRepository) {}

  async list(actor: PublicUser): Promise<UsersResponse> {
    const developerFilter = actor.role === "dev" ? "" : " AND u.role <> 'dev' AND COALESCE(u.is_dev, 0) = 0 AND COALESCE(u.is_super_admin, 0) = 0";
    const rows = await this.database.db
      .prepare(`${USER_SELECT} WHERE u.tenant_id = ?${developerFilter} ORDER BY u.name`)
      .all(actor.tenant_id) as unknown as UserRow[];
    return { users: rows.map(toPublicUser) };
  }

  async create(actor: PublicUser, input: CreateUserRequest): Promise<UserMutationResponse> {
    if (input.role === "dev" && actor.role !== "dev") {
      throw new ForbiddenException("Somente desenvolvedores podem criar outro usuario desenvolvedor.");
    }
    const email = normalizeUsername(input.email);
    if (!email) throw new BadRequestException("Informe o usuario.");
    let whatsappPhone: string;
    try {
      whatsappPhone = normalizeWhatsappPhone(input.whatsapp_phone);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const password = input.temporary_password || input.password;
    if (!password) throw new BadRequestException("Informe a senha ou a senha temporaria.");
    const now = new Date().toISOString();
    try {
      const result = await this.database.db
        .prepare(`INSERT INTO users
          (tenant_id, name, email, communication_email, whatsapp_phone, password_hash, role,
           is_dev, is_super_admin, active, must_change_password, password_updated_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          actor.tenant_id,
          input.name,
          email,
          input.communication_email.toLowerCase(),
          whatsappPhone,
          hashPassword(password),
          input.role,
          input.role === "dev" ? 1 : 0,
          0,
          input.active ? 1 : 0,
          input.temporary_password ? 1 : 0,
          now,
          now,
        );
      const id = Number(result.lastInsertRowid);
      return { id, message: "Usuario cadastrado.", user: await this.getTenantUser(actor, id) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ConflictException("Este usuario ja esta em uso.");
    }
  }

  async update(
    actor: PublicUser,
    userId: number,
    input: UpdateUserRequest,
    currentSessionToken: string,
  ): Promise<UserMutationResponse> {
    return this.database.transaction(async () => {
      const row = await this.getTenantUserRow(actor, userId);
      const role = input.role ?? row.role;
      const active = input.active ?? Boolean(row.active);
      if (role === "dev" && actor.role !== "dev") {
        throw new NotFoundException("Usuario nao encontrado.");
      }
      if (actor.id === userId && (!active || role !== actor.role)) {
        throw new BadRequestException("Voce nao pode desativar ou alterar o perfil da propria conta.");
      }
      if (row.role === "admin" && row.active && (!active || role !== "admin")) {
        const otherAdmin = await this.database.db
          .prepare(`SELECT TOP (1) 1 FROM users
            WHERE tenant_id = ? AND id <> ? AND role = 'admin' AND active = 1
              AND COALESCE(is_super_admin, 0) = 0`)
          .get(actor.tenant_id, userId);
        if (!otherAdmin) throw new ConflictException("Mantenha ao menos um administrador ativo.");
      }

      let whatsappPhone = row.whatsapp_phone ?? "";
      if (input.whatsapp_phone !== undefined) {
        try {
          whatsappPhone = normalizeWhatsappPhone(input.whatsapp_phone);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
      }
      const temporaryPassword = input.temporary_password || "";
      const password = temporaryPassword || input.password || "";
      const mustChangePassword = temporaryPassword
        ? true
        : password
          ? Boolean(input.must_change_password)
          : (input.must_change_password ?? Boolean(row.must_change_password));
      const email = input.email === undefined ? row.email : normalizeUsername(input.email);
      if (!email) throw new BadRequestException("Informe o usuario.");

      const assignments = [
        "name = ?", "email = ?", "communication_email = ?", "whatsapp_phone = ?",
        "role = ?", "is_dev = ?", "is_super_admin = 0", "active = ?", "must_change_password = ?",
      ];
      const values: Array<string | number> = [
        input.name ?? row.name,
        email,
        input.communication_email?.toLowerCase() ?? row.communication_email ?? "",
        whatsappPhone,
        role,
        role === "dev" ? 1 : 0,
        active ? 1 : 0,
        mustChangePassword ? 1 : 0,
      ];
      if (password) {
        assignments.push("password_hash = ?", "password_updated_at = ?");
        values.push(hashPassword(password), new Date().toISOString());
      }
      values.push(userId, actor.tenant_id);

      try {
        const result = await this.database.db
          .prepare(`UPDATE users SET ${assignments.join(", ")}
            WHERE id = ? AND tenant_id = ?`)
          .run(...values);
        if (!result.changes) throw new NotFoundException("Usuario nao encontrado.");
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        throw new ConflictException("Este usuario ja esta em uso.");
      }

      if (password || role !== row.role || active !== Boolean(row.active) || email !== row.email) {
        if (actor.id === userId) {
          await this.database.db.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(userId, currentSessionToken);
        } else {
          await this.database.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
        }
      }
      return { message: "Usuario atualizado.", user: await this.getTenantUser(actor, userId) };
    });
  }

  private async getTenantUser(actor: PublicUser, userId: number): Promise<PublicUser> {
    return toPublicUser(await this.getTenantUserRow(actor, userId));
  }

  private async getTenantUserRow(actor: PublicUser, userId: number): Promise<UserRow> {
    const developerFilter = actor.role === "dev" ? "" : " AND u.role <> 'dev' AND COALESCE(u.is_dev, 0) = 0 AND COALESCE(u.is_super_admin, 0) = 0";
    const row = await this.database.db
      .prepare(`${USER_SELECT_ONE}
        WHERE u.id = ? AND u.tenant_id = ?${developerFilter}`)
      .get(userId, actor.tenant_id) as UserRow | undefined;
    if (!row) throw new NotFoundException("Usuario nao encontrado.");
    return row;
  }
}
