import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type DbRow = Record<string, unknown>;

function activeFilter(value?: string): number | null {
  const key = (value ?? "all").trim().toLowerCase();
  if (["1", "true", "active", "ativo", "ativos"].includes(key)) return 1;
  if (["0", "false", "inactive", "inativo", "inativos"].includes(key)) return 0;
  return null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  companies(user: PublicUser): { companies: DbRow[] } {
    const db = this.database.db;
    const rows = user.role === "admin"
      ? db.prepare("SELECT * FROM companies WHERE active = 1 AND tenant_id = ? ORDER BY name").all(user.tenant_id)
      : db.prepare(`SELECT c.* FROM companies c
          JOIN company_sellers cs ON cs.company_id = c.id AND cs.seller_id = ?
          WHERE c.active = 1 AND c.tenant_id = ? ORDER BY c.name`).all(user.id, user.tenant_id);
    return { companies: rows as DbRow[] };
  }

  products(user: PublicUser, companyId: number, term = ""): { products: DbRow[] } {
    if (!Number.isSafeInteger(companyId) || companyId < 0) throw new BadRequestException("Empresa invalida.");
    const db = this.database.db;
    if (user.role !== "admin") {
      const assigned = db.prepare("SELECT 1 FROM company_sellers WHERE company_id = ? AND seller_id = ?")
        .get(companyId, user.id);
      if (!assigned) throw new ForbiddenException("Empresa nao associada ao representante comercial.");
    }
    const like = `%${term.trim()}%`;
    const rows = db.prepare(`SELECT * FROM products
      WHERE active = 1 AND tenant_id = ? AND company_id = ? AND (code LIKE ? OR name LIKE ?)
      ORDER BY code`).all(user.tenant_id, companyId, like, like);
    return { products: rows as DbRow[] };
  }

  adminCompanies(user: PublicUser, term = "", active = "all"): { companies: DbRow[] } {
    const filter = activeFilter(active);
    const like = `%${term.trim()}%`;
    const rows = this.database.db.prepare(`SELECT c.*, COUNT(p.id) AS product_count
      FROM companies c
      LEFT JOIN products p ON p.company_id = c.id AND p.active = 1 AND p.tenant_id = ?
      WHERE c.tenant_id = ?
        AND (? IS NULL OR c.active = ?)
        AND (? = '' OR c.name LIKE ? OR c.legal_name LIKE ?)
      GROUP BY c.id ORDER BY c.name`)
      .all(user.tenant_id, user.tenant_id, filter, filter, term.trim(), like, like);
    return { companies: rows as DbRow[] };
  }

  adminProducts(user: PublicUser, companyId = "", term = "", active = "all"): { products: DbRow[] } {
    const filter = activeFilter(active);
    let selected: number | null = null;
    if (companyId && companyId !== "0") {
      selected = Number(companyId);
      if (!Number.isSafeInteger(selected) || selected <= 0) throw new BadRequestException("Empresa invalida.");
    }
    const like = `%${term.trim()}%`;
    const rows = this.database.db.prepare(`SELECT p.*, c.name AS company_name
      FROM products p JOIN companies c ON c.id = p.company_id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
        AND (? IS NULL OR p.company_id = ?)
        AND (? IS NULL OR p.active = ?)
        AND (? = '' OR p.code LIKE ? OR p.name LIKE ? OR c.name LIKE ?)
      ORDER BY c.name, p.code`)
      .all(user.tenant_id, selected, selected, filter, filter, term.trim(), like, like, like);
    return { products: rows as DbRow[] };
  }
}
