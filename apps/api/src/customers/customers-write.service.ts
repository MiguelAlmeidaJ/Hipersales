import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";
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
  status?: "ativo" | "inativo" | "bloqueado";
  seller_ids?: number[];
  [field: string]: unknown;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 14);

@Injectable()
export class CustomersWriteService {
  constructor(private readonly database: DatabaseRepository) {}

  private validate(input: CustomerInput) {
    const name = String(input?.legal_name ?? "").trim();
    const cnpj = String(input?.cnpj ?? "").trim();
    const digits = digitsOnly(cnpj);
    if (!name || !cnpj || digits.length !== 14) {
      throw new BadRequestException("Informe razao social e CNPJ valido.");
    }
    return { name, cnpj, digits };
  }

  private async assertUnique(tenantId: number, digits: string, excludeId = 0) {
    const rows = await this.database.db.prepare(
      "SELECT id, cnpj FROM customers WHERE tenant_id = ? AND id <> ?",
    ).all(tenantId, excludeId) as { id: number; cnpj: string }[];
    if (rows.some((row) => digitsOnly(row.cnpj) === digits)) {
      throw new ConflictException("Ja existe esse CNPJ na nossa base.");
    }
  }

  private status(input: CustomerInput) {
    const value = String(input.status || (input.active === false ? "inativo" : "ativo")).toLowerCase();
    if (!["ativo","inativo","bloqueado"].includes(value)) throw new BadRequestException("Status do cliente invalido.");
    return value as "ativo"|"inativo"|"bloqueado";
  }

  private sellerIds(input: CustomerInput): number[] | undefined {
    if (!Object.prototype.hasOwnProperty.call(input,"seller_ids")) return undefined;
    if (!Array.isArray(input.seller_ids)) throw new BadRequestException("Representantes invalidos.");
    return [...new Set(input.seller_ids.map(Number))].filter(id=>Number.isSafeInteger(id)&&id>0);
  }

  private async syncSellers(tenantId:number,customerId:number,sellerIds:number[]|undefined) {
    if (sellerIds === undefined) return;
    for (const sellerId of sellerIds) {
      if (!await this.database.db.prepare("SELECT 1 FROM users WHERE id=? AND tenant_id=? AND role='seller' AND active=1").get(sellerId,tenantId))
        throw new BadRequestException("Um dos representantes selecionados nao esta ativo.");
    }
    await this.database.db.prepare("DELETE FROM customer_sellers WHERE customer_id=?").run(customerId);
    const insert=this.database.db.prepare("INSERT INTO customer_sellers (customer_id,seller_id) VALUES (?,?)");
    for(const sellerId of sellerIds) await insert.run(customerId,sellerId);
  }

  create(user: PublicUser, input: CustomerInput) {
    const { name, cnpj, digits } = this.validate(input);
    return this.database.transaction(async () => {
      await this.assertUnique(user.tenant_id, digits);
      const { phone, email, address, state_registration } = customerContact(input);
      const payload = JSON.stringify({ ...input, phone, email, _lookup: input._lookup ?? {} });
      const status = this.status(input);
      const sellerIds = this.sellerIds(input);
      try {
        const result = await this.database.db.prepare(`INSERT INTO customers
          (tenant_id, legal_name, trade_name, cnpj, state_registration, address, phone, email,
           form_payload, active, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          user.tenant_id, name, input.trade_name ?? null, cnpj,
          state_registration, address, phone, email,
          payload, status === "ativo" ? 1 : 0, status, new Date().toISOString(),
        );
        await this.syncSellers(user.tenant_id,Number(result.lastInsertRowid),sellerIds);
        return { id: Number(result.lastInsertRowid), message: "Cliente cadastrado." };
      } catch (error) {
        if(error instanceof BadRequestException) throw error;
        throw new ConflictException("Este CNPJ ja foi cadastrado.");
      }
    });
  }

  update(user: PublicUser, customerId: number, input: CustomerInput) {
    const { name, cnpj, digits } = this.validate(input);
    return this.database.transaction(async () => {
      const existing = await this.database.db.prepare(
        "SELECT id, form_payload FROM customers WHERE id=? AND tenant_id=?",
      ).get(customerId, user.tenant_id) as {id:number; form_payload:string}|undefined;
      if (!existing) throw new NotFoundException("Cliente nao encontrado.");
      await this.assertUnique(user.tenant_id, digits, customerId);
      let previous: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(existing.form_payload || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          previous = parsed as Record<string, unknown>;
        }
      } catch { /* Legacy malformed JSON must not break editing. */ }
      const { phone, email, address, state_registration } = customerContact(input);
      const payload = JSON.stringify({ ...previous, ...input, phone, email });
      const status = this.status(input);
      const sellerIds = this.sellerIds(input);
      try {
        await this.database.db.prepare(`UPDATE customers SET legal_name=?, trade_name=?, cnpj=?,
          state_registration=?, address=?, phone=?, email=?, form_payload=?, active=?, status=?
          WHERE id=? AND tenant_id=?`).run(
          name, input.trade_name ?? null, cnpj, state_registration,
          address, phone, email, payload, status === "ativo" ? 1 : 0, status,
          customerId, user.tenant_id,
        );
        await this.syncSellers(user.tenant_id,customerId,sellerIds);
      } catch (error) {
        if(error instanceof BadRequestException) throw error;
        throw new ConflictException("Este CNPJ ja foi cadastrado.");
      }
      return { id: customerId, message: "Cliente atualizado." };
    });
  }

  remove(user: PublicUser, customerId: number) {
    return this.database.transaction(async () => {
      const db = this.database.db;
      if (!await db.prepare("SELECT id FROM customers WHERE id=? AND tenant_id=?")
        .get(customerId, user.tenant_id)) {
        throw new NotFoundException("Cliente nao encontrado.");
      }
      if (await db.prepare("SELECT TOP (1) 1 FROM proposals WHERE customer_id=? AND tenant_id=?")
        .get(customerId, user.tenant_id)) {
        throw new ConflictException(
          "Cliente ja possui pedido. Inative o cliente para preservar o historico.",
        );
      }
      await db.prepare("DELETE FROM customer_sellers WHERE customer_id=?").run(customerId);
      await db.prepare("DELETE FROM customers WHERE id=? AND tenant_id=?").run(
        customerId, user.tenant_id,
      );
      return { message: "Cliente excluido." };
    });
  }
}
