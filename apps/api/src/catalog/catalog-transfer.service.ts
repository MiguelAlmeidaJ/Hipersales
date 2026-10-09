import { Injectable, BadRequestException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { CatalogService } from "./catalog.service.js";

@Injectable()
export class CatalogTransferService {
  constructor(
    private readonly database: DatabaseService,
    private readonly catalog: CatalogService,
  ) {}

  exportProducts(user: PublicUser, companyId = "", query = "", active = "all") {
    const records = this.catalog.adminProducts(user, companyId, query, active).products;
    const fields = ["company_id", "company_name", "code", "name", "unit", "price", "active"];
    const quote = (value: unknown) => {
      const text = String(value ?? "");
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [fields.join(",")];
    for (const row of records) {
      lines.push(fields.map(field => quote(
        field === "unit" ? row.unit || "UN" :
        field === "price" ? row.price || 0 :
        field === "active" ? Number(row.active) ? 1 : 0 : row[field],
      )).join(","));
    }
    const filename = "produtos_filtrados_" + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "") + ".csv";
    return { filename, csv: lines.join("\r\n") + "\r\n" };
  }

  importProducts(user: PublicUser, input: { rows?: unknown }) {
    if (!Array.isArray(input?.rows) || input.rows.length === 0)
      throw new BadRequestException("Nenhum item para importar.");
    if (input.rows.length > 10000)
      throw new BadRequestException("Limite de 10000 itens por importacao.");

    return this.database.transaction(() => {
      const db = this.database.db;
      const company = db.prepare("SELECT id FROM companies WHERE id=? AND tenant_id=?");
      const existing = db.prepare("SELECT id FROM products WHERE tenant_id=? AND company_id=? AND code=?");
      const insert = db.prepare(`INSERT INTO products
        (tenant_id,company_id,code,name,unit,price,active) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(company_id,code) DO UPDATE SET
        name=excluded.name,unit=excluded.unit,price=excluded.price,active=excluded.active`);
      let created = 0;
      let updated = 0;
      for (const value of input.rows) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const row = value as Record<string, unknown>;
        const companyId = Number(row.company_id);
        if (!Number.isSafeInteger(companyId) || companyId <= 0 || !company.get(companyId,user.tenant_id)) continue;
        const code = String(row.code ?? "").trim();
        const name = String(row.name ?? "").trim();
        if (!code || !name) throw new BadRequestException("Informe code e name.");
        const price = Number(row.price || 0);
        if (!Number.isFinite(price)) throw new BadRequestException("Preco invalido.");
        const unit = String(row.unit || "UN").trim() || "UN";
        const active = row.active === false || row.active === 0 || row.active === "0" || row.active === "false" ? 0 : 1;
        const exists = Boolean(existing.get(user.tenant_id, companyId, code));
        insert.run(user.tenant_id,companyId,code,name,unit,price,active);
        if (exists) updated++; else created++;
      }
      return { message: "Importacao concluida.", created, updated };
    });
  }
}
