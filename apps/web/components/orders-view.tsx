"use client";
import { useEffect, useMemo, useState } from "react";
import { api, type SessionUser } from "../lib/api";
import ProposalForm from "./proposal-form";
import OrderAdmin from "./order-admin";

type Item = {id:number;name:string;code:string;quantity:number;negotiated_price:number};
type Timeline = {id:number;title:string;notes?:string;status:string;created_at:string;created_by_name?:string};
type Order = {
 id:number;order_number?:number;status:string;company_name:string;customer_name:string;
 seller_name:string;order_type:string;created_at:string;updated_at:string;items:Item[];
 timeline:Timeline[];payment_terms?:string;freight_type?:string;delivery_type?:string;
};
const cash=(x:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(x);
export default function OrdersView({user}:{user:SessionUser}){
 const [showForm,setShowForm]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("all");
 const [selected,setSelected]=useState<number|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;api<{proposals:Order[]}>("/api/proposals").then(r=>{if(active)setOrders(r.proposals||[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao carregar pedidos")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[refresh]);
 const statuses=useMemo(()=>Array.from(new Set(orders.map(x=>x.status))).sort(),[orders]);
 const filtered=useMemo(()=>orders.filter(x=>(status==="all"||x.status===status)&&[x.order_number,x.customer_name,x.company_name,x.seller_name,x.id].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[orders,query,status]);
 const current=orders.find(x=>x.id===selected);
 if(loading)return <p role="status">Carregando pedidos…</p>;
 return <section className="space-y-5">
 {showForm&&<ProposalForm user={user} onCreated={()=>{setRefresh(x=>x+1);setShowForm(false)}}/>}
 <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Pedidos e propostas</h2><p className="text-sm text-slate-500">{filtered.length} registro(s)</p></div><button type="button" onClick={()=>setShowForm(v=>!v)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">{showForm?"Fechar formulário":"Nova proposta"}</button></div>
  <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Buscar<input className="rounded-lg border border-slate-300 p-2.5" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Número, cliente, empresa ou representante"/></label><label className="grid gap-1 text-sm">Status<select className="rounded-lg border border-slate-300 bg-white p-2.5" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></label></div>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead className="bg-slate-50"><tr>{["Número","Cliente","Empresa","Status","Data",""].map(x=><th className="border-b border-slate-200 p-3" key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map(o=><tr className="border-b border-slate-100" key={o.id}><td className="p-3 font-semibold">{o.order_number||o.id}</td><td className="p-3">{o.customer_name}</td><td className="p-3">{o.company_name}</td><td className="p-3">{o.status}</td><td className="p-3">{o.created_at}</td><td className="p-3"><button className="rounded-lg border border-slate-300 px-3 py-2 text-brand" onClick={()=>setSelected(o.id)}>Detalhes</button></td></tr>)}</tbody></table></div>
 </div>
 {current&&<section className="rounded-xl border border-slate-200 bg-white p-5">
  <div className="mb-5 flex flex-wrap justify-between gap-4"><div><h2 className="text-xl font-bold">Pedido #{current.order_number||current.id}</h2><p className="text-sm text-slate-500">{current.customer_name} · {current.company_name}</p></div><div className="flex gap-2"><a className="rounded-lg bg-brand px-4 py-2 text-sm text-white" target="_blank" rel="noreferrer" href={`/api/proposals/${current.id}/pdf`}>Gerar PDF</a><button className="rounded-lg border border-slate-300 px-4 py-2" onClick={()=>setSelected(null)}>Fechar</button></div></div>
  <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Representante</dt><dd>{current.seller_name}</dd></div><div><dt className="text-slate-500">Condição de pagamento</dt><dd>{current.payment_terms||"—"}</dd></div><div><dt className="text-slate-500">Frete</dt><dd>{current.freight_type||"—"}</dd></div><div><dt className="text-slate-500">Entrega</dt><dd>{current.delivery_type||"—"}</dd></div></dl>
  <h3 className="mt-5 font-semibold">Itens</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Produto","Código","Quantidade","Unitário","Total"].map(x=><th className="border-b p-3" key={x}>{x}</th>)}</tr></thead><tbody>{(current.items||[]).map(i=><tr key={i.id}><td className="border-b p-3">{i.name}</td><td className="border-b p-3">{i.code}</td><td className="border-b p-3">{i.quantity}</td><td className="border-b p-3">{cash(i.negotiated_price)}</td><td className="border-b p-3">{cash(i.quantity*i.negotiated_price)}</td></tr>)}</tbody></table></div>
  {user.role==="admin"&&<OrderAdmin key={current.id} order={current} onSaved={()=>setRefresh(v=>v+1)}/>}
  <h3 className="mt-5 font-semibold">Histórico</h3><ol className="mt-3 space-y-3">{(current.timeline||[]).map((t,i)=><li className="border-l-2 border-blue-200 pl-4 text-sm" key={t.id||i}><strong>{t.title}</strong><p className="text-slate-500">{t.created_at} {t.created_by_name||""}</p>{t.notes&&<p>{t.notes}</p>}</li>)}</ol>
 </section>}
 </section>;
}
