import { Injectable, ForbiddenException, BadRequestException, NotFoundException, ConflictException } from "@nestjs/common";
import { hasAdminAccess, type ProductMutation, type PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

type DbRow = Record<string, unknown>;

const SOLD_STATUSES_SQL = "'pedido_aprovado','em_producao','faturado','entregue'";

function activeFilter(value?: string): number | null {
  const key = (value ?? "all").trim().toLowerCase();
  if (["1", "true", "active", "ativo", "ativos"].includes(key)) return 1;
  if (["0", "false", "inactive", "inativo", "inativos"].includes(key)) return 0;
  return null;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseRepository) {}

  async companies(user: PublicUser): Promise<{ companies: DbRow[] }> {
    const db = this.database.db;
    const rows = hasAdminAccess(user.role)
      ? await db.prepare("SELECT * FROM companies WHERE active = 1 AND tenant_id = ? ORDER BY name").all(user.tenant_id)
      : await db.prepare(`SELECT c.* FROM companies c
          JOIN company_sellers cs ON cs.company_id = c.id AND cs.seller_id = ?
          WHERE c.active = 1 AND c.tenant_id = ? ORDER BY c.name`).all(user.id, user.tenant_id);
    return { companies: rows as DbRow[] };
  }

  async products(user: PublicUser, companyId: number, term = ""): Promise<{ products: DbRow[] }> {
    if (!Number.isSafeInteger(companyId) || companyId < 0) throw new BadRequestException("Empresa invalida.");
    const db = this.database.db;
    if (!hasAdminAccess(user.role)) {
      const assigned = await db.prepare("SELECT 1 FROM company_sellers WHERE company_id = ? AND seller_id = ?")
        .get(companyId, user.id);
      if (!assigned) throw new ForbiddenException("Empresa nao associada ao representante comercial.");
    }
    const like = `%${term.trim()}%`;
    const rows = await db.prepare(`SELECT p.*,
      COALESCE(h.sold_quantity, 0) AS total_sold_quantity,
      COALESCE(h.sales_revenue, 0) AS total_sales_revenue,
      CASE WHEN COALESCE(h.sold_quantity, 0) > 0
        THEN COALESCE(h.sales_revenue, 0) / h.sold_quantity ELSE 0 END AS average_practiced_price
      FROM products p
      LEFT JOIN (
        SELECT pi.product_id,
          SUM(pi.quantity) AS sold_quantity,
          SUM(pi.quantity * pi.negotiated_price) AS sales_revenue
        FROM proposal_items pi
        JOIN proposals po ON po.id = pi.proposal_id
        WHERE po.tenant_id = ? AND po.status IN (${SOLD_STATUSES_SQL})
        GROUP BY pi.product_id
      ) h ON h.product_id = p.id
      WHERE p.active = 1 AND p.tenant_id = ? AND p.company_id = ? AND (p.code LIKE ? OR p.name LIKE ?)
      ORDER BY p.code`).all(user.tenant_id, user.tenant_id, companyId, like, like);
    return { products: rows as DbRow[] };
  }

  async adminCompanies(user: PublicUser, term = "", active = "all"): Promise<{ companies: DbRow[] }> {
    const filter = activeFilter(active);
    const like = `%${term.trim()}%`;
    const rows = await this.database.db.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM products p WHERE p.company_id=c.id AND p.active=1 AND p.tenant_id=?) AS product_count
      FROM companies c
      WHERE c.tenant_id = ?
        AND (? IS NULL OR c.active = ?)
        AND (? = '' OR c.name LIKE ? OR c.legal_name LIKE ?)
      ORDER BY c.name`)
      .all(user.tenant_id, user.tenant_id, filter, filter, term.trim(), like, like);
    return { companies: rows as DbRow[] };
  }

  async adminProducts(user: PublicUser, companyId = "", term = "", active = "all"): Promise<{ products: DbRow[] }> {
    const filter = activeFilter(active);
    let selected: number | null = null;
    if (companyId && companyId !== "0") {
      selected = Number(companyId);
      if (!Number.isSafeInteger(selected) || selected <= 0) throw new BadRequestException("Empresa invalida.");
    }
    const like = `%${term.trim()}%`;
    const rows = await this.database.db.prepare(`SELECT p.*, c.name AS company_name,
      COALESCE(h.sold_quantity, 0) AS total_sold_quantity,
      COALESCE(h.sales_revenue, 0) AS total_sales_revenue,
      CASE WHEN COALESCE(h.sold_quantity, 0) > 0
        THEN COALESCE(h.sales_revenue, 0) / h.sold_quantity ELSE 0 END AS average_practiced_price
      FROM products p
      JOIN companies c ON c.id = p.company_id AND c.tenant_id = p.tenant_id
      LEFT JOIN (
        SELECT pi.product_id,
          SUM(pi.quantity) AS sold_quantity,
          SUM(pi.quantity * pi.negotiated_price) AS sales_revenue
        FROM proposal_items pi
        JOIN proposals po ON po.id = pi.proposal_id
        WHERE po.tenant_id = ? AND po.status IN (${SOLD_STATUSES_SQL})
        GROUP BY pi.product_id
      ) h ON h.product_id = p.id
      WHERE p.tenant_id = ?
        AND (? IS NULL OR p.company_id = ?)
        AND (? IS NULL OR p.active = ?)
        AND (? = '' OR p.code LIKE ? OR p.name LIKE ? OR c.name LIKE ?)
      ORDER BY c.name, p.code`)
      .all(user.tenant_id, user.tenant_id, selected, selected, filter, filter, term.trim(), like, like, like);
    return { products: rows as DbRow[] };
  }

  private async companyExists(tenantId: number, companyId: number): Promise<void> {
    if (!await this.database.db.prepare("SELECT id FROM companies WHERE id = ? AND tenant_id = ?").get(companyId, tenantId)) {
      throw new NotFoundException("Empresa nao encontrada.");
    }
  }


  async createCompany(user: PublicUser, data: {name:string;legal_name?:string|null;active?:boolean;trade_name?:string|null;cnpj?:string|null;state_registration?:string|null;tax_regime?:string|null;address?:string|null;address_number?:string|null;address_complement?:string|null;district?:string|null;city?:string|null;state?:string|null;postal_code?:string|null;phone?:string|null;email?:string|null;website?:string|null;lead_time_days?:number}): Promise<{id:number;message:string}> {
    const name=String(data.name??"").trim();
    if(!name) throw new BadRequestException("Informe o nome da empresa.");
    const result=await this.database.db.prepare(
      "INSERT INTO companies (tenant_id,name,legal_name,trade_name,cnpj,state_registration,tax_regime,address,address_number,address_complement,district,city,state,postal_code,phone,email,website,lead_time_days,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).run(user.tenant_id,name,nullableText(data.legal_name),nullableText(data.trade_name),nullableText(data.cnpj),nullableText(data.state_registration),nullableText(data.tax_regime),nullableText(data.address),nullableText(data.address_number),nullableText(data.address_complement),nullableText(data.district),nullableText(data.city),nullableText(data.state),nullableText(data.postal_code),nullableText(data.phone),nullableText(data.email),nullableText(data.website),Number(data.lead_time_days??0),data.active===false?0:1);
    return {id:Number(result.lastInsertRowid),message:"Empresa cadastrada."};
  }

  async updateCompany(user:PublicUser,id:number,data:{name:string;legal_name?:string|null;active?:boolean;trade_name?:string|null;cnpj?:string|null;state_registration?:string|null;tax_regime?:string|null;address?:string|null;address_number?:string|null;address_complement?:string|null;district?:string|null;city?:string|null;state?:string|null;postal_code?:string|null;phone?:string|null;email?:string|null;website?:string|null;lead_time_days?:number}):Promise<{id:number;message:string}> {
    const name=String(data.name??"").trim();
    if(!name) throw new BadRequestException("Informe o nome da empresa.");
    const result=await this.database.db.prepare(
      "UPDATE companies SET name=?,legal_name=?,trade_name=?,cnpj=?,state_registration=?,tax_regime=?,address=?,address_number=?,address_complement=?,district=?,city=?,state=?,postal_code=?,phone=?,email=?,website=?,lead_time_days=?,active=? WHERE id=? AND tenant_id=?"
    ).run(name,nullableText(data.legal_name),nullableText(data.trade_name),nullableText(data.cnpj),nullableText(data.state_registration),nullableText(data.tax_regime),nullableText(data.address),nullableText(data.address_number),nullableText(data.address_complement),nullableText(data.district),nullableText(data.city),nullableText(data.state),nullableText(data.postal_code),nullableText(data.phone),nullableText(data.email),nullableText(data.website),Number(data.lead_time_days??0),data.active===false?0:1,id,user.tenant_id);
    if(!result.changes) throw new NotFoundException("Empresa nao encontrada.");
    return {id,message:"Empresa atualizada."};
  }

  deleteCompany(user: PublicUser, id: number): Promise<{ message: string }> {
    return this.database.transaction(async () => {
      const company = await this.database.db.prepare("SELECT id FROM companies WHERE id = ? AND tenant_id = ?")
        .get(id, user.tenant_id);
      if (!company) throw new NotFoundException("Empresa nao encontrada.");

      const proposals = await this.database.db.prepare("SELECT id FROM proposals WHERE company_id = ? AND tenant_id = ?")
        .all(id, user.tenant_id) as Array<{ id: number }>;
      if (proposals.length > 0) {
        const placeholders = proposals.map(() => "?").join(",");
        const proposalIds = proposals.map((proposal) => Number(proposal.id));
        await this.database.db.prepare(`DELETE FROM proposal_items WHERE proposal_id IN (${placeholders})`).run(...proposalIds);
        await this.database.db.prepare(`DELETE FROM proposal_events WHERE proposal_id IN (${placeholders})`).run(...proposalIds);
        await this.database.db.prepare(`DELETE FROM proposal_invoice_files WHERE proposal_id IN (${placeholders})`).run(...proposalIds);
        await this.database.db.prepare(`DELETE FROM proposals WHERE id IN (${placeholders})`).run(...proposalIds);
      }

      await this.database.db.prepare("DELETE FROM products WHERE company_id = ? AND tenant_id = ?").run(id, user.tenant_id);
      await this.database.db.prepare("DELETE FROM company_sellers WHERE company_id = ?").run(id);
      await this.database.db.prepare("DELETE FROM companies WHERE id = ? AND tenant_id = ?").run(id, user.tenant_id);
      return { message: "Empresa excluida definitivamente." };
    });
  }

  private async productData(user: PublicUser, data: ProductMutation) {
    const companyId = Number(data.company_id);
    if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new BadRequestException("company_id invalido.");
    await this.companyExists(user.tenant_id, companyId);
    const code = String(data.code ?? "").trim();
    const name = String(data.name ?? "").trim();
    if (!code || !name) throw new BadRequestException("Informe code e name.");
    const unit = String(data.unit || "UN").trim() || "UN";
    const price = Number(data.price || 0);
    const minimumSaleQuantity = Number(data.minimum_sale_quantity || 0);
    const weight = Number(data.weight || 0);
    const ipiPercent = Number(data.ipi_percent || 0);
    if (![price, minimumSaleQuantity, weight, ipiPercent].every(Number.isFinite)) {
      throw new BadRequestException("Valores numericos do produto invalidos.");
    }
    return {
      companyId,
      code,
      name,
      productGroup: nullableText(data.product_group),
      subgroup: nullableText(data.subgroup),
      unit,
      brand: nullableText(data.brand),
      minimumSaleQuantity,
      weight,
      ncm: nullableText(data.ncm),
      ipiPercent,
      hasSt: data.has_st ? 1 : 0,
      invoiceOrigin: nullableText(data.invoice_origin),
      price,
      active: data.active === false ? 0 : 1,
    };
  }

  async createProduct(user: PublicUser, data: ProductMutation) {
    const p = await this.productData(user, data);
    try {
      await this.database.transaction(async () => {
        const updated = await this.database.db.prepare(`UPDATE products SET
          name=?,product_group=?,subgroup=?,unit=?,brand=?,minimum_sale_quantity=?,weight=?,ncm=?,ipi_percent=?,
          has_st=?,invoice_origin=?,price=?,active=?
          WHERE tenant_id=? AND company_id=? AND code=?`)
          .run(
            p.name,p.productGroup,p.subgroup,p.unit,p.brand,p.minimumSaleQuantity,p.weight,p.ncm,p.ipiPercent,
            p.hasSt,p.invoiceOrigin,p.price,p.active,user.tenant_id,p.companyId,p.code,
          );
        if (!updated.changes) {
          await this.database.db.prepare(`INSERT INTO products
            (tenant_id,company_id,code,name,product_group,subgroup,unit,brand,minimum_sale_quantity,weight,ncm,
             ipi_percent,has_st,invoice_origin,price,active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(
              user.tenant_id,p.companyId,p.code,p.name,p.productGroup,p.subgroup,p.unit,p.brand,
              p.minimumSaleQuantity,p.weight,p.ncm,p.ipiPercent,p.hasSt,p.invoiceOrigin,p.price,p.active,
            );
        }
      });
      const row = await this.database.db.prepare("SELECT id FROM products WHERE tenant_id=? AND company_id=? AND code=?")
        .get(user.tenant_id,p.companyId,p.code) as {id:number}|undefined;
      if (!row) throw new Error("Produto nao encontrado apos gravacao.");
      return {id:row.id,message:"Produto salvo."};
    } catch {
      throw new ConflictException("Nao foi possivel cadastrar o produto.");
    }
  }

  async updateProduct(user: PublicUser, id: number, data: ProductMutation) {
    const p = await this.productData(user, data);
    try {
      const result = await this.database.db.prepare(`UPDATE products SET
        company_id=?,code=?,name=?,product_group=?,subgroup=?,unit=?,brand=?,minimum_sale_quantity=?,weight=?,ncm=?,
        ipi_percent=?,has_st=?,invoice_origin=?,price=?,active=?
        WHERE id=? AND tenant_id=?`)
        .run(
          p.companyId,p.code,p.name,p.productGroup,p.subgroup,p.unit,p.brand,p.minimumSaleQuantity,p.weight,p.ncm,
          p.ipiPercent,p.hasSt,p.invoiceOrigin,p.price,p.active,id,user.tenant_id,
        );
      if (!result.changes) throw new NotFoundException("Produto nao encontrado.");
      return {id,message:"Produto atualizado."};
    } catch(error) {
      if(error instanceof NotFoundException) throw error;
      throw new ConflictException("Ja existe um produto com esse codigo nesse fornecedor.");
    }
  }

  deleteProduct(user:PublicUser,id:number) {
    return this.database.transaction(async ()=>{
      const row=await this.database.db.prepare("SELECT id FROM products WHERE id=? AND tenant_id=?")
        .get(id,user.tenant_id);
      if(!row) throw new NotFoundException("Produto nao encontrado.");
      if(await this.database.db.prepare("SELECT TOP (1) 1 FROM proposal_items WHERE product_id=?").get(id)){
        throw new ConflictException("Produto ja usado em pedido. Inative o produto para preservar o historico.");
      }
      await this.database.db.prepare("DELETE FROM products WHERE id=? AND tenant_id=?").run(id,user.tenant_id);
      return {message:"Produto excluido."};
    });
  }
}
