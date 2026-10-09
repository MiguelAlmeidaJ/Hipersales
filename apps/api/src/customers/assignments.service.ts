import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type Kind = "customers" | "companies";
type Row = Record<string, unknown>;
const config = {
  customers: { table: "customers", link: "customer_sellers", id: "customer_id", sort: "legal_name", search: ["legal_name", "trade_name", "cnpj"] },
  companies: { table: "companies", link: "company_sellers", id: "company_id", sort: "name", search: ["name", "legal_name"] },
} as const;

function activeFilter(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (["1","true","active","ativo","ativos"].includes(value)) return 1;
  if (["0","false","inactive","inativo","inativos"].includes(value)) return 0;
  return null;
}

@Injectable()
export class AssignmentsService {
  constructor(private readonly database: DatabaseService) {}

  private seller(tenantId: number, sellerId: number): Row {
    if (!Number.isSafeInteger(sellerId) || sellerId < 1) {
      throw new BadRequestException("Selecione um representante comercial valido.");
    }
    const seller = this.database.db.prepare("SELECT * FROM users WHERE id = ?").get(sellerId) as Row | undefined;
    if (!seller) throw new NotFoundException("Usuario nao encontrado.");
    if (seller.role !== "seller" || Number(seller.tenant_id || 0) !== tenantId) {
      throw new BadRequestException("Selecione um representante comercial valido.");
    }
    return seller;
  }

  list(user: PublicUser, kind: Kind, sellerId: number, term = "", active = "all") {
    const seller = this.seller(user.tenant_id, sellerId);
    const cfg = config[kind];
    const flag = activeFilter(active);
    const like = `%${term.trim()}%`;
    const searches = cfg.search.map(col => `c.${col} LIKE ?`).join(" OR ");
    const rows = this.database.db.prepare(`SELECT c.*,
      EXISTS(SELECT 1 FROM ${cfg.link} link WHERE link.${cfg.id}=c.id AND link.seller_id=?) AS assigned
      FROM ${cfg.table} c WHERE c.tenant_id=? AND (? IS NULL OR c.active=?)
      AND (?='' OR ${searches}) ORDER BY c.${cfg.sort}`)
      .all(sellerId, user.tenant_id, flag, flag, term.trim(), ...cfg.search.map(() => like)) as Row[];
    const mapped = rows.map(row => ({ ...row, assigned: Boolean(row.assigned) }));
    const sellerPayload = {
      id: Number(seller.id), name: seller.name, email: seller.email,
      communication_email: seller.communication_email ?? null,
      whatsapp_phone: seller.whatsapp_phone ?? null,
      role: "seller", tenant_id: Number(seller.tenant_id),
      tenant_name: user.tenant_name ?? null,
      is_super_admin: false, is_dev: Boolean(seller.is_dev), active: Boolean(seller.active),
      must_change_password: Boolean(seller.must_change_password),
      password_updated_at: seller.password_updated_at ?? null,
    };
    return {
      seller: sellerPayload,
      [kind]: mapped,
      assigned_count: mapped.filter(row => row.assigned).length,
    };
  }

  set(user: PublicUser, kind: Kind, input: { customer_id?: number; company_id?: number; seller_id?: number; assigned?: boolean }) {
    const cfg = config[kind];
    const id = Number(input[cfg.id]);
    const sellerId = Number(input.seller_id);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(sellerId) || sellerId < 1 ||
      typeof input.assigned !== "boolean") {
      throw new BadRequestException("Informe identificadores validos e assigned booleano.");
    }
    return this.database.transaction(() => {
      this.seller(user.tenant_id, sellerId);
      if (!this.database.db.prepare(`SELECT id FROM ${cfg.table} WHERE id=? AND tenant_id=?`)
        .get(id, user.tenant_id)) {
        throw new NotFoundException(kind === "customers" ? "Cliente nao encontrado." : "Empresa nao encontrada.");
      }
      if (input.assigned) {
        this.database.db.prepare(`INSERT OR IGNORE INTO ${cfg.link} (${cfg.id}, seller_id) VALUES (?,?)`).run(id, sellerId);
      } else {
        this.database.db.prepare(`DELETE FROM ${cfg.link} WHERE ${cfg.id}=? AND seller_id=?`).run(id, sellerId);
      }
      const noun = kind === "customers" ? "Cliente" : "Empresa";
      return { message: `${noun} ${input.assigned ? "associado" : "desvinculado"} ${input.assigned ? "ao" : "do"} representante comercial.` .replace("Empresa associado","Empresa associada").replace("Empresa desvinculado","Empresa desvinculada") };
    });
  }
}
