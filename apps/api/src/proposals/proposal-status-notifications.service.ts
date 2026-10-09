import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

type Row = Record<string, unknown>;
const labels: Record<string,string> = {
  em_analise:"Em analise",pedido_aprovado:"Pedido aprovado",recusado:"Proposta recusada",
  em_producao:"Em producao",faturado:"Faturado",entregue:"Pedido entregue",
};
const str = (value:unknown) => String(value ?? "");
const required = (row:Row,key:string) => str(row[key]);
const display:Record<string,string> = {
  pedido_aprovado:"APROVADO",em_producao:"EM PRODUÇÃO",faturado:"FATURADO",
  entregue:"ENTREGUE",recusado:"RECUSADO",
};
export function statusEmailSubject(status:string) {
  return display[status] ?? (labels[status] ?? status).toUpperCase();
}
export function statusEmailBody(context:Row):string {
  const seller=required(context,"vendedor"),client=required(context,"cliente"),cnpj=required(context,"cnpj");
  const status=required(context,"status"), label=required(context,"status_label").trim();
  const forecast=required(context,"delivery_forecast").trim(),notes=required(context,"observacoes").trim();
  const lines=[
    `Ola, ${seller} 😀`, "",
    "Estamos fornecendo de forma automatica uma informacao diretamente do HiperSales Web.",
    `O pedido nº #${required(context,"pedido_id")} referente ao cliente ${client} + ${cnpj} teve uma atualizacao de status.`,
    `Seu pedido encontra-se ${label ? label.toUpperCase() : status.toUpperCase()}`,
  ];
  if(status==="pedido_aprovado"&&forecast) lines.push(`Entrega prevista: ${forecast}`);
  if(notes) lines.push("",`Observacoes: ${notes}`);
  lines.push("",
    'Voce pode acompanhar a atualizacao dos seus pedidos através do Software HiperSales Web - selecionando a opcao "consultar pedidos" na tela inicial.',
    "","Em breve volto com mais atualizacoes sobre seus pedidos!",`Otimas vendas, ate mais ${seller}!`);
  return lines.join("\n");
}
export function statusWhatsappBody(context:Row):string {
  const seller=required(context,"vendedor"),status=required(context,"status");
  const label=required(context,"status_label").trim();
  const intro=[`Ola, ${seller} 😀`,"",
    "Estamos fornecendo de forma automatica uma informacao diretamente do HiperSales Web."];
  const number=required(context,"pedido_id"),customer=required(context,"cliente"),cnpj=required(context,"cnpj");
  if(status==="em_analise") return [...intro,
    `O pedido nº #${number} referente ao cliente ${customer} + ${cnpj} foi recebido com sucesso e já está em análise.`,"",
    'Você poderá acompanhar a atualização dos seus pedidos através do Software HiperSales Web - selecionando a opção "consultar pedidos" na tela inicial.',
    "","Em breve volto com mais atualizações sobre seus pedidos!",`Ótimas vendas, até mais ${seller}!`].join("\n");
  return [...intro,`O pedido nº #${number} referente ao cliente ${customer} + ${cnpj} teve uma atualização em seu status.`,
    "",`Seu pedido encontra-se ${display[status] ?? (label ? label.toUpperCase() : "ATUALIZADO")}`,"",
    'Você poderá acompanhar a atualização dos seus pedidos através do Software HiperSales Web - selecionando a opção "consultar pedidos" na tela inicial.',
    "","Em breve volto com mais atualizações sobre seus pedidos!",`Ótimas vendas, até mais ${seller}!`].join("\n");
}
export function rejectedProposalBody(seller:string,customer:string,cnpj:string) {
  return [
    `Ola, ${seller}.`,
    `Voce transmitiu uma proposta do cliente ${customer} - CNPJ ${cnpj}.`,
    "Devido a inconsistencias ela nao foi aprovada.",
    "Houve algum erro na digitacao, escolha de condicao comercial, preco nao deve estar de acordo ou algum outro motivo.",
    "Sugerimos que faca contato para averiguar ao certo o motivo da recusa da proposta enviada.",
    "Importante dizer que neste momento nao estamos considerando a proposta enviada e seu contato e de suma importancia para manter agilidade no atendimento ao cliente.",
    "Atenciosamente,","Comunicacao HiperSales Web",
  ].join("\n");
}
function setting(db:DatabaseService["db"],tenantId:number,key:string):Row {
  const local=db.prepare("SELECT value FROM tenant_settings WHERE tenant_id=? AND key=?")
    .get(tenantId,key) as {value:string}|undefined;
  const global=local ?? db.prepare("SELECT value FROM system_settings WHERE key=?")
    .get(key) as {value:string}|undefined;
  try {
    const parsed:unknown=JSON.parse(global?.value ?? "{}");
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed) ? parsed as Row : {};
  } catch { return {}; }
}
@Injectable()
export class ProposalStatusNotificationsService {
  constructor(private readonly database:DatabaseService) {}
  queue(tenantId:number,id:number,status:string):void {
    const db=this.database.db;
    const row=db.prepare(`SELECT p.*,u.name AS seller_name,u.email AS seller_email,
      COALESCE(NULLIF(u.communication_email,''),u.email) AS seller_contact_email,
      u.whatsapp_phone AS seller_whatsapp_phone,
      c.legal_name AS customer_name,c.trade_name AS customer_trade_name,c.cnpj,
      co.name AS company_name
      FROM proposals p JOIN users u ON u.id=p.seller_id
      JOIN customers c ON c.id=p.customer_id JOIN companies co ON co.id=p.company_id
      WHERE p.id=? AND p.tenant_id=?`).get(id,tenantId) as Row|undefined;
    if(!row) throw new Error("Pedido nao encontrado para notificacao.");
    const context:Row={
      vendedor:row.seller_name,cliente:row.customer_trade_name||row.customer_name,cnpj:row.cnpj,
      pedido_id:row.order_number||row.id,status,status_label:labels[status]||status,
      delivery_forecast:row.delivery_forecast||"",
      observacoes:[row.notes,row.admin_notes].filter(Boolean).join(" | "),
    };
    const sellerEmail=str(row.seller_contact_email||row.seller_email);
    const subjectBase=`${str(row.customer_name)} + ${str(row.cnpj)}`;
    const enqueue=(kind:string,recipient:string,subject:string,body:string) => {
      db.prepare(`INSERT INTO email_outbox
        (tenant_id,kind,recipients,subject,body,created_at) VALUES (?,?,?,?,?,?)`)
        .run(tenantId,kind,recipient,subject,body,new Date().toISOString());
    };
    if(status==="pedido_aprovado") {
      if(sellerEmail) enqueue("status_update_seller",sellerEmail,
        `STATUS DO PEDIDO ${statusEmailSubject(status)} ${subjectBase}`,statusEmailBody(context));
      // Approved-order backoffice email has a different full order-items document in Python.
      // Refuse partial status migration until this formatter is ported.
      throw new Error("Template completo do pedido aprovado ainda nao migrado.");
    }
    if(status==="recusado") {
      enqueue("rejected_proposal_seller",sellerEmail,`PROPOSTA RECUSADA ${subjectBase}`,
        rejectedProposalBody(str(row.seller_name),str(row.customer_name),str(row.cnpj)));
    } else if(["em_producao","faturado","entregue"].includes(status)&&sellerEmail) {
      enqueue("status_update_seller",sellerEmail,
        `STATUS DO PEDIDO ${statusEmailSubject(status)} ${subjectBase}`,statusEmailBody(context));
    }
    const whatsapp=setting(db,tenantId,"whatsapp");
    if(whatsapp.enabled===true) {
      const to=str(row.seller_whatsapp_phone||whatsapp.alert_phone||whatsapp.instance_id||whatsapp.connection_name||"whatsapp");
      enqueue("status_whatsapp",`whatsapp:${to}`,"Status do pedido",statusWhatsappBody(context));
    }
  }
}
