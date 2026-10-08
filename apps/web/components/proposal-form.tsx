"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type SessionUser } from "../lib/api";

type Company={id:number;name:string;active?:number|boolean};
type Customer={id:number;legal_name:string;active?:number|boolean};
type Product={id:number;company_id:number;name:string;code:string;price:number;unit:string;active?:number|boolean};
type Seller={id:number;name:string;role:string;active?:number|boolean};
type Line={product_id:number;quantity:string;negotiated_price:string};
const initial={company_id:"",customer_id:"",seller_id:"",order_type:"Venda de Mercadoria",freight_type:"CIF - Pago pela Industria",delivery_type:"Entrega Imediata",scheduled_delivery_date:"",purchase_order:"",payment_terms:"Pagamento Antecipado",discount_percent:"0",discount_on:"Sem descontos",commission_percent:"0",invoice_type:"Com nota cheia",tax_operator_invoice:false,notes:""};
const field="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
const label="grid gap-1.5 text-sm font-medium text-slate-700";
const money=(amount:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(amount);
export default function ProposalForm({user,onCreated}:{user:SessionUser;onCreated?:()=>void}){
 const isAdmin=user.role==="admin";
 const [companies,setCompanies]=useState<Company[]>([]);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [sellers,setSellers]=useState<Seller[]>([]);
 const [form,setForm]=useState(initial);
 const [lines,setLines]=useState<Line[]>([]);
 const [productId,setProductId]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 useEffect(()=>{let active=true;async function load(){
 try{
 const [c,u]=await Promise.all([api<{companies:Company[]}>("/api/companies"),api<{customers:Customer[]}>("/api/customers")]);
 if(!active)return;setCompanies(c.companies||[]);setCustomers(u.customers||[]);
 if(isAdmin){const s=await api<{users:Seller[]}>("/api/admin/users");if(active)setSellers((s.users||[]).filter(v=>v.role==="seller"&&Boolean(v.active)));}
 }catch(e){if(active)setError(e instanceof Error?e.message:"Falha ao carregar dados comerciais");}finally{if(active)setLoading(false);}
 }void load();return()=>{active=false};},[isAdmin]);
 useEffect(()=>{let active=true;setProducts([]);setLines([]);setProductId("");
 if(!form.company_id)return()=>{active=false};
 api<{products:Product[]}>(`/api/products?company_id=${encodeURIComponent(form.company_id)}`).then(r=>{if(active)setProducts((r.products||[]).filter(p=>Boolean(p.active)))}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao carregar produtos")});
 return()=>{active=false};},[form.company_id]);
 const bonus=/bonific/i.test(form.order_type);
 const total=useMemo(()=>lines.reduce((sum,l)=>sum+Number(l.quantity||0)*Number(l.negotiated_price||0),0),[lines]);
 function update<K extends keyof typeof initial>(name:K,value:(typeof initial)[K]){setForm(v=>({...v,[name]:value}));}
 function addLine(){const product=products.find(x=>String(x.id)===productId);if(!product)return;setLines(v=>v.some(x=>x.product_id===product.id)?v:[...v,{product_id:product.id,quantity:"1",negotiated_price:String(product.price)}]);setProductId("");}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");setSuccess("");
 try{
 if(!form.company_id||!form.customer_id)throw new Error("Selecione empresa e cliente.");
 if(isAdmin&&!form.seller_id)throw new Error("Selecione um representante.");
 if(!lines.length)throw new Error("Inclua pelo menos um produto.");
 for(const line of lines){if(!(Number(line.quantity)>0)||Number(line.negotiated_price)<0||!Number.isFinite(Number(line.negotiated_price)))throw new Error("Confira quantidades e preços.");}
 if(form.delivery_type==="Entrega Programada"&&!form.scheduled_delivery_date)throw new Error("Informe a data programada.");
 const payload={...form,company_id:Number(form.company_id),customer_id:Number(form.customer_id),
 ...(isAdmin?{seller_id:Number(form.seller_id)}:{}),
 commission_percent:bonus?0:Number(form.commission_percent),
 discount_percent:bonus?0:Number(form.discount_percent),
 payment_terms:bonus?"":form.payment_terms,
 items:lines.map(l=>({product_id:l.product_id,quantity:Number(l.quantity),negotiated_price:Number(l.negotiated_price)}))};
 const result=await api<{order_number?:number;id:number;message?:string}>("/api/proposals",{method:"POST",body:JSON.stringify(payload)});
 setSuccess(`${result.message||"Proposta enviada."} Nº ${result.order_number||result.id}.`);setLines([]);setForm(initial);onCreated?.();
 }catch(e){setError(e instanceof Error?e.message:"Falha ao criar proposta");}finally{setBusy(false);}}
 if(loading)return <p>Carregando formulário…</p>;
 return <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
 <div><h2 className="text-xl font-semibold">Nova proposta</h2><p className="text-sm text-slate-500">Os valores e as permissões serão validados pela API atual.</p></div>
 {error&&<p className="rounded-lg bg-red-50 p-3 text-red-700" role="alert">{error}</p>}
 {success&&<p className="rounded-lg bg-green-50 p-3 text-green-800" role="status">{success}</p>}
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 {isAdmin&&<label className={label}>Representante<select required className={field} value={form.seller_id} onChange={e=>update("seller_id",e.target.value)}><option value="">Selecione</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
 <label className={label}>Empresa<select required className={field} value={form.company_id} onChange={e=>update("company_id",e.target.value)}><option value="">Selecione</option>{companies.filter(x=>Boolean(x.active)).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label className={label}>Cliente<select required className={field} value={form.customer_id} onChange={e=>update("customer_id",e.target.value)}><option value="">Selecione</option>{customers.filter(x=>Boolean(x.active)).map(x=><option key={x.id} value={x.id}>{x.legal_name}</option>)}</select></label>
 <label className={label}>Tipo de pedido<select className={field} value={form.order_type} onChange={e=>update("order_type",e.target.value)}><option>Venda de Mercadoria</option><option>Bonificação</option></select></label>
 <label className={label}>Frete<select className={field} value={form.freight_type} onChange={e=>update("freight_type",e.target.value)}><option>CIF - Pago pela Industria</option><option>FOB - Pago pelo Cliente</option></select></label>
 <label className={label}>Entrega<select className={field} value={form.delivery_type} onChange={e=>update("delivery_type",e.target.value)}><option>Entrega Imediata</option><option>Entrega Programada</option></select></label>
 {form.delivery_type==="Entrega Programada"&&<label className={label}>Data da entrega<input type="date" required className={field} value={form.scheduled_delivery_date} onChange={e=>update("scheduled_delivery_date",e.target.value)}/></label>}
 <label className={label}>Pedido de compra<input className={field} value={form.purchase_order} onChange={e=>update("purchase_order",e.target.value)}/></label>
 <label className={label}>Tipo de nota<input className={field} value={form.invoice_type} onChange={e=>update("invoice_type",e.target.value)}/></label>
 {!bonus&&<><label className={label}>Pagamento<input required className={field} value={form.payment_terms} onChange={e=>update("payment_terms",e.target.value)}/></label>
 <label className={label}>Comissão (%)<input type="number" step="0.01" min="0" className={field} value={form.commission_percent} onChange={e=>update("commission_percent",e.target.value)}/></label>
 <label className={label}>Desconto (%)<input type="number" step="0.01" min="0" className={field} value={form.discount_percent} onChange={e=>update("discount_percent",e.target.value)}/></label>
 <label className={label}>Aplicar desconto em<select className={field} value={form.discount_on} onChange={e=>update("discount_on",e.target.value)}><option>Sem descontos</option><option>Produtos</option><option>Pedido</option></select></label></>}
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.tax_operator_invoice} onChange={e=>update("tax_operator_invoice",e.target.checked)}/> Nota fiscal do operador tributário</label>
 </div>
 <div className="border-t border-slate-100 pt-4"><h3 className="mb-3 font-semibold">Produtos</h3><div className="flex flex-wrap items-end gap-3">
 <label className="grid min-w-56 flex-1 gap-1 text-sm">Produto<select className={field} value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Selecione um produto</option>{products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
 <button type="button" disabled={!productId} onClick={addLine} className="rounded-lg bg-brand px-4 py-2.5 text-white disabled:opacity-50">Adicionar item</button></div>
 <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Produto","Quantidade","Valor negociado","Subtotal",""].map(v=><th className="border-b p-2" key={v}>{v}</th>)}</tr></thead><tbody>{lines.map(l=>{const p=products.find(x=>x.id===l.product_id);return <tr key={l.product_id}><td className="border-b p-2">{p?.name||l.product_id}</td>
 <td className="border-b p-2"><input aria-label="Quantidade" type="number" min="0.001" step="any" className="w-28 rounded border p-2" value={l.quantity} onChange={e=>setLines(v=>v.map(x=>x.product_id===l.product_id?{...x,quantity:e.target.value}:x))}/></td>
 <td className="border-b p-2"><input aria-label="Valor negociado" type="number" min="0" step="0.01" className="w-32 rounded border p-2" value={l.negotiated_price} onChange={e=>setLines(v=>v.map(x=>x.product_id===l.product_id?{...x,negotiated_price:e.target.value}:x))}/></td>
 <td className="border-b p-2">{money(Number(l.quantity)*Number(l.negotiated_price))}</td>
 <td className="border-b p-2"><button type="button" className="text-red-700" onClick={()=>setLines(v=>v.filter(x=>x.product_id!==l.product_id))}>Remover</button></td></tr>})}</tbody></table></div><p className="mt-3 text-right text-lg font-semibold">Subtotal: {money(total)}</p></div>
 <label className={label}>Observações<textarea className={field} rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)}/></label>
 <button className="rounded-lg bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60" disabled={busy||!lines.length}>{busy?"Enviando…":"Enviar proposta"}</button>
 </form>;
}
