import { DatabaseService } from "../database/database.service.js";

type Row = Record<string, unknown>;
const value=(v:unknown)=>String(v??"");
const amount=(v:unknown)=>Number(v||0).toFixed(2);
const discount=(v:unknown)=>{
  const raw=value(v).trim();
  return ({"Desconto no boleto":"Boleto Bancario","Desconto na nota fiscal":"Nota Fiscal","Boleto Bancário":"Boleto Bancario"} as Record<string,string>)[raw]||raw||"Sem descontos";
};
function brl(v:unknown) {
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
}
export function approvedOrderBody(p:Row,items:Row[]):string {
  const timestamp=value(p.created_at);
  const date=new Date(timestamp);
  const valid=Number.isFinite(date.getTime());
  const dateText=valid?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"}).format(date):timestamp;
  const timeText=valid?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hour12:false}).format(date):"";
  const company=value(p.company_name),seller=value(p.seller_name),client=value(p.customer_name);
  const lines=[
    "Ola, Bruna.",
    `Foi aprovada a proposta do cliente ${client}.`,
    "Agora a proposta se tornou um pedido e podemos dar continuidade na operacao.",
    `Solicito que transmita o pedido abaixo para a Empresa ${company} de acordo com as regras internas dela (aplicativo, formulario, e-mail).`,
    "Para facilitar seu trabalho estarei enviando abaixo as informacoes do pedido.","",
    "Cabecalho do Pedido:",
    `Data: ${dateText}`,`Horario: ${timeText}`,`Usuario: ${seller}`,
    `Empresa: ${company}`,`Cliente: ${client}`,`CNPJ: ${value(p.cnpj)}`,
    `Endereco: ${value(p.address)}`,
    `Nota Fiscal via Operador Fiscal: ${p.tax_operator_invoice ? "SIM, VIA OPERADOR FISCAL" : "NAO, DIRETO DA FABRICA"}`,
    "Condicoes do Pedido:",
    `Natureza da Operacao: ${value(p.order_type)}`,`Frete: ${value(p.freight_type)}`,
    `Tipo de Entrega: ${value(p.delivery_type)}`,`Data Programada Entrega: ${value(p.scheduled_delivery_date)}`,
    `Ordem de Compras Cliente: ${value(p.purchase_order)}`,`Forma de Pagamento: ${value(p.payment_terms)}`,
    `%Desconto: ${amount(p.discount_percent)}`,`Desconto em: ${discount(p.discount_on)}`,
    `%Comissao: ${amount(p.commission_percent)}`,`Observacao do Pedido: ${value(p.notes)}`,
    "Itens do Pedido:",
  ];
  items.forEach((item,index)=>lines.push(
    `Item ${String(index+1).padStart(2,"0")}: ${value(item.code)}`,
    `Produto: ${value(item.name)}`,`Unidade Venda: ${value(item.unit||"UN")}`,
    `Quantidade: ${value(item.quantity)}`,`Preco Negociado: ${brl(item.negotiated_price)}`,
  ));
  lines.push("","Bruna,",
    `E muito importante que apos enviar este pedido para a Empresa ${company} voce va ate a plataforma do administrador (HiperSales Web) e atualize o Status do Pedido para que ${seller} tenha acesso ao andamento do pedido.`,
    "","Atenciosamente,","Comunicacao HiperSales Web");
  return lines.join("\n");
}
export function loadApprovedOrder(db:DatabaseService["db"],tenantId:number,id:number) {
  const row=db.prepare(`SELECT p.*,u.name AS seller_name,c.legal_name AS customer_name,
    c.cnpj,c.address,co.name AS company_name FROM proposals p
    JOIN users u ON u.id=p.seller_id JOIN customers c ON c.id=p.customer_id
    JOIN companies co ON co.id=p.company_id
    WHERE p.id=? AND p.tenant_id=?`).get(id,tenantId) as Row|undefined;
  if(!row) throw new Error("Pedido nao encontrado para notificacao.");
  const items=db.prepare(`SELECT pi.quantity,pi.negotiated_price,pr.code,pr.name,pr.unit
    FROM proposal_items pi JOIN products pr ON pr.id=pi.product_id
    WHERE pi.proposal_id=? ORDER BY pi.id`).all(id) as Row[];
  return approvedOrderBody(row,items);
}
