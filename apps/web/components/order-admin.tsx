"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../lib/api";

type Item={id:number;product_id:number;quantity:number;negotiated_price:number;name:string;code:string};
type Product={id:number;company_id:number;name:string;code:string;active:number|boolean;price:number};
type Order={
 id:number;company_id:number;status:string;items:Item[];
 admin_notes?:string;delivery_forecast?:string;industry_order_number?:string;invoice_number?:string;
 payment_terms?:string;notes?:string;order_type?:string;purchase_order?:string;
 commission_percent?:number;invoice_type?:string;tax_operator_invoice?:number|boolean;
 freight_type?:string;delivery_type?:string;scheduled_delivery_date?:string;
 discount_percent?:number;discount_on?:string;
};
type Row={product_id:number;quantity:string;negotiated_price:string};
const textfield="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
const fields=[
 ["admin_notes","Observações administrativas"],["delivery_forecast","Previsão de entrega"],
 ["industry_order_number","Número do pedido na indústria"],["invoice_number","Nota fiscal"],
 ["payment_terms","Condição de pagamento"],["notes","Observações do pedido"],
 ["purchase_order","Pedido de compra"],["invoice_type","Tipo de nota"],
 ["freight_type","Tipo de frete"],["delivery_type","Entrega"],["scheduled_delivery_date","Entrega programada"]
] as const;
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
export default function OrderAdmin({order,onSaved}:{order:Order;onSaved:()=>void}){
 const [values,setValues]=useState({
  status:order.status,admin_notes:order.admin_notes||"",delivery_forecast:order.delivery_forecast||"",
  industry_order_number:order.industry_order_number||"",invoice_number:order.invoice_number||"",
  payment_terms:order.payment_terms||"",notes:order.notes||"",purchase_order:order.purchase_order||"",
  invoice_type:order.invoice_type||"",freight_type:order.freight_type||"",
  delivery_type:order.delivery_type||"",scheduled_delivery_date:order.scheduled_delivery_date||"",
  order_type:order.order_type||"",commission_percent:String(order.commission_percent??0),
  discount_percent:String(order.discount_percent??0),discount_on:order.discount_on||"Sem descontos",
  tax_operator_invoice:Boolean(order.tax_operator_invoice)
 });
 const [products,setProducts]=useState<Product[]>([]);
 const [rows,setRows]=useState<Row[]>((order.items||[]).map(i=>({product_id:i.product_id,quantity:String(i.quantity),negotiated_price:String(i.negotiated_price)})));
 const [pick,setPick]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{let alive=true;api<{products:Product[]}>(`/api/admin/products?company_id=${order.company_id}`).then(v=>{if(alive)setProducts((v.products||[]).filter(p=>p.company_id===order.company_id))}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Falha ao consultar catálogo")});return()=>{alive=false}},[order.company_id]);
 const gross=useMemo(()=>rows.reduce((sum,l)=>sum+(Number(l.quantity)||0)*(Number(l.negotiated_price)||0),0),[rows]);
 const isBonus=/bonific/i.test(values.order_type);
 const supportedStatuses=[["em_analise","Em análise"],["pedido_aprovado","Pedido aprovado"],["recusado","Recusado"],["em_producao","Em produção"],["faturado","Faturado"],["entregue","Entregue"]] as const;
 function update(key:keyof typeof values,value:string|boolean){setValues(v=>({...v,[key]:value}))}
 function addItem(){const p=products.find(p=>String(p.id)===pick);if(!p||rows.some(r=>r.product_id===p.id))return;setRows(v=>[...v,{product_id:p.id,quantity:"1",negotiated_price:String(p.price??0)}]);setPick("")}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setNotice("");
 try{
  if(!rows.length)throw new Error("O pedido precisa ter pelo menos um produto.");
  if(rows.some(r=>!Number.isFinite(+r.quantity)||+r.quantity<=0||!Number.isFinite(+r.negotiated_price)||+r.negotiated_price<0))throw new Error("Revise quantidades e preços dos itens.");
  if(values.delivery_type==="Entrega Programada"&&!values.scheduled_delivery_date)throw new Error("Informe a data de entrega.");
  if(!isBonus&&!values.payment_terms.trim())throw new Error("Informe a condição de pagamento.");
  const payload={...values,commission_percent:Number(values.commission_percent),discount_percent:Number(values.discount_percent),
   scheduled_delivery_date:values.delivery_type==="Entrega Programada"?values.scheduled_delivery_date:null,
   items:rows.map(r=>({product_id:r.product_id,quantity:Number(r.quantity),negotiated_price:Number(r.negotiated_price)}))};
  const result=await api<{message?:string}>(`/api/admin/proposals/${order.id}`,{method:"PATCH",body:JSON.stringify(payload)});
  setNotice(result.message||"Pedido atualizado.");onSaved();
 }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar pedido")}finally{setBusy(false)}}
 return <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border border-blue-200 bg-blue-50/30 p-5">
 <h3 className="text-lg font-semibold">Editar pedido e itens</h3>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 <label className="grid gap-1 text-sm">Status<select className={textfield} value={values.status} onChange={e=>update("status",e.target.value)} required>{supportedStatuses.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Tipo de pedido<input className={textfield} value={values.order_type} onChange={e=>update("order_type",e.target.value)}/></label>
 {fields.filter(([key])=>!isBonus||key!=="payment_terms").map(([key,title])=><label key={key} className="grid gap-1 text-sm">{title}<input className={textfield} type={key==="scheduled_delivery_date"?"date":"text"} value={values[key]} onChange={e=>update(key,e.target.value)}/></label>)}
 {!isBonus&&<><label className="grid gap-1 text-sm">Comissão (%)<input className={textfield} type="number" min="0" step="0.01" value={values.commission_percent} onChange={e=>update("commission_percent",e.target.value)}/></label>
 <label className="grid gap-1 text-sm">Desconto (%)<input className={textfield} type="number" min="0" step="0.01" value={values.discount_percent} onChange={e=>update("discount_percent",e.target.value)}/></label>
 <label className="grid gap-1 text-sm">Aplicar desconto em<input className={textfield} value={values.discount_on} onChange={e=>update("discount_on",e.target.value)}/></label></>}
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.tax_operator_invoice} onChange={e=>update("tax_operator_invoice",e.target.checked)}/> Nota de operador tributário</label>
 </div>
 <section className="space-y-3 border-t border-blue-100 pt-4"><h4 className="font-semibold">Produtos do pedido</h4>
 <div className="flex flex-wrap items-end gap-3"><label className="grid min-w-60 flex-1 gap-1 text-sm">Adicionar produto da indústria<select className={textfield} value={pick} onChange={e=>setPick(e.target.value)}><option value="">Selecione</option>{products.filter(p=>Boolean(p.active)&&!rows.some(r=>r.product_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></label><button type="button" onClick={addItem} disabled={!pick} className="rounded-lg border border-blue-200 bg-white px-4 py-2 disabled:opacity-50">Adicionar</button></div>
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Produto","Quantidade","Preço negociado","Subtotal",""].map(t=><th className="border-b p-2" key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(row=>{const item=order.items?.find(i=>i.product_id===row.product_id),p=products.find(x=>x.id===row.product_id);return <tr key={row.product_id}>
 <td className="border-b p-2">{p?.name||item?.name||row.product_id}</td>
 <td className="border-b p-2"><input aria-label="Quantidade" type="number" min="0.001" step="any" className="w-24 rounded border p-2" value={row.quantity} onChange={e=>setRows(v=>v.map(x=>x.product_id===row.product_id?{...x,quantity:e.target.value}:x))}/></td>
 <td className="border-b p-2"><input aria-label="Preço negociado" type="number" min="0" step="0.01" className="w-32 rounded border p-2" value={row.negotiated_price} onChange={e=>setRows(v=>v.map(x=>x.product_id===row.product_id?{...x,negotiated_price:e.target.value}:x))}/></td>
 <td className="border-b p-2">{money(Number(row.quantity)*Number(row.negotiated_price))}</td>
 <td className="border-b p-2"><button type="button" disabled={rows.length===1} className="text-red-700 disabled:opacity-40" onClick={()=>setRows(v=>v.filter(x=>x.product_id!==row.product_id))}>Remover</button></td></tr>})}</tbody></table></div><p className="text-right font-semibold">Subtotal: {money(gross)}</p></section>
 {error&&<p role="alert" className="text-red-700">{error}</p>}{notice&&<p role="status" className="text-green-700">{notice}</p>}
 <button disabled={busy} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"Salvando…":"Salvar pedido e itens"}</button></form>;
}
