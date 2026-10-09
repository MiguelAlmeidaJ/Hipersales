import { Injectable, ForbiddenException, BadRequestException, NotFoundException, ConflictException } from "@nestjs/common";
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
  private companyExists(tenantId: number, companyId: number): void {
    if (!this.database.db.prepare("SELECT id FROM companies WHERE id = ? AND tenant_id = ?").get(companyId, tenantId)) {
      throw new NotFoundException("Empresa nao encontrada.");
    }
  }

  createCompany(user: PublicUser, data: {name:string;legal_name?:string|null;active?:boolean}): {id:number;message:string} {
    const name = String(data.name ?? "").trim();
    if (!name) throw new BadRequestException("Informe name.");
    try {
      const row = this.database.db.prepare("INSERT INTO companies (tenant_id,name,legal_name,active) VALUES (?,?,?,?)")
        .run(user.tenant_id, name, data.legal_name ?? null, data.active === false ? 0 : 1);
      return {id:Number(row.lastInsertRowid),message:"Empresa cadastrada."};
    } catch { throw new ConflictException("Nao foi possivel cadastrar a empresa."); }
  }

  updateCompany(user: PublicUser, id:number, data:{name:string;legal_name?:string|null;active?:boolean}): {id:number;message:string} {
    const name=String(data.name??"").trim();
    if(!name) throw new BadRequestException("Informe name.");
    try {
      const row=this.database.db.prepare("UPDATE companies SET name=?,legal_name=?,active=? WHERE id=? AND tenant_id=?")
        .run(name,data.legal_name??null,data.active===false?0:1,id,user.tenant_id);
      if(!row.changes) throw new NotFoundException("Empresa nao encontrada.");
    } catch(error) {
      if(error instanceof NotFoundException) throw error;
      throw new ConflictException("Nao foi possivel atualizar a empresa.");
    }
    return {id,message:"Empresa atualizada."};
  }

  deleteCompany(user: PublicUser, id: number): { message: string } {
    return this.database.transaction(() => {
      const company = this.database.db.prepare("SELECT id FROM companies WHERE id = ? AND tenant_id = ?")
        .get(id, user.tenant_id);
      if (!company) throw new NotFoundException("Empresa nao encontrada.");

      const proposals = this.database.db.prepare("SELECT id FROM proposals WHERE company_id = ? AND tenant_id = ?")
        .all(id, user.tenant_id) as Array<{ id: number }>;
      if (proposals.length > 0) {
        const placeholders = proposals.map(() => "?").join(",");
        const proposalIds = proposals.map((proposal) => Number(proposal.id));
        this.database.db.prepare(`DELETE FROM proposal_items WHERE proposal_id IN (${placeholders})`).run(...proposalIds);
        this.database.db.prepare(`DELETE FROM proposal_events WHERE proposal_id IN (${placeholders})`).run(...proposalIds);
        this.database.db.prepare(`DELETE FROM proposals WHERE id IN (${placeholders})`).run(...proposalIds);
      }

      this.database.db.prepare("DELETE FROM products WHERE company_id = ? AND tenant_id = ?").run(id, user.tenant_id);
      this.database.db.prepare("DELETE FROM companies WHERE id = ? AND tenant_id = ?").run(id, user.tenant_id);
      return { message: "Empresa excluida definitivamente." };
    });
  }

  private productData(user:PublicUser,data:{company_id:number;code:string;name:string;unit?:string;price?:number;active?:boolean}){
    const companyId=Number(data.company_id);
    if(!Number.isSafeInteger(companyId)||companyId<=0) throw new BadRequestException("company_id invalido.");
    this.companyExists(user.tenant_id,companyId);
    const code=String(data.code??"").trim(), name=String(data.name??"").trim();
    if(!code||!name) throw new BadRequestException("Informe code e name.");
    const unit=String(data.unit||"UN").trim()||"UN", price=Number(data.price||0);
    if(!Number.isFinite(price)) throw new BadRequestException("Preco invalido.");
    return {companyId,code,name,unit,price,active:data.active===false?0:1};
  }

  createProduct(user:PublicUser,data:{company_id:number;code:string;name:string;unit?:string;price?:number;active?:boolean}) {
    const p=this.productData(user,data);
    try {
      const result=this.database.db.prepare(`INSERT INTO products (tenant_id,company_id,code,name,unit,price,active)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(company_id,code) DO UPDATE SET
        name=excluded.name,unit=excluded.unit,price=excluded.price,active=excluded.active`)
        .run(user.tenant_id,p.companyId,p.code,p.name,p.unit,p.price,p.active);
      // SQLite last_insert_rowid is unreliable after an upsert conflict: resolve the canonical ID.
      const row=this.database.db.prepare("SELECT id FROM products WHERE tenant_id=? AND company_id=? AND code=?")
        .get(user.tenant_id,p.companyId,p.code) as {id:number}|undefined;
      if(!row) throw new Error("Produto nao encontrado apos gravacao.");
      return {id:row.id,message:"Produto salvo."};
    } catch {throw new ConflictException("Nao foi possivel cadastrar o produto.");}
  }

  updateProduct(user:PublicUser,id:number,data:{company_id:number;code:string;name:string;unit?:string;price?:number;active?:boolean}) {
    const p=this.productData(user,data);
    try {
      const result=this.database.db.prepare(`UPDATE products SET company_id=?,code=?,name=?,unit=?,price=?,active=?
        WHERE id=? AND tenant_id=?`).run(p.companyId,p.code,p.name,p.unit,p.price,p.active,id,user.tenant_id);
      if(!result.changes) throw new NotFoundException("Produto nao encontrado.");
      return {id,message:"Produto atualizado."};
    } catch(error) {
      if(error instanceof NotFoundException) throw error;
      throw new ConflictException("Ja existe um produto com esse codigo nesse fornecedor.");
    }
  }

  deleteProduct(user:PublicUser,id:number) {
    return this.database.transaction(()=>{
      const row=this.database.db.prepare("SELECT id FROM products WHERE id=? AND tenant_id=?")
        .get(id,user.tenant_id);
      if(!row) throw new NotFoundException("Produto nao encontrado.");
      if(this.database.db.prepare("SELECT 1 FROM proposal_items WHERE product_id=? LIMIT 1").get(id)){
        throw new ConflictException("Produto ja usado em pedido. Inative o produto para preservar o historico.");
      }
      this.database.db.prepare("DELETE FROM products WHERE id=? AND tenant_id=?").run(id,user.tenant_id);
      return {message:"Produto excluido."};
    });
  }

}
