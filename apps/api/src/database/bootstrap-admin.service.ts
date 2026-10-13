import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { hashPassword } from "../auth/password.js";
import { EnvService } from "../config/env.service.js";
import { DatabaseService } from "./database.service.js";

@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  constructor(private readonly database: DatabaseService, private readonly env: EnvService) {}

  onApplicationBootstrap(): void {
    const db = this.database.db;
    if (db.prepare("SELECT 1 FROM users WHERE role='admin' AND active=1 LIMIT 1").get()) return;

    const email = this.env.bootstrapAdminEmail.trim().toLowerCase();
    const password = this.env.bootstrapAdminPassword;
    if (!email || password.length < 12) {
      throw new Error("Banco sem administrador ativo: configure HYPERSALES_BOOTSTRAP_ADMIN_EMAIL e HYPERSALES_BOOTSTRAP_ADMIN_PASSWORD (minimo 12 caracteres).");
    }
    const existing = db.prepare("SELECT id FROM users WHERE lower(email)=? LIMIT 1").get(email);
    if (existing) throw new Error("Banco sem administrador ativo: o email inicial ja pertence a outro usuario.");
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO users
      (tenant_id,name,email,password_hash,role,active,must_change_password,password_updated_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(1,this.env.bootstrapAdminName.trim() || "Administrador",email,hashPassword(password),
        "admin",1,1,now,now);
  }
}
