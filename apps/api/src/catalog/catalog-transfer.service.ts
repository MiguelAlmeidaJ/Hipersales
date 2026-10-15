import { Injectable, BadRequestException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";
import { CatalogService } from "./catalog.service.js";

@Injectable()
export class CatalogTransferService {
  constructor(
    private readonly database: DatabaseRepository,
    private readonly catalog: CatalogService,
  ) {}

  async exportProducts(user: PublicUser, companyId = "", query = "", active = "all") {
    const records = (await this.catalog.adminProducts(user, companyId, query, active)).products;
    const fields = [
      "company_id", "company_name", "code", "name", "product_group", "subgroup", "unit", "brand",
      "minimum_sale_quantity", "weight", "ncm", "ipi_percent", "has_st", "invoice_origin", "price",
      "average_practiced_price", "total_sold_quantity", "total_sales_revenue", "active",
    ];
    const quote = (value: unknown) => {
      const text = String(value ?? "");
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [fields.join(",")];
    for (const row of records) {
      lines.push(fields.map(field => quote(
        field === "unit" ? row.unit || "UN" :
        ["price", "minimum_sale_quantity", "weight", "ipi_percent", "average_practiced_price", "total_sold_quantity", "total_sales_revenue"].includes(field) ? row[field] || 0 :
        field === "active" || field === "has_st" ? Number(row[field]) ? 1 : 0 : row[field],
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

    const rows = input.rows as unknown[];
    return this.database.transaction(async () => {
      const db = this.database.db;
      const company = db.prepare("SELECT id FROM companies WHERE id=? AND tenant_id=?");
      const existing = db.prepare("SELECT id FROM products WHERE tenant_id=? AND company_id=? AND code=?");
      const update = db.prepare(`UPDATE products SET
        name=?,product_group=?,subgroup=?,unit=?,brand=?,minimum_sale_quantity=?,weight=?,ncm=?,ipi_percent=?,
        has_st=?,invoice_origin=?,price=?,active=?
        WHERE tenant_id=? AND company_id=? AND code=?`);
      const insert = db.prepare(`INSERT INTO products
        (tenant_id,company_id,code,name,product_group,subgroup,unit,brand,minimum_sale_quantity,weight,ncm,
         ipi_percent,has_st,invoice_origin,price,active)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      let created = 0;
      let updated = 0;

      const text = (value: unknown) => {
        const result = String(value ?? "").trim();
        return result || null;
      };

      for (const value of rows) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const row = value as Record<string, unknown>;
        const companyId = Number(row.company_id);
        if (!Number.isSafeInteger(companyId) || companyId <= 0 || !await company.get(companyId,user.tenant_id)) continue;
        const code = String(row.code ?? "").trim();
        const name = String(row.name ?? "").trim();
        if (!code || !name) throw new BadRequestException("Informe code e name.");
        const price = Number(row.price || 0);
        const minimumSaleQuantity = Number(row.minimum_sale_quantity || 0);
        const weight = Number(row.weight || 0);
        const ipiPercent = Number(row.ipi_percent || 0);
        if (![price, minimumSaleQuantity, weight, ipiPercent].every(Number.isFinite))
          throw new BadRequestException("Valores numericos do produto invalidos.");
        const unit = String(row.unit || "UN").trim() || "UN";
        const active = row.active === false || row.active === 0 || row.active === "0" || row.active === "false" ? 0 : 1;
        const hasSt = row.has_st === true || row.has_st === 1 || row.has_st === "1" || String(row.has_st).toLowerCase() === "true" ? 1 : 0;
        const args = [
          name,text(row.product_group),text(row.subgroup),unit,text(row.brand),minimumSaleQuantity,weight,text(row.ncm),
          ipiPercent,hasSt,text(row.invoice_origin),price,active,
        ];
        const exists = Boolean(await existing.get(user.tenant_id, companyId, code));
        if (exists) await update.run(...args,user.tenant_id,companyId,code);
        else await insert.run(user.tenant_id,companyId,code,...args);
        if (exists) updated++; else created++;
      }
      return { message: "Importacao concluida.", created, updated };
    });
  }
}
