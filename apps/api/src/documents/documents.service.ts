import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import PDFDocument from "pdfkit";
import { DatabaseRepository } from "../database/database.repository.js";

type Row = Record<string, unknown>;
type Line = { label: string; value: unknown };
const SOLD_STATUSES_SQL = "'pedido_aprovado','em_producao','faturado','entregue'";
const BONUS_SQL = "LOWER(COALESCE(p.order_type,'')) COLLATE Latin1_General_CI_AI LIKE '%bonificacao%'";

type ReportColumn = {
  key: string;
  label: string;
  weight: number;
  align?: "left" | "right";
};

export type CommercialReport = {
  type: string;
  title: string;
  section: string;
  metrics: Array<{ label: string; value: string }>;
  columns: ReportColumn[];
  rows: Row[];
};

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
          if (document.y > 735) document.addPage();
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
      // Limit every field to its own rectangle. PDFKit wraps text by default;
      // wrapped fields previously collided with neighbouring columns.
      const compactText = (value: unknown, availableWidth: number, fontSize = 8) => {
        const full = first(value) || "-";
        document.font("Helvetica").fontSize(fontSize);
        if (document.widthOfString(full) <= availableWidth) return full;
        let low = 0;
        let high = full.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (document.widthOfString(full.slice(0, mid) + "…") <= availableWidth) low = mid;
          else high = mid - 1;
        }
        return low > 0 ? full.slice(0, low).trimEnd() + "…" : "…";
      };
      const line = (label: string, value: unknown, x: number, y: number, labelWidth = 58, valueWidth = 315) => {
        const boundedWidth = Math.max(15, Math.min(valueWidth, left + width - x - labelWidth - 3));
        document.font("Helvetica").fontSize(8).fillColor("#111111")
          .text(`${label}:`, x, y, { width: labelWidth, height: 11, lineBreak: false });
        document.text(compactText(value, boundedWidth), x + labelWidth, y, {
          width: boundedWidth, height: 11, lineBreak: false,
        });
      };
      const pageHeader = () => {
        document.font("Helvetica-Bold").fontSize(16).text(bonus ? "PEDIDO DE BONIFICAÇÃO" : "PEDIDO DE VENDA", left, 28);
        document.fontSize(12).text(number, left + width - 130, 30, { width: 130, align: "right" });
        rule(48);
      };
      pageHeader();
      heading("FORNECEDOR", left + 2, 56, half);
      line("R. Social", first(proposal.company_legal_name, proposal.company_name), left + 2, 69, 58, 135);
      line("Fantasia", proposal.company_name, left + 205, 69, 45, 130);
      line("CNPJ", "-", left + 2, 82);
      line("Inscrição Estadual", "-", left + 205, 82, 86, 105);
      line("Endereço", "-", left + 2, 95);
      line("Telefone", "-", left + 2, 108);
      line("E-mail", "-", left + 2, 121);
      document.moveTo(right - 6, 49).lineTo(right - 6, 143).stroke();
      heading("DADOS PARA FATURAMENTO / CLIENTE", right, 56, half);
      line("R. Social", customer.legalName, right, 69, 52, 200);
      line("Fantasia", customer.tradeName, right + 258, 69, 45, 90);
      line("CNPJ", customer.cnpj, right, 82, 52, 145);
      line("Inscrição Estadual", customer.stateRegistration, right + 202, 82, 86, 100);
      line("Endereço", customer.street, right, 95, 52, 205);
      line("Número", customer.number, right + 266, 95, 42, 80);
      line("Bairro", customer.neighborhood, right, 108, 52, 145);
      line("Município/UF", [customer.city, customer.state].filter(Boolean).join(" - "), right + 202, 108, 70, 115);
      line("Telefone", customer.phone, right, 121, 52, 145);
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
    const rows = await this.database.db.prepare(`SELECT p.order_number,p.status,p.created_at,p.payment_terms,co.name company_name,
      COALESCE(SUM(pi.quantity*pi.negotiated_price),0) total FROM proposals p JOIN companies co ON co.id=p.company_id
      LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE p.customer_id=? AND p.tenant_id=?
      GROUP BY p.order_number,p.status,p.created_at,p.payment_terms,co.name ORDER BY p.created_at DESC`).all(customerId, user.tenant_id) as Row[];
    const soldStatuses=new Set(["pedido_aprovado","em_producao","faturado","entregue"]);
    const sold=rows.filter(row=>soldStatuses.has(String(row.status)));
    const total = sold.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const dates=sold.map(row=>new Date(String(row.created_at))).filter(date=>!Number.isNaN(date.valueOf())).sort((a,b)=>a.valueOf()-b.valueOf());
    const intervals=dates.slice(1).map((date,index)=>(date.valueOf()-dates[index]!.valueOf())/86_400_000);
    const termAverages=sold.map(row=>String(row.payment_terms||"").match(/\d{1,3}/g)?.map(Number).filter(day=>day<=365)??[])
      .filter(days=>days.length).map(days=>days.reduce((sum,day)=>sum+day,0)/days.length);
    const averagePayment=termAverages.length?termAverages.reduce((sum,days)=>sum+days,0)/termAverages.length:0;
    const products=await this.database.db.prepare(`SELECT TOP (10) pr.code,pr.name,
      SUM(pi.quantity) quantity,SUM(pi.quantity*pi.negotiated_price) revenue
      FROM proposals p JOIN proposal_items pi ON pi.proposal_id=p.id JOIN products pr ON pr.id=pi.product_id
      WHERE p.customer_id=? AND p.tenant_id=? AND p.status IN (${SOLD_STATUSES_SQL})
      GROUP BY pr.code,pr.name ORDER BY revenue DESC`).all(customerId,user.tenant_id) as Row[];
    const companies=await this.database.db.prepare(`SELECT co.name,COUNT_BIG(*) order_count,
      COALESCE(SUM(pi.total),0) revenue FROM proposals p JOIN companies co ON co.id=p.company_id
      LEFT JOIN (SELECT proposal_id,SUM(quantity*negotiated_price) total FROM proposal_items GROUP BY proposal_id) pi ON pi.proposal_id=p.id
      WHERE p.customer_id=? AND p.tenant_id=? AND p.status IN (${SOLD_STATUSES_SQL})
      GROUP BY co.name ORDER BY revenue DESC`).all(customerId,user.tenant_id) as Row[];
    const statuses=new Map<string,number>();for(const row of rows)statuses.set(String(row.status),1+(statuses.get(String(row.status))||0));
    const labels:Record<string,string>={em_analise:"Em analise",pedido_aprovado:"Aprovado",em_producao:"Em producao",faturado:"Faturado",entregue:"Entregue",recusado:"Recusado"};
    const buffer = await this.pdf(`Analise do cliente - ${customer.legal_name}`, `Check-up comercial gerado em ${safeDate(new Date().toISOString())}`, [
      { title: "Cliente", lines: [{ label: "Razao social", value: customer.legal_name }, { label: "CNPJ", value: customer.cnpj },
        { label:"Status cadastral",value:customer.status|| (customer.active?"Ativo":"Inativo") },
        { label: "Pedidos realizados", value: rows.length },{label:"Pedidos validos",value:sold.length}, { label: "Faturamento acumulado", value: money(total) },
        {label:"Ticket medio",value:money(sold.length?total/sold.length:0)},{label:"Primeira compra",value:dates.length?dateOnly(dates[0]):"-"},
        {label:"Ultima compra",value:dates.length?dateOnly(dates.at(-1)):"-"},{label:"Intervalo medio entre compras",value:intervals.length?`${Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length)} dias`:"-"},
        {label:"Prazo medio de pagamento",value:averagePayment?`${Math.round(averagePayment)} dias`:"Nao identificado"}] },
      {title:"Situacao dos pedidos",lines:[...statuses].map(([status,count])=>({label:labels[status]||status,value:count}))},
      {title:"Produtos mais comprados",lines:products.length?products.map(row=>({label:`${row.code} - ${row.name}`,value:`${Number(row.quantity||0).toLocaleString("pt-BR")} unidades | ${money(row.revenue)}`})):[{label:"Historico",value:"Sem produtos vendidos"}]},
      {title:"Compras por industria",lines:companies.length?companies.map(row=>({label:String(row.name),value:`${row.order_count} pedidos | ${money(row.revenue)}`})):[{label:"Historico",value:"Sem compras aprovadas"}]},
      { title: "Ultimos pedidos", lines: rows.slice(0,20).map((row) => ({ label: `#${row.order_number} - ${row.company_name}`,
        value: `${safeDate(row.created_at)} | ${row.status} | ${money(row.total)}` })) },
    ]);
    return { buffer, name: String(customer.legal_name || `cliente-${customerId}`) };
  }

  async customerRegistration(user:PublicUser,customerId:number):Promise<{buffer:Buffer;name:string}> {
    const customer=await this.database.db.prepare("SELECT * FROM customers WHERE id=? AND tenant_id=?")
      .get(customerId,user.tenant_id) as Row|undefined;
    if(!customer) throw new NotFoundException("Cliente nao encontrado.");
    const payload=object(customer.form_payload);
    const raw=(...keys:string[])=>payloadField(payload,...keys);
    const field=(...keys:string[])=>raw(...keys)||"-";
    const sellers=await this.database.db.prepare(`SELECT u.name,u.email,u.communication_email FROM customer_sellers cs
      JOIN users u ON u.id=cs.seller_id WHERE cs.customer_id=? AND u.tenant_id=? ORDER BY u.name`)
      .all(customerId,user.tenant_id) as Row[];
    const buffer=await this.pdf(`Ficha cadastral - ${customer.legal_name}`,`Cliente #${customer.id} | Emitida em ${safeDate(new Date().toISOString())}`,[
      {title:"Identificacao",lines:[{label:"Status",value:customer.status|| (customer.active?"Ativo":"Inativo")},{label:"Razao social",value:customer.legal_name},{label:"Nome fantasia",value:customer.trade_name},{label:"CNPJ",value:customer.cnpj},{label:"Inscricao estadual",value:customer.state_registration},{label:"Inscricao municipal",value:field("municipal_registration")},{label:"Regime fiscal",value:field("tax_regime")},{label:"Ramo de atividade",value:field("business_sector")},{label:"Rede",value:field("network")},{label:"Grupo economico",value:field("economic_group")},{label:"Beneficio fiscal",value:field("tax_benefit")},{label:"Qual beneficio",value:field("tax_benefit_description")}]},
      {title:"Endereco e atendimento",lines:[{label:"Logradouro",value:raw("address","street")||customer.address||"-"},{label:"Numero",value:field("address_number","number")},{label:"Complemento",value:field("complement")},{label:"Bairro",value:field("neighborhood")},{label:"Cidade",value:field("city")},{label:"UF",value:field("state")},{label:"CEP",value:field("zip_code")},{label:"Regiao de atendimento",value:field("service_region")},{label:"Endereco de entrega",value:field("delivery_address")},{label:"Advertencias de recebimento",value:field("delivery_warnings")}]},
      {title:"Compras",lines:[{label:"Responsavel",value:field("buyer_contact","contact_person")},{label:"Telefone 1",value:field("buyer_phone_1","phone_1")},{label:"Telefone 2",value:field("buyer_phone_2","phone_2")},{label:"E-mail",value:field("buyer_email","purchase_email")}]},
      {title:"Financeiro",lines:[{label:"Responsavel",value:field("finance_contact")},{label:"Telefone 1",value:field("finance_phone_1")},{label:"Telefone 2",value:field("finance_phone_2")},{label:"E-mail",value:field("finance_email","billing_email")}]},
      {title:"Logistica",lines:[{label:"Responsavel",value:field("logistics_contact")},{label:"Telefone",value:field("logistics_phone")},{label:"Telefone agendamento",value:field("scheduling_phone")},{label:"E-mail XML",value:field("xml_email")}]},
      {title:"Observacoes",lines:[{label:"Informacoes adicionais",value:field("additional_notes","notes")}]},
      {title:"Representantes vinculados",lines:sellers.length?sellers.map(seller=>({label:String(seller.name),value:first(seller.communication_email,seller.email)})):[{label:"Representantes",value:"Nenhum representante vinculado"}]},
    ]);
    return {buffer,name:String(customer.legal_name||`cliente-${customerId}`)};
  }

  async reportData(
    user: PublicUser,
    query: Record<string, string | undefined>,
  ): Promise<CommercialReport> {
    const allowed = new Set([
      "vendas",
      "pedidos",
      "bonificacoes",
      "produtos_vendidos",
      "prazo_pagamento",
      "fechamento_mensal",
    ]);
    const type = String(query.type || "vendas");
    if (!allowed.has(type))
      throw new BadRequestException("Tipo de relatório inválido.");

    const where = ["p.tenant_id=?"];
    const params: Array<string | number> = [user.tenant_id];
    for (const [key, column] of [
      ["seller_id", "p.seller_id"],
      ["company_id", "p.company_id"],
      ["customer_id", "p.customer_id"],
    ] as const) {
      if (!query[key]) continue;
      const value = Number(query[key]);
      if (!Number.isSafeInteger(value) || value < 1)
        throw new BadRequestException("Filtro inválido.");
      where.push(`${column}=?`);
      params.push(value);
    }
    if (query.status) {
      where.push("p.status=?");
      params.push(query.status);
    }
    if (query.date_from) {
      where.push("CAST(p.created_at AS date)>=CAST(? AS date)");
      params.push(query.date_from);
    }
    if (query.date_to) {
      where.push("CAST(p.created_at AS date)<=CAST(? AS date)");
      params.push(query.date_to);
    }

    const sum = (rows: Row[], key: string) =>
      rows.reduce((total, row) => total + Number(row[key] || 0), 0);
    const count = (value: number) => value.toLocaleString("pt-BR");
    const baseOrderSelect = `SELECT p.id,p.order_number,p.order_type,p.status,p.created_at,u.name seller_name,
      c.legal_name customer_name,co.name company_name,COALESCE(SUM(pi.quantity*pi.negotiated_price),0) total
      FROM proposals p JOIN users u ON u.id=p.seller_id JOIN customers c ON c.id=p.customer_id
      JOIN companies co ON co.id=p.company_id LEFT JOIN proposal_items pi ON pi.proposal_id=p.id`;
    const orderGroup =
      "GROUP BY p.id,p.order_number,p.order_type,p.status,p.created_at,u.name,c.legal_name,co.name ORDER BY p.created_at DESC";
    const orderColumns: ReportColumn[] = [
      { key: "order_number", label: "Pedido", weight: 0.7 },
      { key: "customer_name", label: "Cliente", weight: 2.2 },
      { key: "company_name", label: "Empresa", weight: 1.35 },
      { key: "seller_name", label: "Representante", weight: 1.35 },
      { key: "status_label", label: "Status", weight: 1.1 },
      { key: "date_label", label: "Data", weight: 0.85 },
      { key: "total_label", label: "Valor", weight: 1, align: "right" },
    ];
    const statusNames: Record<string, string> = {
      em_analise: "Em análise",
      pedido_aprovado: "Aprovado",
      em_producao: "Em produção",
      faturado: "Faturado",
      entregue: "Entregue",
      recusado: "Recusado",
    };
    const presentOrders = (rows: Row[]) =>
      rows.map((row) => ({
        ...row,
        order_number: `#${first(row.order_number)}`,
        status_label:
          statusNames[first(row.status)] ||
          first(row.status).replaceAll("_", " "),
        date_label: dateOnly(row.created_at),
        total_label: money(row.total),
      }));

    if (type === "pedidos" || type === "vendas" || type === "bonificacoes") {
      const conditions = [...where];
      if (type === "vendas")
        conditions.push(
          `p.status IN (${SOLD_STATUSES_SQL})`,
          `NOT (${BONUS_SQL})`,
        );
      if (type === "bonificacoes") conditions.push(BONUS_SQL);
      const rawRows = (await this.database.db
        .prepare(
          `${baseOrderSelect} WHERE ${conditions.join(" AND ")} ${orderGroup}`,
        )
        .all(...params)) as Row[];
      const total = sum(rawRows, "total");
      const customers = new Set(rawRows.map((row) => row.customer_name)).size;
      const titles: Record<string, string> = {
        pedidos: "Relatório de pedidos",
        vendas: "Relatório de vendas",
        bonificacoes: "Relatório de bonificações",
      };
      const sections: Record<string, string> = {
        pedidos: "Pedidos",
        vendas: "Vendas efetivadas",
        bonificacoes: "Pedidos de bonificação",
      };
      return {
        type,
        title: titles[type],
        section: sections[type],
        metrics: [
          {
            label:
              type === "bonificacoes"
                ? "Bonificações"
                : type === "vendas"
                  ? "Vendas"
                  : "Pedidos",
            value: count(rawRows.length),
          },
          { label: "Clientes", value: count(customers) },
          { label: "Valor total", value: money(total) },
          {
            label: "Ticket médio",
            value: money(rawRows.length ? total / rawRows.length : 0),
          },
        ],
        columns: orderColumns,
        rows: presentOrders(rawRows),
      };
    }

    const soldWhere = [
      ...where,
      `p.status IN (${SOLD_STATUSES_SQL})`,
      `NOT (${BONUS_SQL})`,
    ];
    if (type === "produtos_vendidos") {
      const rawRows = (await this.database.db
        .prepare(
          `SELECT pr.code product_code,pr.name product_name,
        SUM(pi.quantity) quantity,CASE WHEN SUM(pi.quantity)=0 THEN 0 ELSE SUM(pi.quantity*pi.negotiated_price)/SUM(pi.quantity) END average_price,
        SUM(pi.quantity*pi.negotiated_price) revenue FROM proposals p JOIN proposal_items pi ON pi.proposal_id=p.id
        JOIN products pr ON pr.id=pi.product_id
        WHERE ${soldWhere.join(" AND ")} GROUP BY pr.id,pr.code,pr.name ORDER BY revenue DESC`,
        )
        .all(...params)) as Row[];
      const quantity = sum(rawRows, "quantity");
      const revenue = sum(rawRows, "revenue");
      return {
        type,
        title: "Produtos vendidos",
        section: "Desempenho por produto",
        metrics: [
          { label: "Produtos", value: count(rawRows.length) },
          { label: "Quantidade", value: count(quantity) },
          { label: "Faturamento", value: money(revenue) },
          {
            label: "Preço médio geral",
            value: money(quantity ? revenue / quantity : 0),
          },
        ],
        columns: [
          { key: "product_code", label: "Código", weight: 0.9 },
          { key: "product_name", label: "Produto", weight: 2.6 },
          {
            key: "quantity_label",
            label: "Quantidade",
            weight: 1,
            align: "right",
          },
          {
            key: "average_price_label",
            label: "Preço médio",
            weight: 1.1,
            align: "right",
          },
          {
            key: "revenue_label",
            label: "Faturamento",
            weight: 1.2,
            align: "right",
          },
        ],
        rows: rawRows.map((row) => ({
          ...row,
          quantity_label: Number(row.quantity || 0).toLocaleString("pt-BR"),
          average_price_label: money(row.average_price),
          revenue_label: money(row.revenue),
        })),
      };
    }

    if (type === "prazo_pagamento") {
      const rawRows = (await this.database.db
        .prepare(
          `SELECT COALESCE(NULLIF(LTRIM(RTRIM(p.payment_terms)),''),'Não informado') payment_terms,
        COUNT_BIG(DISTINCT p.id) order_count,COALESCE(SUM(pi.quantity*pi.negotiated_price),0) revenue
        FROM proposals p LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE ${soldWhere.join(" AND ")}
        GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(p.payment_terms)),''),'Não informado') ORDER BY revenue DESC`,
        )
        .all(...params)) as Row[];
      const orders = sum(rawRows, "order_count");
      const revenue = sum(rawRows, "revenue");
      return {
        type,
        title: "Prazo de pagamento",
        section: "Resultados por condição de pagamento",
        metrics: [
          { label: "Condições", value: count(rawRows.length) },
          { label: "Pedidos", value: count(orders) },
          { label: "Faturamento", value: money(revenue) },
          {
            label: "Ticket médio",
            value: money(orders ? revenue / orders : 0),
          },
        ],
        columns: [
          { key: "payment_terms", label: "Condição de pagamento", weight: 3 },
          {
            key: "order_count_label",
            label: "Pedidos",
            weight: 1,
            align: "right",
          },
          {
            key: "ticket_label",
            label: "Ticket médio",
            weight: 1.2,
            align: "right",
          },
          {
            key: "revenue_label",
            label: "Faturamento",
            weight: 1.3,
            align: "right",
          },
        ],
        rows: rawRows.map((row) => ({
          ...row,
          order_count_label: count(Number(row.order_count || 0)),
          ticket_label: money(
            Number(row.order_count)
              ? Number(row.revenue) / Number(row.order_count)
              : 0,
          ),
          revenue_label: money(row.revenue),
        })),
      };
    }

    const rawRows = (await this.database.db
      .prepare(
        `SELECT YEAR(p.created_at) report_year,MONTH(p.created_at) report_month,
      COUNT_BIG(DISTINCT p.id) order_count,COALESCE(SUM(pi.quantity*pi.negotiated_price),0) revenue
      FROM proposals p LEFT JOIN proposal_items pi ON pi.proposal_id=p.id WHERE ${soldWhere.join(" AND ")}
      GROUP BY YEAR(p.created_at),MONTH(p.created_at) ORDER BY report_year DESC,report_month DESC`,
      )
      .all(...params)) as Row[];
    const orders = sum(rawRows, "order_count");
    const revenue = sum(rawRows, "revenue");
    return {
      type,
      title: "Fechamento mensal",
      section: "Consolidado por mês",
      metrics: [
        { label: "Meses", value: count(rawRows.length) },
        { label: "Pedidos", value: count(orders) },
        { label: "Faturamento", value: money(revenue) },
        { label: "Ticket médio", value: money(orders ? revenue / orders : 0) },
      ],
      columns: [
        { key: "period_label", label: "Competência", weight: 2 },
        {
          key: "order_count_label",
          label: "Pedidos",
          weight: 1,
          align: "right",
        },
        {
          key: "ticket_label",
          label: "Ticket médio",
          weight: 1.2,
          align: "right",
        },
        {
          key: "revenue_label",
          label: "Faturamento",
          weight: 1.3,
          align: "right",
        },
      ],
      rows: rawRows.map((row) => ({
        ...row,
        period_label: `${String(row.report_month).padStart(2, "0")}/${row.report_year}`,
        order_count_label: count(Number(row.order_count || 0)),
        ticket_label: money(
          Number(row.order_count)
            ? Number(row.revenue) / Number(row.order_count)
            : 0,
        ),
        revenue_label: money(row.revenue),
      })),
    };
  }

  async report(
    user: PublicUser,
    query: Record<string, string | undefined>,
  ): Promise<Buffer> {
    const report = await this.reportData(user, query);
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 34,
        bufferPages: true,
        info: { Title: report.title, Author: "HiperSales" },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      const left = 34;
      const pageWidth = doc.page.width - 68;
      const weightTotal = report.columns.reduce(
        (total, column) => total + column.weight,
        0,
      );
      const columns = report.columns.map((column) => ({
        ...column,
        width: (pageWidth * column.weight) / weightTotal,
      }));
      const ellipsis = (value: unknown, width: number) => {
        const raw = first(value) || "-";
        if (doc.widthOfString(raw) <= width) return raw;
        let low = 0,
          high = raw.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (doc.widthOfString(`${raw.slice(0, middle)}…`) <= width)
            low = middle;
          else high = middle - 1;
        }
        return low ? `${raw.slice(0, low).trimEnd()}…` : "…";
      };
      const drawTableHeader = (y: number) => {
        doc.rect(left, y, pageWidth, 28).fill("#E8F0F7");
        let x = left;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#34465C");
        for (const column of columns) {
          doc.text(column.label.toUpperCase(), x + 7, y + 9, {
            width: column.width - 14,
            align: column.align || "left",
            lineBreak: false,
          });
          x += column.width;
        }
      };
      doc.rect(0, 0, doc.page.width, 8).fill("#0767B4");
      doc
        .fillColor("#0767B4")
        .font("Helvetica-Bold")
        .fontSize(14)
        .text("HiperSales", left, 27);
      doc.fillColor("#132238").fontSize(20).text(report.title, left, 60);
      doc
        .fillColor("#65758B")
        .font("Helvetica")
        .fontSize(9)
        .text(`Gerado em ${safeDate(new Date().toISOString())}`, left, 88);
      doc.roundedRect(left, 111, pageWidth, 58, 8).fill("#F2F7FB");
      const metricWidth = pageWidth / Math.max(report.metrics.length, 1);
      report.metrics.forEach((metric, index) => {
        const x = left + index * metricWidth + 16;
        doc
          .fillColor("#64748B")
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .text(metric.label.toUpperCase(), x, 122, {
            width: metricWidth - 24,
          });
        doc
          .fillColor("#0B2A63")
          .fontSize(14)
          .text(metric.value, x, 139, { width: metricWidth - 24 });
      });
      doc.fillColor("#132238").fontSize(11).text(report.section, left, 188);
      drawTableHeader(210);
      let y = 244;
      report.rows.forEach((row, index) => {
        if (y + 30 > doc.page.height - 48) {
          doc.addPage();
          doc
            .fillColor("#0767B4")
            .font("Helvetica-Bold")
            .fontSize(12)
            .text(`HiperSales  /  ${report.title}`, left, 28);
          drawTableHeader(55);
          y = 89;
        }
        if (index % 2 === 0) doc.rect(left, y, pageWidth, 30).fill("#FAFCFE");
        let x = left;
        doc.font("Helvetica").fontSize(8).fillColor("#26354B");
        for (const column of columns) {
          doc.text(
            ellipsis(row[column.key], column.width - 14),
            x + 7,
            y + 10,
            {
              width: column.width - 14,
              height: 12,
              lineBreak: false,
              align: column.align || "left",
            },
          );
          x += column.width;
        }
        doc
          .moveTo(left, y + 30)
          .lineTo(left + pageWidth, y + 30)
          .lineWidth(0.35)
          .strokeColor("#E2E8F0")
          .stroke();
        y += 30;
      });
      if (!report.rows.length)
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#64748B")
          .text(
            "Nenhum registro encontrado para os filtros selecionados.",
            left,
            255,
            { width: pageWidth, align: "center" },
          );
      const pageRange = doc.bufferedPageRange();
      for (
        let page = pageRange.start;
        page < pageRange.start + pageRange.count;
        page += 1
      ) {
        doc.switchToPage(page);
        doc
          .moveTo(left, doc.page.height - 32)
          .lineTo(left + pageWidth, doc.page.height - 32)
          .strokeColor("#DCE5EE")
          .stroke();
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#64748B")
          .text(
            "HiperSales • Relatório comercial",
            left,
            doc.page.height - 24,
            { lineBreak: false },
          );
        doc.text(
          `Página ${page + 1} de ${pageRange.count}`,
          left + pageWidth - 105,
          doc.page.height - 24,
          { width: 105, align: "right", lineBreak: false },
        );
      }
      doc.end();
    });
  }
}
