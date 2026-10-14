import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { hashPassword } from "../auth/password.js";
import { EnvService } from "../config/env.service.js";
import { DatabaseRepository } from "./database.repository.js";

@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  constructor(private readonly database: DatabaseRepository, private readonly env: EnvService) {}

  async onApplicationBootstrap(): Promise<void> {
    const db = this.database.db;
    if (await db.prepare("SELECT TOP (1) 1 FROM users WHERE role IN ('dev','admin') AND active=1").get()) return;

    const email = this.env.bootstrapAdminEmail.trim().toLowerCase();
    const password = this.env.bootstrapAdminPassword;
    if (!email || password.length < 12) {
      throw new Error("Banco sem administrador ativo: configure HYPERSALES_BOOTSTRAP_ADMIN_EMAIL e HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD (minimo 12 caracteres).");
    }
    const existing = await db.prepare("SELECT TOP (1) id FROM users WHERE lower(email)=?").get(email);
    if (existing) throw new Error("Banco sem administrador ativo: o email inicial ja pertence a outro usuario.");
    const now = new Date().toISOString();
    const tenant = await db.prepare("SELECT TOP (1) id FROM tenants WHERE slug='hipermix'").get() as { id: number } | undefined;
    if (!tenant) throw new Error("Organizacao HiperMix nao encontrada. Aplique as migrations do banco.");
    await db.prepare(`INSERT INTO users
      (tenant_id,name,email,password_hash,role,active,must_change_password,password_updated_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(tenant.id,this.env.bootstrapAdminName.trim() || "Administrador",email,hashPassword(password),
        "admin",1,1,now,now);
  }
}
