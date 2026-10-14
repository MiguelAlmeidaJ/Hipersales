import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";
import { normalizeProposalTimeline } from "../proposals/proposals.service.js";

interface DashboardFilters {
  q?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}

type DbRow = Record<string, unknown>;
const ORDER_STATUSES = new Set([
  "em_analise",
  "pedido_aprovado",
  "recusado",
  "em_producao",
  "faturado",
  "entregue",
]);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseRepository) {}

  async adminSummary(user: PublicUser) {
    const db = this.database.db;
    const registrationRequests = await db.prepare(`SELECT rr.*, u.name AS seller_name
      FROM registration_requests rr
      JOIN users u ON u.id = rr.seller_id AND u.tenant_id = rr.tenant_id
      WHERE rr.tenant_id = ? ORDER BY rr.created_at DESC`).all(user.tenant_id) as DbRow[];
    const proposals = await db.prepare(`SELECT p.*, u.name AS seller_name,
      COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
      u.whatsapp_phone AS seller_whatsapp_phone,
      c.legal_name AS customer_name, c.trade_name AS customer_trade_name,
      c.cnpj AS customer_cnpj, c.state_registration AS customer_state_registration,
      c.address AS customer_address, c.phone AS customer_phone, c.email AS customer_email,
      co.name AS company_name
      FROM proposals p
      JOIN users u ON u.id = p.seller_id AND u.tenant_id = p.tenant_id
      JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
      JOIN companies co ON co.id = p.company_id AND co.tenant_id = p.tenant_id
      WHERE p.tenant_id = ? ORDER BY p.created_at DESC`).all(user.tenant_id) as DbRow[];
    const items = db.prepare(`SELECT pi.*, pr.code, pr.name, pr.unit
      FROM proposal_items pi JOIN products pr ON pr.id = pi.product_id
      WHERE pi.proposal_id = ? ORDER BY pi.id`);
    const events = db.prepare(`SELECT pe.*, u.name AS created_by_name
      FROM proposal_events pe LEFT JOIN users u ON u.id = pe.created_by
      WHERE pe.proposal_id = ? ORDER BY pe.created_at, pe.id`);
    return {
      registration_requests: registrationRequests,
      proposals: await Promise.all(proposals.map(async (proposal) => ({
        ...proposal,
        items: await items.all(proposal.id as number),
        timeline: normalizeProposalTimeline(await events.all(proposal.id as number) as DbRow[]),
      }))),
    };
  }

  async summary(user: PublicUser) {
    const row = hasAdminAccess(user.role)
      ? await this.database.db.prepare(`SELECT
          (SELECT COUNT(*) FROM customers WHERE tenant_id = ?) AS customers,
          (SELECT COUNT(*) FROM proposals WHERE tenant_id = ?) AS proposals,
          (SELECT COUNT(*) FROM proposals WHERE tenant_id = ? AND status = 'pedido_aprovado') AS orders,
          (SELECT COUNT(*) FROM registration_requests WHERE tenant_id = ? AND status = 'pendente') AS pending_requests`)
        .get(user.tenant_id, user.tenant_id, user.tenant_id, user.tenant_id)
      : await this.database.db.prepare(`SELECT
          (SELECT COUNT(*) FROM customer_sellers cs JOIN customers c ON c.id = cs.customer_id
            WHERE cs.seller_id = ? AND c.tenant_id = ?) AS customers,
          (SELECT COUNT(*) FROM proposals WHERE seller_id = ? AND tenant_id = ?) AS proposals,
          (SELECT COUNT(*) FROM proposals WHERE seller_id = ? AND tenant_id = ? AND status = 'pedido_aprovado') AS orders,
          (SELECT COUNT(*) FROM registration_requests WHERE seller_id = ? AND tenant_id = ? AND status = 'pendente') AS pending_requests`)
        .get(user.id, user.tenant_id, user.id, user.tenant_id, user.id, user.tenant_id, user.id, user.tenant_id);
    return { summary: row as DbRow };
  }

  async adminOverview(user: PublicUser) {
    const tenantId = user.tenant_id;
    const developerFilter = user.role === "dev" ? "" : " AND role <> 'dev' AND COALESCE(is_dev, 0) = 0 AND COALESCE(is_super_admin, 0) = 0";
    const summary = await this.database.db.prepare(`SELECT
      (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND active = 1${developerFilter}) AS users,
      (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'admin' AND active = 1) AS admins,
      (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'seller' AND active = 1) AS sellers,
      (SELECT COUNT(*) FROM companies WHERE tenant_id = ? AND active = 1) AS companies,
      (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND active = 1) AS products,
      (SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND active = 1) AS customers,
      (SELECT COUNT(*) FROM customer_sellers cs JOIN customers c ON c.id = cs.customer_id WHERE c.tenant_id = ?) AS associations,
      (SELECT COUNT(*) FROM proposals WHERE tenant_id = ?) AS proposals,
      (SELECT COUNT(*) FROM proposals WHERE tenant_id = ? AND status = 'pedido_aprovado') AS approved_orders,
      (SELECT COUNT(*) FROM registration_requests WHERE tenant_id = ? AND status = 'pendente') AS pending_requests,
      (SELECT COUNT(*) FROM email_outbox WHERE tenant_id = ?) AS outbox`)
      .get(...Array(11).fill(tenantId)) as DbRow;
    const statusRows = await this.database.db
      .prepare("SELECT status, COUNT(*) AS total FROM proposals WHERE tenant_id = ? GROUP BY status")
      .all(tenantId) as Array<{ status: string; total: number }>;
    return { summary, status_counts: Object.fromEntries(statusRows.map((row) => [row.status, row.total])) };
  }

  async executive(user: PublicUser, rawFilters: DashboardFilters) {
    const tenantId = user.tenant_id;
    const tenant = await this.database.db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId) as DbRow | undefined;
    if (!tenant) throw new NotFoundException("Tenant nao encontrado.");
    const filters = {
      q: String(rawFilters.q ?? "").trim().slice(0, 120),
      status: String(rawFilters.status ?? "").trim().slice(0, 60),
      date_from: String(rawFilters.date_from ?? "").trim(),
      date_to: String(rawFilters.date_to ?? "").trim(),
    };
    if (filters.status && !ORDER_STATUSES.has(filters.status)) throw new BadRequestException("Status invalido.");
    for (const value of [filters.date_from, filters.date_to]) {
      if (value && !validDate(value)) throw new BadRequestException("Data invalida (AAAA-MM-DD).");
    }
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
      throw new BadRequestException("Data inicial posterior a data final.");
    }

    const where = ["p.tenant_id = ?"];
    const parameters: Array<string | number> = [tenantId];
    if (filters.status) { where.push("p.status = ?"); parameters.push(filters.status); }
    if (filters.date_from) { where.push("CAST(p.created_at AS date) >= CAST(? AS date)"); parameters.push(filters.date_from); }
    if (filters.date_to) { where.push("CAST(p.created_at AS date) <= CAST(? AS date)"); parameters.push(filters.date_to); }
    if (filters.q) {
      where.push(`(c.legal_name LIKE ? OR co.name LIKE ? OR CAST(p.order_number AS nvarchar(max)) LIKE ? OR EXISTS
        (SELECT 1 FROM proposal_items pi JOIN products pr ON pr.id = pi.product_id
         WHERE pi.proposal_id = p.id AND pr.name LIKE ?))`);
      parameters.push(...Array(4).fill(`%${filters.q}%`));
    }
    const predicate = where.join(" AND ");
    const base = `FROM proposals p
      JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
      JOIN companies co ON co.id = p.company_id AND co.tenant_id = p.tenant_id
      LEFT JOIN (SELECT proposal_id,SUM(quantity*negotiated_price) total FROM proposal_items GROUP BY proposal_id) amounts
        ON amounts.proposal_id=p.id
      WHERE ${predicate}`;
    const totals = await this.database.db
      .prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(COALESCE(amounts.total,0)),0) AS revenue ${base}`)
      .get(...parameters) as DbRow;
    const orders = Number(totals.orders ?? 0);
    const revenue = Number(totals.revenue ?? 0);
    const summary = await this.database.db.prepare(`SELECT
      (SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND active = 1) AS customers,
      (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND active = 1) AS products,
      (SELECT COUNT(*) FROM companies WHERE tenant_id = ? AND active = 1) AS companies,
      (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'seller' AND active = 1) AS sellers,
      (SELECT COUNT(*) FROM registration_requests WHERE tenant_id = ? AND status = 'pendente') AS pending_requests`)
      .get(...Array(5).fill(tenantId)) as DbRow;
    Object.assign(summary, { orders, revenue, average_ticket: orders ? revenue / orders : 0 });

    const statuses = await this.database.db
      .prepare(`SELECT p.status AS status, COUNT(*) AS total ${base} GROUP BY p.status ORDER BY total DESC`)
      .all(...parameters) as DbRow[];
    const companyRanking = await this.database.db
      .prepare(`SELECT TOP (5) co.name AS name, COUNT(*) AS orders,
        COALESCE(SUM(COALESCE(amounts.total,0)),0) AS total
        ${base} GROUP BY co.id, co.name ORDER BY total DESC`)
      .all(...parameters) as DbRow[];
    const sellerRanking = await this.database.db
      .prepare(`SELECT TOP (5) u.name AS name, COUNT(*) AS orders,
        COALESCE(SUM(COALESCE(amounts.total,0)),0) AS total
        FROM proposals p
        JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
        JOIN companies co ON co.id = p.company_id AND co.tenant_id = p.tenant_id
        JOIN users u ON u.id = p.seller_id AND u.tenant_id = p.tenant_id
        LEFT JOIN (SELECT proposal_id,SUM(quantity*negotiated_price) total FROM proposal_items GROUP BY proposal_id) amounts
          ON amounts.proposal_id=p.id
        WHERE ${predicate} GROUP BY u.id, u.name ORDER BY total DESC`)
      .all(...parameters) as DbRow[];
    const topProducts = await this.database.db
      .prepare(`SELECT TOP (5) pr.name AS name, co.name AS company, SUM(pi.quantity) AS quantity,
        SUM(pi.quantity * pi.negotiated_price) AS total
        FROM proposals p
        JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
        JOIN companies co ON co.id = p.company_id AND co.tenant_id = p.tenant_id
        JOIN proposal_items pi ON pi.proposal_id = p.id
        JOIN products pr ON pr.id = pi.product_id AND pr.tenant_id = p.tenant_id
        WHERE ${predicate} GROUP BY pr.id, pr.name, co.name ORDER BY total DESC`)
      .all(...parameters) as DbRow[];
    const recentOrders = await this.database.db
      .prepare(`SELECT TOP (7) p.id, p.order_number, c.legal_name AS customer_name, co.name AS company_name,
        p.status, p.created_at, COALESCE(amounts.total,0) AS total
        ${base} ORDER BY p.created_at DESC, p.id DESC`)
      .all(...parameters) as DbRow[];
    return {
      tenant,
      summary,
      statuses,
      company_ranking: companyRanking,
      seller_ranking: sellerRanking,
      top_products: topProducts,
      recent_orders: recentOrders,
      filters,
    };
  }
}
