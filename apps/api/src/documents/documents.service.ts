import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import PDFDocument from "pdfkit";
import { DatabaseRepository } from "../database/database.repository.js";

type Row = Record<string, unknown>;
type Line = { label: string; value: unknown };

function money(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function safeDate(value: unknown): string {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.valueOf()) ? String(value || "-") : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dateOnly(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function object(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value === "string") {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return {};
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function payloadField(payload: Row, ...keys: string[]): string {
  const nested = object(payload.row);
  for (const key of keys) {
    const value = first(payload[key], nested[key]);
    if (value) return value;
  }
  return "";
}

function isBonus(value: unknown): boolean {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("bonificacao");
}

export function orderMirrorNumber(orderNumber: unknown, id: unknown, orderType: unknown): string {
  return `${first(orderNumber, id) || "-"} / ${isBonus(orderType) ? "B" : "V"}`;
}

export function customerMirrorData(row: Row) {
  const payload = object(row.customer_form_payload);
  const street = payloadField(payload, "address", "street", "logradouro") || first(row.customer_address);
  const number = payloadField(payload, "address_number", "number", "numero");
  const neighborhood = payloadField(payload, "neighborhood", "bairro");
  const city = payloadField(payload, "city", "cidade", "municipio");
  const state = payloadField(payload, "state", "uf");
  const zipCode = payloadField(payload, "zip_code", "cep");
  const billingAddress = [
    [street, number ? `Nº ${number}` : ""].filter(Boolean).join(", "),
    neighborhood,
    [city, state].filter(Boolean).join("/"),
    zipCode ? `CEP ${zipCode}` : "",
  ].filter(Boolean).join(" - ");
  const warnings = [
    payloadField(payload, "scheduling_instructions"),
    payloadField(payload, "delivery_warnings"),
  ].filter((value, index, values) => value && values.indexOf(value) === index).join(" - ");
  return {
    legalName: first(row.customer_name),
    tradeName: first(row.customer_trade_name),
    cnpj: first(row.customer_cnpj),
    stateRegistration: first(row.customer_state_registration),
    street,
    number,
    neighborhood,
    city,
    state,
    zipCode,
    phone: first(row.customer_phone),
    email: first(row.customer_email),
    deliveryAddress: payloadField(payload, "delivery_address") || billingAddress,
    deliveryWarnings: warnings,
  };
}

@Injectable()
export class DocumentsService {
  constructor(private readonly database: DatabaseRepository) {}

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
    const proposal = await this.database.db.prepare(`SELECT p.*,u.name seller_name,
      c.legal_name customer_name,c.trade_name customer_trade_name,c.cnpj customer_cnpj,
      c.state_registration customer_state_registration,c.address customer_address,c.phone customer_phone,
      c.email customer_email,c.form_payload customer_form_payload,
      co.name company_name,co.legal_name company_legal_name
      FROM proposals p JOIN users u ON u.id=p.seller_id JOIN customers c ON c.id=p.customer_id
      JOIN companies co ON co.id=p.company_id WHERE p.id=? AND p.tenant_id=?`).get(id, user.tenant_id) as Row | undefined;
    if (!proposal) throw new NotFoundException("Pedido nao encontrado.");
    if (!hasAdminAccess(user.role) && Number(proposal.seller_id) !== user.id) throw new ForbiddenException("Acesso negado.");
    const items = await this.database.db.prepare(`SELECT pr.code,pr.name,pr.unit,pr.price,pi.quantity,pi.negotiated_price,
      pi.quantity*pi.negotiated_price total FROM proposal_items pi JOIN products pr ON pr.id=pi.product_id
      WHERE pi.proposal_id=? ORDER BY pi.id`).all(id) as Row[];
    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const customer = customerMirrorData(proposal);
    const number = orderMirrorNumber(proposal.order_number, id, proposal.order_type);
    const bonus = isBonus(proposal.order_type);
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: "A4", layout: "landscape", margin: 26, bufferPages: true,
        info: { Title: `${bonus ? "Pedido de bonificação" : "Pedido de venda"} ${number}`, Author: "HiperSales" } });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      const left = 26, width = 790, half = 386, right = left + half + 12;
      const rule = (y: number) => document.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor("#111111").stroke();
      const heading = (text: string, x: number, y: number, w: number) => document.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(text, x, y, { width: w });
      const line = (label: string, value: unknown, x: number, y: number, labelWidth = 58, valueWidth = 315) => {
        document.font("Helvetica").fontSize(8).fillColor("#111111").text(`${label}:`, x, y, { width: labelWidth });
        document.text(first(value) || "-", x + labelWidth, y, { width: valueWidth });
      };
      const pageHeader = () => {
        document.font("Helvetica-Bold").fontSize(16).text(bonus ? "PEDIDO DE BONIFICAÇÃO" : "PEDIDO DE VENDA", left, 28);
        document.fontSize(12).text(number, left + width - 130, 30, { width: 130, align: "right" });
        rule(48);
      };
      pageHeader();
      heading("FORNECEDOR", left + 2, 56, half);
      line("R. Social", first(proposal.company_legal_name, proposal.company_name), left + 2, 69);
      line("Fantasia", proposal.company_name, left + 205, 69, 45, 135);
      line("CNPJ", "-", left + 2, 82);
      line("Inscrição Estadual", "-", left + 205, 82, 86, 105);
      line("Endereço", "-", left + 2, 95);
      line("Telefone", "-", left + 2, 108);
      line("E-mail", "-", left + 2, 121);
      document.moveTo(right - 6, 49).lineTo(right - 6, 143).stroke();
      heading("DADOS PARA FATURAMENTO / CLIENTE", right, 56, half);
      line("R. Social", customer.legalName, right, 69, 52, 205);
      line("Fantasia", customer.tradeName, right + 258, 69, 45, 90);
      line("CNPJ", customer.cnpj, right, 82, 52, 150);
      line("Inscrição Estadual", customer.stateRegistration, right + 202, 82, 86, 100);
      line("Endereço", customer.street, right, 95, 52, 210);
      line("Número", customer.number, right + 266, 95, 42, 80);
      line("Bairro", customer.neighborhood, right, 108, 52, 150);
      line("Município/UF", [customer.city, customer.state].filter(Boolean).join(" - "), right + 202, 108, 70, 115);
      line("Telefone", customer.phone, right, 121, 52, 150);
      line("CEP", customer.zipCode, right + 202, 121, 28, 90);
      line("E-mail", customer.email, right, 134, 52, 300);
      rule(146);
      heading("CONDIÇÕES NEGOCIADAS:", left + 2, 154, half);
      line("Tipo Pedido", bonus ? "BONIFICAÇÃO" : "VENDA", left + 2, 168, 56, 130);
      line("Nº Ordem Compras", proposal.purchase_order, left + 205, 168, 86, 100);
      line("NF-e", proposal.invoice_type, left + 2, 181, 56, 130);
      line("Operador Fiscal", proposal.tax_operator_invoice ? "SIM" : "NÃO", left + 205, 181, 86, 100);
      line("Frete", proposal.freight_type, left + 2, 194, 56, 130);
      line("Tipo de Entrega", proposal.delivery_type, left + 205, 194, 86, 100);
      line("Desconto", Number(proposal.discount_percent || 0) > 0 ? "SIM" : "NÃO", left + 2, 207, 56, 130);
      line("Dt Programada", dateOnly(proposal.scheduled_delivery_date), left + 205, 207, 86, 100);
      line("% Desconto", Number(proposal.discount_percent || 0) ? `${proposal.discount_percent}% ${first(proposal.discount_on)}` : "-", left + 2, 220, 56, 130);
      line("Previsão Entrega", proposal.delivery_forecast, left + 205, 220, 86, 100);
      line("Pagamento", proposal.payment_terms, left + 205, 233, 86, 100);
      document.moveTo(right - 6, 147).lineTo(right - 6, 249).stroke();
      heading("ENDEREÇO DE ENTREGA:", right, 154, half);
      document.font("Helvetica").fontSize(8).text(customer.deliveryAddress || "-", right, 168, { width: half, height: 30 });
      heading("ADVERTÊNCIAS DE RECEBIMENTO:", right, 202, half);
      document.font("Helvetica").fontSize(8).text(customer.deliveryWarnings || "-", right, 216, { width: half, height: 31 });
      rule(251);
      heading("OBSERVAÇÕES DO PEDIDO:", left + 2, 259, width);
      document.font("Helvetica").fontSize(8).text(first(proposal.notes) || "-", left + 2, 273, { width, height: 34 });
      rule(310);
      const columns = [45, 55, 55, 225, 60, 35, 60, 60, 75, 120];
      const headers = ["Qtde", "Emb. Venda", "Código", "Descrição do Produto", "NCM", "%IPI", "Custo s/IPI", "Custo c/IPI", "Preço Negociado", "Subtotal Produtos"];
      const tableHeader = (y: number) => {
        let x = left;
        document.font("Helvetica-Bold").fontSize(7);
        headers.forEach((header, index) => { document.text(header, x + 2, y, { width: columns[index] - 4, height: 20 }); x += columns[index]; });
        document.moveTo(left, y + 21).lineTo(left + width, y + 21).lineWidth(0.7).stroke();
      };
      let y = 315;
      tableHeader(y); y += 27;
      let quantityTotal = 0;
      for (const item of items) {
        if (y > 525) { document.addPage(); pageHeader(); y = 60; tableHeader(y); y += 27; }
        quantityTotal += Number(item.quantity || 0);
        const values = [item.quantity, item.unit, item.code, item.name, "-", "-", money(item.price), money(item.price), money(item.negotiated_price), money(item.total)];
        let x = left;
        document.font("Helvetica").fontSize(7);
        values.forEach((value, index) => { document.text(first(value) || "-", x + 2, y, { width: columns[index] - 4, height: 18, align: index >= 6 ? "right" : "left" }); x += columns[index]; });
        y += 18;
      }
      if (y > 520) { document.addPage(); pageHeader(); y = 72; }
      document.font("Helvetica").fontSize(8).text(`Qtd Total:  ${quantityTotal}`, left + 2, y + 5);
      document.text(`Vlr Total do Pedido:  ${money(total)}`, left + width - 220, y + 5, { width: 218, align: "right" });
      const range = document.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page++) {
        document.switchToPage(page);
        rule(550);
        document.font("Helvetica").fontSize(7).text(`HiperSales Software  |  Emitido em ${safeDate(new Date().toISOString())} por ${first(proposal.seller_name)}`, left + 2, 556, { width: 600 });
        document.font("Helvetica-Bold").text(`Pág. ${page + 1}/${range.count}`, left + width - 70, 556, { width: 68, align: "right" });
      }
      document.end();
    });
  }

  async occurrence(user: PublicUser, id: number): Promise<Buffer> {
    const row = await this.database.db.prepare(`SELECT o.*,u.name seller_name,c.legal_name customer_name,c.cnpj
      FROM occurrences o JOIN users u ON u.id=o.seller_id JOIN customers c ON c.id=o.customer_id
      WHERE o.id=? AND o.tenant_id=?`).get(id, user.tenant_id) as Row | undefined;
    if (!row) throw new NotFoundException("Ocorrencia nao encontrada.");
    const events = await this.database.db.prepare(`SELECT status,title,notes,created_at FROM occurrence_events
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
    const customer = await this.database.db.prepare("SELECT * FROM customers WHERE id=? AND tenant_id=?")
      .get(customerId, user.tenant_id) as Row | undefined;
    if (!customer) throw new NotFoundException("Cliente nao encontrado.");
    const rows = await this.database.db.prepare(`SELECT p.order_number,p.status,p.created_at,co.name company_name,
      COALESCE(SUM(pi.quantity*pi.negotiated_price),0) total FROM proposals p JOIN companies co ON co.id=p.company_id
      LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE p.customer_id=? AND p.tenant_id=?
      GROUP BY p.order_number,p.status,p.created_at,co.name ORDER BY p.created_at DESC`).all(customerId, user.tenant_id) as Row[];
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
    if (query.date_from) { where.push("CAST(p.created_at AS date)>=CAST(? AS date)"); params.push(query.date_from); }
    if (query.date_to) { where.push("CAST(p.created_at AS date)<=CAST(? AS date)"); params.push(query.date_to); }
    const rows = await this.database.db.prepare(`SELECT p.order_number,p.status,p.created_at,u.name seller_name,c.legal_name customer_name,
      co.name company_name,COALESCE(SUM(pi.quantity*pi.negotiated_price),0) total FROM proposals p
      JOIN users u ON u.id=p.seller_id JOIN customers c ON c.id=p.customer_id JOIN companies co ON co.id=p.company_id
      LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE ${where.join(" AND ")}
      GROUP BY p.order_number,p.status,p.created_at,u.name,c.legal_name,co.name ORDER BY p.created_at DESC`).all(...params) as Row[];
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    return this.pdf(`Relatorio - ${type.replaceAll("_", " ")}`, `${rows.length} registros | Total ${money(total)}`, [
      { title: "Pedidos", lines: rows.map((row) => ({ label: `#${row.order_number} - ${row.customer_name}`,
        value: `${row.company_name} | ${row.seller_name} | ${row.status} | ${money(row.total)}` })) },
    ]);
  }
}
