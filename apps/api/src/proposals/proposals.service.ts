import { Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type Row = Record<string, unknown>;
const statusRank: Record<string, number> = {
  em_analise: 0, pedido_aprovado: 1, recusado: 1, em_producao: 2, faturado: 3, entregue: 4,
};

export function normalizeProposalTimeline(events: Row[]): Row[] {
  const seen = new Set<string>();
  let highest = -1;
  const result: Row[] = [];
  for (const event of events) {
    const status = String(event.status || "");
    const rank = statusRank[status];
    if (seen.has(status) || (rank !== undefined && rank < highest)) continue;
    if (rank !== undefined) highest = Math.max(highest, rank);
    seen.add(status);
    result.push(event);
  }
  return result;
}

@Injectable()
export class ProposalsService {
  constructor(private readonly database: DatabaseService) {}

  list(user: PublicUser) {
    const db = this.database.db;
    const sellerOnly = user.role !== "admin";
    const rows = db.prepare(`SELECT p.*, u.name AS seller_name,
      COALESCE(NULLIF(u.communication_email, ''), u.email) AS seller_email,
      u.whatsapp_phone AS seller_whatsapp_phone,
      c.legal_name AS customer_name, c.trade_name AS customer_trade_name,
      c.cnpj AS customer_cnpj, c.state_registration AS customer_state_registration,
      c.address AS customer_address, c.phone AS customer_phone, c.email AS customer_email,
      co.name AS company_name
      FROM proposals p
      JOIN users u ON u.id = p.seller_id
      JOIN customers c ON c.id = p.customer_id
      JOIN companies co ON co.id = p.company_id
      WHERE p.tenant_id = ? ${sellerOnly ? "AND p.seller_id = ?" : ""}
      ORDER BY p.created_at DESC`).all(
        ...(sellerOnly ? [user.tenant_id, user.id] : [user.tenant_id]),
      ) as Row[];

    const itemsQuery = db.prepare(`SELECT pi.*, pr.code, pr.name, pr.unit
      FROM proposal_items pi JOIN products pr ON pr.id = pi.product_id
      WHERE pi.proposal_id = ? ORDER BY pi.id`);
    const eventsQuery = db.prepare(`SELECT pe.*, u.name AS created_by_name
      FROM proposal_events pe LEFT JOIN users u ON u.id = pe.created_by
      WHERE pe.proposal_id = ? ORDER BY pe.created_at, pe.id`);
    return { proposals: rows.map(row => ({
      ...row,
      items: itemsQuery.all(row.id as number),
      timeline: normalizeProposalTimeline(eventsQuery.all(row.id as number) as Row[]),
    })) };
  }
}
