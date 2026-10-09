import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { customerContact } from "./customer-fields.js";

export type CustomerInput = {
  legal_name: string;
  cnpj: string;
  trade_name?: string | null;
  state_registration?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
  [field: string]: unknown;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 14);

@Injectable()
export class CustomersWriteService {
  constructor(private readonly database: DatabaseService) {}

  private validate(input: CustomerInput) {
    const name = String(input?.legal_name ?? "").trim();
    const cnpj = String(input?.cnpj ?? "").trim();
    const digits = digitsOnly(cnpj);
    if (!name || !cnpj || digits.length !== 14) {
      throw new BadRequestException("Informe razao social e CNPJ valido.");
    }
    return { name, cnpj, digits };
  }

  private assertUnique(tenantId: number, digits: string, excludeId = 0) {
    const rows = this.database.db.prepare(
      "SELECT id, cnpj FROM customers WHERE tenant_id = ? AND id <> ?",
    ).all(tenantId, excludeId) as { id: number; cnpj: string }[];
    if (rows.some((row) => digitsOnly(row.cnpj) === digits)) {
      throw new ConflictException("Ja existe esse CNPJ na nossa base.");
    }
  }

  create(user: PublicUser, input: CustomerInput) {
    const { name, cnpj, digits } = this.validate(input);
    return this.database.transaction(() => {
      this.assertUnique(user.tenant_id, digits);
      const { phone, email, address, state_registration } = customerContact(input);
      const payload = JSON.stringify({ ...input, phone, email, _lookup: input._lookup ?? {} });
      try {
        const result = this.database.db.prepare(`INSERT INTO customers
          (tenant_id, legal_name, trade_name, cnpj, state_registration, address, phone, email,
           form_payload, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          user.tenant_id, name, input.trade_name ?? null, cnpj,
          state_registration, address, phone, email,
          payload, input.active === false ? 0 : 1, new Date().toISOString(),
        );
        return { id: Number(result.lastInsertRowid), message: "Cliente cadastrado." };
      } catch {
        throw new ConflictException("Este CNPJ ja foi cadastrado.");
      }
    });
  }

  update(user: PublicUser, customerId: number, input: CustomerInput) {
    const { name, cnpj, digits } = this.validate(input);
    return this.database.transaction(() => {
      const existing = this.database.db.prepare(
        "SELECT id, form_payload FROM customers WHERE id=? AND tenant_id=?",
      ).get(customerId, user.tenant_id) as {id:number; form_payload:string}|undefined;
      if (!existing) throw new NotFoundException("Cliente nao encontrado.");
      this.assertUnique(user.tenant_id, digits, customerId);
      let previous: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(existing.form_payload || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          previous = parsed as Record<string, unknown>;
        }
      } catch { /* Legacy malformed JSON must not break editing. */ }
      const { phone, email, address, state_registration } = customerContact(input);
      const payload = JSON.stringify({ ...previous, ...input, phone, email });
      try {
        this.database.db.prepare(`UPDATE customers SET legal_name=?, trade_name=?, cnpj=?,
          state_registration=?, address=?, phone=?, email=?, form_payload=?, active=?
          WHERE id=? AND tenant_id=?`).run(
          name, input.trade_name ?? null, cnpj, state_registration,
          address, phone, email, payload, input.active === false ? 0 : 1,
          customerId, user.tenant_id,
        );
      } catch {
        throw new ConflictException("Este CNPJ ja foi cadastrado.");
      }
      return { id: customerId, message: "Cliente atualizado." };
    });
  }

  remove(user: PublicUser, customerId: number) {
    return this.database.transaction(() => {
      const db = this.database.db;
      if (!db.prepare("SELECT id FROM customers WHERE id=? AND tenant_id=?")
        .get(customerId, user.tenant_id)) {
        throw new NotFoundException("Cliente nao encontrado.");
      }
      if (db.prepare("SELECT 1 FROM proposals WHERE customer_id=? AND tenant_id=? LIMIT 1")
        .get(customerId, user.tenant_id)) {
        throw new ConflictException(
          "Cliente ja possui pedido. Inative o cliente para preservar o historico.",
        );
      }
      db.prepare("DELETE FROM customer_sellers WHERE customer_id=?").run(customerId);
      db.prepare("DELETE FROM customers WHERE id=? AND tenant_id=?").run(
        customerId, user.tenant_id,
      );
      return { message: "Cliente excluido." };
    });
  }
}
