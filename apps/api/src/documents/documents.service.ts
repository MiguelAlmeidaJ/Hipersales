import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import PDFDocument from "pdfkit";
import { DatabaseService } from "../database/database.service.js";

type Row = Record<string, unknown>;
type Line = { label: string; value: unknown };

function money(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function safeDate(value: unknown): string {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.valueOf()) ? String(value || "-") : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

@Injectable()
export class DocumentsService {
  constructor(private readonly database: DatabaseService) {}

  private pdf(title: string, subtitle: string, sections: Array<{ title: string; lines: Line[] }>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: title, Author: "HiperSales" } });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      document.fillColor("#0B2A63").fontSize(22).text("HiperSales", { align: "right" });
      document.moveDown(0.4).fillColor("#102035").fontSize(18).text(title);
      document.fillColor("#617287").fontSize(9).text(subtitle).moveDown();
      for (const section of sections) {
        if (document.y > 700) document.addPage();
        document.fillColor("#0D6FD8").fontSize(12).text(section.title).moveDown(0.25);
        for (const line of section.lines) {
          document.fillColor("#617287").fontSize(8).text(line.label.toUpperCase(), { continued: true });
          document.fillColor("#102035").fontSize(10).text(`  ${String(line.value ?? "-")}`).moveDown(0.2);
        }
        document.moveDown(0.6);
      }
      document.end();
    });
  }

  async proposal(user: PublicUser, id: number): Promise<Buffer> {
    const proposal = this.database.db.prepare(`SELECT p.*,u.name seller_name,c.legal_name customer_name,c.cnpj,
      co.name company_name FROM proposals p JOIN users u ON u.id=p.seller_id JOIN customers c ON c.id=p.customer_id
      JOIN companies co ON co.id=p.company_id WHERE p.id=? AND p.tenant_id=?`).get(id, user.tenant_id) as Row | undefined;
    if (!proposal) throw new NotFoundException("Pedido nao encontrado.");
    if (user.role !== "admin" && Number(proposal.seller_id) !== user.id) throw new ForbiddenException("Acesso negado.");
    const items = this.database.db.prepare(`SELECT pr.code,pr.name,pr.unit,pi.quantity,pi.negotiated_price,
      pi.quantity*pi.negotiated_price total FROM proposal_items pi JOIN products pr ON pr.id=pi.product_id
      WHERE pi.proposal_id=? ORDER BY pi.id`).all(id) as Row[];
    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    return this.pdf(`Pedido #${proposal.order_number || id}`, `Gerado em ${safeDate(new Date().toISOString())}`, [
      { title: "Pedido", lines: [{ label: "Status", value: proposal.status }, { label: "Empresa", value: proposal.company_name },
        { label: "Cliente", value: proposal.customer_name }, { label: "CNPJ", value: proposal.cnpj },
        { label: "Representante", value: proposal.seller_name }, { label: "Criado em", value: safeDate(proposal.created_at) }] },
      { title: "Condicoes comerciais", lines: [{ label: "Pagamento", value: proposal.payment_terms },
        { label: "Frete", value: proposal.freight_type }, { label: "Entrega", value: proposal.delivery_type },
        { label: "Ordem de compra", value: proposal.purchase_order }, { label: "Observacoes", value: proposal.notes }] },
      { title: "Itens", lines: items.flatMap((item) => [{ label: `${item.code} - ${item.name}`,
        value: `${item.quantity} ${item.unit} x ${money(item.negotiated_price)} = ${money(item.total)}` }]).concat([{ label: "Total", value: money(total) }]) },
    ]);
  }

  async occurrence(user: PublicUser, id: number): Promise<Buffer> {
    const row = this.database.db.prepare(`SELECT o.*,u.name seller_name,c.legal_name customer_name,c.cnpj
      FROM occurrences o JOIN users u ON u.id=o.seller_id JOIN customers c ON c.id=o.customer_id
      WHERE o.id=? AND o.tenant_id=?`).get(id, user.tenant_id) as Row | undefined;
    if (!row) throw new NotFoundException("Ocorrencia nao encontrada.");
    const events = this.database.db.prepare(`SELECT status,title,notes,created_at FROM occurrence_events
      WHERE occurrence_id=? AND tenant_id=? ORDER BY created_at,id`).all(id, user.tenant_id) as Row[];
    return this.pdf(`Ocorrencia #${id}`, `Gerado em ${safeDate(new Date().toISOString())}`, [
      { title: "Registro", lines: [{ label: "Cliente", value: row.customer_name }, { label: "CNPJ", value: row.cnpj },
        { label: "Representante", value: row.seller_name }, { label: "Motivo", value: row.reason },
        { label: "Descricao", value: row.description }, { label: "Status", value: row.status },
        { label: "Resolucao", value: row.resolution }] },
      { title: "Historico", lines: events.map((event) => ({ label: `${safeDate(event.created_at)} - ${event.title}`, value: event.notes || event.status })) },
    ]);
  }

  async customerPerformance(user: PublicUser, customerId: number): Promise<{ buffer: Buffer; name: string }> {
    const customer = this.database.db.prepare("SELECT * FROM customers WHERE id=? AND tenant_id=?")
      .get(customerId, user.tenant_id) as Row | undefined;
    if (!customer) throw new NotFoundException("Cliente nao encontrado.");
    const rows = this.database.db.prepare(`SELECT p.order_number,p.status,p.created_at,co.name company_name,
      COALESCE(SUM(pi.quantity*pi.negotiated_price),0) total FROM proposals p JOIN companies co ON co.id=p.company_id
      LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE p.customer_id=? AND p.tenant_id=?
      GROUP BY p.id ORDER BY p.created_at DESC`).all(customerId, user.tenant_id) as Row[];
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const buffer = await this.pdf(`Desempenho - ${customer.legal_name}`, `Gerado em ${safeDate(new Date().toISOString())}`, [
      { title: "Cliente", lines: [{ label: "Razao social", value: customer.legal_name }, { label: "CNPJ", value: customer.cnpj },
        { label: "Pedidos", value: rows.length }, { label: "Faturamento", value: money(total) }] },
      { title: "Historico", lines: rows.map((row) => ({ label: `#${row.order_number} - ${row.company_name}`,
        value: `${safeDate(row.created_at)} | ${row.status} | ${money(row.total)}` })) },
    ]);
    return { buffer, name: String(customer.legal_name || `cliente-${customerId}`) };
  }

  async report(user: PublicUser, query: Record<string, string | undefined>): Promise<Buffer> {
    const allowed = new Set(["vendas", "pedidos", "bonificacoes", "produtos_vendidos", "prazo_pagamento", "fechamento_mensal"]);
    const type = String(query.type || "vendas");
    if (!allowed.has(type)) throw new BadRequestException("Tipo de relatorio invalido.");
    const where = ["p.tenant_id=?"]; const params: Array<string | number> = [user.tenant_id];
    for (const [key, column] of [["seller_id", "p.seller_id"], ["company_id", "p.company_id"], ["customer_id", "p.customer_id"]] as const) {
      if (query[key]) { const value = Number(query[key]); if (!Number.isSafeInteger(value) || value < 1) throw new BadRequestException("Filtro invalido."); where.push(`${column}=?`); params.push(value); }
    }
    if (query.status) { where.push("p.status=?"); params.push(query.status); }
    if (query.date_from) { where.push("substr(p.created_at,1,10)>=?"); params.push(query.date_from); }
    if (query.date_to) { where.push("substr(p.created_at,1,10)<=?"); params.push(query.date_to); }
    const rows = this.database.db.prepare(`SELECT p.order_number,p.status,p.created_at,u.name seller_name,c.legal_name customer_name,
      co.name company_name,COALESCE(SUM(pi.quantity*pi.negotiated_price),0) total FROM proposals p
      JOIN users u ON u.id=p.seller_id JOIN customers c ON c.id=p.customer_id JOIN companies co ON co.id=p.company_id
      LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE ${where.join(" AND ")}
      GROUP BY p.id ORDER BY p.created_at DESC`).all(...params) as Row[];
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    return this.pdf(`Relatorio - ${type.replaceAll("_", " ")}`, `${rows.length} registros | Total ${money(total)}`, [
      { title: "Pedidos", lines: rows.map((row) => ({ label: `#${row.order_number} - ${row.customer_name}`,
        value: `${row.company_name} | ${row.seller_name} | ${row.status} | ${money(row.total)}` })) },
    ]);
  }
}
