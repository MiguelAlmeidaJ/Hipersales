import { Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type CustomerRow = Record<string, unknown>;

function enrich(row: CustomerRow): CustomerRow {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.form_payload || "{}")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch { /* Legacy records can have invalid JSON. */ }
  const first = (...items: unknown[]) => items.find(item => typeof item === "string" && item.trim()) || "";
  const address = first(row.address, payload.address, payload.street, payload.logradouro);
  return {
    ...row,
    form_payload: payload,
    state_registration: first(row.state_registration, payload.state_registration, payload.insc_estadual, payload.inscricao_estadual),
    address,
    phone: first(row.phone, payload.phone, payload.buyer_phone_1, payload.finance_phone_1, payload.logistics_phone_1, payload.representative_phone),
    email: first(row.email, payload.email, payload.buyer_email, payload.billing_email, payload.xml_email, payload.representative_email),
  };
}

function filterActive(input: string): number | null {
  if (["1","true","active","ativo","ativos"].includes(input.toLowerCase())) return 1;
  if (["0","false","inactive","inativo","inativos"].includes(input.toLowerCase())) return 0;
  return null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly database: DatabaseService) {}

  list(user: PublicUser, term = "") {
    const like = `%${term.trim()}%`;
    const query = user.role === "admin"
      ? `SELECT c.* FROM customers c WHERE c.tenant_id=? AND c.active=1
         AND (c.legal_name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ?) ORDER BY c.legal_name`
      : `SELECT c.* FROM customers c JOIN customer_sellers cs
         ON cs.customer_id=c.id AND cs.seller_id=?
         WHERE c.tenant_id=? AND c.active=1
         AND (c.legal_name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ?) ORDER BY c.legal_name`;
    const params = user.role === "admin" ? [user.tenant_id,like,like,like] : [user.id,user.tenant_id,like,like,like];
    const rows = this.database.db.prepare(query).all(...params);
    return { customers: rows.map(row => enrich(row as CustomerRow)) };
  }

  adminList(user: PublicUser, term = "", active = "all") {
    const like = `%${term.trim()}%`;
    const filter = filterActive(active);
    const rows = this.database.db.prepare(`SELECT c.*,
      (SELECT u.name FROM customer_sellers cs JOIN users u ON u.id=cs.seller_id
       WHERE cs.customer_id=c.id ORDER BY cs.seller_id LIMIT 1) AS seller_name,
      (SELECT COALESCE(NULLIF(u.communication_email,''),u.email) FROM customer_sellers cs
       JOIN users u ON u.id=cs.seller_id WHERE cs.customer_id=c.id ORDER BY cs.seller_id LIMIT 1) AS seller_email,
      (SELECT COUNT(*) FROM customer_sellers cs WHERE cs.customer_id=c.id) AS seller_count,
      (SELECT group_concat(u.name,', ') FROM customer_sellers cs JOIN users u ON u.id=cs.seller_id
       WHERE cs.customer_id=c.id) AS seller_names
      FROM customers c WHERE c.tenant_id=? AND (? IS NULL OR c.active=?)
      AND (?='' OR c.legal_name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ? OR c.phone LIKE ?)
      ORDER BY c.legal_name`).all(user.tenant_id,filter,filter,term.trim(),like,like,like,like);
    return { customers: rows.map(row => enrich(row as CustomerRow)) };
  }
}
