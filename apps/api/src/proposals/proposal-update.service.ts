import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type Data = Record<string, unknown>;
const labels: Record<string,string> = {
  em_analise:"Em analise",pedido_aprovado:"Pedido aprovado",recusado:"Proposta recusada",
  em_producao:"Em producao",faturado:"Faturado",entregue:"Pedido entregue",
};
const rank:Record<string,number>={em_analise:0,pedido_aprovado:1,recusado:1,em_producao:2,faturado:3,entregue:4};
const alias:Record<string,string>={proposta_enviada:"em_analise",proposta_recusada:"recusado"};
const columns=["admin_notes","delivery_forecast","industry_order_number","invoice_number","order_type",
  "purchase_order","commission_percent","invoice_type","tax_operator_invoice","freight_type",
  "delivery_type","scheduled_delivery_date","discount_percent","discount_on","payment_terms","notes"] as const;
function parsePercentage(value:unknown):number {
  let raw=String(value??"").trim().replace(/[%\s]/g,"");
  if(raw.includes(",")&&raw.includes(".")) raw=raw.replace(/\./g,"").replace(",",".");
  else raw=raw.replace(",",".");
  const number=raw?Number(raw):0;
  if(!Number.isFinite(number)) throw new BadRequestException("Percentual invalido.");
  return number;
}
function isBonus(value:unknown) {
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes("bonificacao");
}
function discountOn(value:unknown):string {
  const raw=String(value??"").trim();
  const mapping:Record<string,string>={
    "Desconto no boleto":"Boleto Bancario","Desconto na nota fiscal":"Nota Fiscal",
    "Boleto Bancário":"Boleto Bancario",
  };
  return mapping[raw]??raw??"Sem descontos";
}
export function normalizeProposalStatus(status:unknown,previous:string) {
  const requested=String(status||previous);
  const current=alias[requested]??requested;
  if(!(current in labels)) throw new BadRequestException("Status invalido.");
  if(rank[current]<rank[previous]) throw new BadRequestException("Nao e permitido voltar o pedido para uma etapa anterior.");
  return current;
}

/**
 * Stages a proposal edit, but explicitly blocks status changes until the legacy
 * notification handlers have been ported. The Python endpoint remains authoritative.
 */
@Injectable()
export class ProposalUpdateService {
  constructor(private readonly database:DatabaseService) {}
  update(user:PublicUser,id:number,data:Data) {
    if(!Number.isSafeInteger(id)||id<1||!data||typeof data!=="object"||Array.isArray(data))
      throw new BadRequestException("Pedido invalido.");
    return this.database.transaction(()=>{
      const db=this.database.db;
      const previous=db.prepare("SELECT * FROM proposals WHERE id=? AND tenant_id=?")
        .get(id,user.tenant_id) as Data|undefined;
      if(!previous) throw new NotFoundException("Proposta nao encontrada.");
      const oldStatus=String(previous.status||"");
      const status=normalizeProposalStatus(data.status,oldStatus);
      if(status!==oldStatus) {
        throw new BadRequestException("Alteracao de status ainda requer notificacoes do servico legado.");
      }
      const patch:Data={};
      for(const key of columns) patch[key]=Object.prototype.hasOwnProperty.call(data,key)?data[key]:previous[key];
      patch.commission_percent=Object.prototype.hasOwnProperty.call(data,"commission_percent")
        ?parsePercentage(data.commission_percent):Number(previous.commission_percent||0);
      patch.discount_percent=Object.prototype.hasOwnProperty.call(data,"discount_percent")
        ?parsePercentage(data.discount_percent):Number(previous.discount_percent||0);
      patch.discount_on=Object.prototype.hasOwnProperty.call(data,"discount_on")
        ?discountOn(data.discount_on):previous.discount_on;
      patch.tax_operator_invoice=Object.prototype.hasOwnProperty.call(data,"tax_operator_invoice")
        ?Number(data.tax_operator_invoice===true||data.tax_operator_invoice===1||data.tax_operator_invoice==="true"):Number(previous.tax_operator_invoice||0);
      if(patch.delivery_type!=="Entrega Programada") patch.scheduled_delivery_date=null;
      if(isBonus(patch.order_type)) {
        patch.payment_terms="";patch.commission_percent=0;patch.discount_percent=0;patch.discount_on="Sem descontos";
      } else if(!String(patch.payment_terms||"").trim()) {
        throw new BadRequestException("Informe a forma de pagamento.");
      }
      const items=data.items;
      const normalizedItems: {productId:number;quantity:number;price:number}[]=[];
      if(items!==undefined){
        if(!Array.isArray(items)||items.length===0) throw new BadRequestException("O pedido deve ter ao menos um produto.");
        for(const item of items){
          const row=item as Data;
          const productId=Number(row.product_id),quantity=Number(row.quantity),price=Number(row.negotiated_price);
          if(!Number.isSafeInteger(productId)||productId<1||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<0)
            throw new BadRequestException("Quantidade e preco dos itens devem ser validos.");
          if(!db.prepare("SELECT id FROM products WHERE id=? AND tenant_id=? AND company_id=? AND active=1")
            .get(productId,user.tenant_id,previous.company_id))
            throw new BadRequestException("Produto invalido para a empresa do pedido.");
          normalizedItems.push({productId,quantity,price});
        }
      }
      db.prepare(`UPDATE proposals SET ${columns.map(k=>k+"=?").join(",")},updated_at=? WHERE id=? AND tenant_id=?`)
        .run(...columns.map(k=>patch[k] as string|number|null),new Date().toISOString(),id,user.tenant_id);
      if(items!==undefined){
        db.prepare("DELETE FROM proposal_items WHERE proposal_id=?").run(id);
        const insert=db.prepare("INSERT INTO proposal_items (proposal_id,product_id,quantity,negotiated_price) VALUES (?,?,?,?)");
        for(const item of normalizedItems) insert.run(id,item.productId,item.quantity,item.price);
      }
      return {message:"Pedido atualizado."};
    });
  }
}
