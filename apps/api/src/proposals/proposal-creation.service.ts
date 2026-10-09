import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { ProposalNotificationService } from "./proposal-notification.service.js";

type Item = {product_id:number;quantity:number;negotiated_price:number};
type Input = {company_id:number;customer_id:number;seller_id?:number;order_type:string;purchase_order?:string;commission_percent?:unknown;invoice_type?:string;tax_operator_invoice?:boolean;freight_type:string;delivery_type:string;scheduled_delivery_date?:string;discount_percent?:unknown;discount_on?:string;payment_terms?:string;notes?:string;items:Item[]};

function percentage(value:unknown):number {
  if (value == null || value === "") return 0;
  let s=String(value).replace(/[%\s]/g,"");
  if (s.includes(",") && s.includes(".")) s=s.replace(/\./g,"").replace(",",".");
  else s=s.replace(",",".");
  const n=Number(s);
  if(!Number.isFinite(n)) throw new BadRequestException("Percentual invalido.");
  return n;
}
function discountOn(value:string|undefined) {
  const mapping:Record<string,string>={
    "Desconto no boleto":"Boleto Bancario","Desconto na nota fiscal":"Nota Fiscal",
    "Boleto Bancário":"Boleto Bancario","Boleto Bancario":"Boleto Bancario",
  };
  return mapping[value||""] || value?.trim() || "Sem descontos";
}
@Injectable()
export class ProposalCreationService {
  constructor(private readonly database:DatabaseService, private readonly notifications:ProposalNotificationService){}

  create(user:PublicUser,data:Input) {
    if(!["admin","seller"].includes(user.role)) throw new ForbiddenException("Envio de proposta indisponivel para este usuario.");
    const companyId=Number(data?.company_id),customerId=Number(data?.customer_id);
    const sellerId=Number(data?.seller_id || user.id);
    const orderType=String(data?.order_type||"").trim();
    const freight=String(data?.freight_type||"").trim();
    const delivery=String(data?.delivery_type||"").trim();
    if(!Number.isSafeInteger(companyId)||!Number.isSafeInteger(customerId)||!Number.isSafeInteger(sellerId)||!orderType||!freight||!delivery) {
      throw new BadRequestException("Informe empresa, cliente, tipo de pedido, frete e entrega.");
    }
    const bonus = orderType.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes("bonificacao");
    const payment=bonus?"":String(data?.payment_terms||"").trim();
    if(!bonus&&!payment) throw new BadRequestException("Informe a forma de pagamento.");
    if(!Array.isArray(data?.items)||data.items.length===0) throw new BadRequestException("Inclua ao menos um produto na proposta.");
    const items=data.items.map(item=>{
      const id=Number(item.product_id),quantity=Number(item.quantity),price=Number(item.negotiated_price);
      if(!Number.isSafeInteger(id)||id<1||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<0)
        throw new BadRequestException("Produto, quantidade ou preco invalido.");
      return {id,quantity,price};
    });
    const commission=bonus?0:percentage(data.commission_percent);
    const discount=bonus?0:percentage(data.discount_percent);
    const dOn=bonus?"Sem descontos":discountOn(data.discount_on);
    return this.database.transaction(()=>{
      const db=this.database.db;
      const exists=(table:string,id:number)=>db.prepare(`SELECT id FROM ${table} WHERE id=? AND tenant_id=? AND active=1`).get(id,user.tenant_id);
      if(!exists("companies",companyId)) throw new BadRequestException("Empresa invalida para esta conta.");
      if(!exists("customers",customerId)) throw new BadRequestException("Cliente invalido para esta conta.");
      if(user.role==="admin"&&!db.prepare("SELECT 1 FROM users WHERE id=? AND tenant_id=? AND role='seller' AND active=1").get(sellerId,user.tenant_id)) {
        throw new BadRequestException("Selecione um representante comercial ativo para criar o pedido.");
      }
      if(user.role!=="admin"&&sellerId!==user.id) throw new ForbiddenException("Representante comercial invalido para esta proposta.");
      if(!db.prepare("SELECT 1 FROM company_sellers WHERE company_id=? AND seller_id=?").get(companyId,sellerId))
        throw new ForbiddenException("Empresa nao associada ao representante comercial.");
      if(user.role!=="admin"&&!db.prepare("SELECT 1 FROM customer_sellers WHERE customer_id=? AND seller_id=?").get(customerId,sellerId))
        throw new ForbiddenException("Cliente nao associado ao representante comercial.");
      for(const item of items) if(!db.prepare("SELECT 1 FROM products WHERE id=? AND tenant_id=? AND company_id=? AND active=1").get(item.id,user.tenant_id,companyId))
        throw new BadRequestException("Produto invalido para a empresa selecionada.");

      const orderNumberRow=db.prepare("SELECT COALESCE(MAX(order_number),10839)+1 AS next_number FROM proposals WHERE tenant_id=?").get(user.tenant_id) as {next_number:number};
      const orderNumber=Number(orderNumberRow.next_number);
      const now=new Date().toISOString();
      const result=db.prepare(`INSERT INTO proposals
        (tenant_id,order_number,seller_id,company_id,customer_id,order_type,purchase_order,commission_percent,invoice_type,
         tax_operator_invoice,freight_type,delivery_type,scheduled_delivery_date,discount_percent,discount_on,
         payment_terms,notes,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        user.tenant_id,orderNumber,sellerId,companyId,customerId,orderType,data.purchase_order||null,
        commission,data.invoice_type||"Com nota cheia",data.tax_operator_invoice?1:0,freight,delivery,
        delivery==="Entrega Programada"?data.scheduled_delivery_date||null:null,discount,dOn,payment,
        data.notes||null,"em_analise",now,now);
      const proposalId=Number(result.lastInsertRowid);
      const insertItem=db.prepare("INSERT INTO proposal_items (proposal_id,product_id,quantity,negotiated_price) VALUES (?,?,?,?)");
      for(const item of items) insertItem.run(proposalId,item.id,item.quantity,item.price);
      db.prepare("INSERT INTO proposal_events (proposal_id,status,title,notes,created_by,created_at) VALUES (?,?,?,?,?,?)")
        .run(proposalId,"em_analise","Em analise","Proposta enviada para analise.",sellerId,now);
      if(user.role==="admin") db.prepare("INSERT OR IGNORE INTO customer_sellers (customer_id,seller_id) VALUES (?,?)").run(customerId,sellerId);
      this.notifications.queueNewProposal(user.tenant_id,proposalId);
      return {id:proposalId,order_number:orderNumber,status:"em_analise",company_id:companyId,
        customer_id:customerId,message:user.role==="admin"?"Pedido criado pelo admin.":"Proposta enviada para analise."};
    });
  }
}
