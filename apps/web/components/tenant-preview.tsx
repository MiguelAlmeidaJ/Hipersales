"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Tenant={id:number;name:string;slug:string;status:string};
type Order={id:number;order_number?:number;customer_name:string;status:string;created_at:string;total:number};
type Detail={tenant:Tenant;summary:Record<string,number>;statuses:{status:string;total:number}[];recent_orders:Order[]};
const labels:Record<string,string>={proposals:"Pedidos e propostas",customers:"Clientes",products:"Produtos",companies:"Empresas",sellers:"Representantes"};
const currency=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
export default function TenantPreview({tenantId,onBack}:{tenantId:number;onBack:()=>void}){
 const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);setError("");setDetail(null);
 api<Detail>(`/api/super-admin/tenants/${tenantId}`).then(v=>{if(active)setDetail(v)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao consultar tenant")}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};
 },[tenantId]);
 return <section className="space-y-6">
  <div className="flex flex-wrap items-start justify-between gap-3"><div>
   <button onClick={onBack} className="mb-3 text-sm font-medium text-blue-700 hover:underline">← Voltar ao Superadmin</button>
   <h1 className="text-3xl font-bold tracking-tight">Dashboard do tenant</h1>
   <p className="mt-1 text-slate-500">{detail?detail.tenant.name:"Visão da operação"} · Visualização administrativa somente leitura</p>
  </div><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">Modo de visualização</span></div>
  {loading&&<p role="status">Carregando informações do tenant…</p>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
  {detail&&<>
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(detail.summary).map(([key,value])=><div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{labels[key]||key}</p><p className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p></div>)}</div>
   <div className="grid gap-5 xl:grid-cols-2">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-1 text-lg font-semibold">Pedidos por status</h2><p className="mb-5 text-sm text-slate-500">Distribuição de todas as propostas desta conta.</p>
     <div className="space-y-4">{detail.statuses.length?detail.statuses.map(s=><div key={s.status}><div className="mb-1 flex justify-between text-sm"><span>{s.status.replaceAll("_"," ")}</span><strong>{s.total}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${detail.summary.proposals?100*s.total/detail.summary.proposals:0}%`}}/></div></div>):<p className="text-slate-500">Nenhum pedido cadastrado.</p>}</div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-1 text-lg font-semibold">Informações da conta</h2><p className="mb-5 text-sm text-slate-500">Dados reais do tenant selecionado.</p><dl className="grid gap-4 text-sm">{[["Nome",detail.tenant.name],["Identificador",detail.tenant.slug],["Status",detail.tenant.status],["ID",String(detail.tenant.id)]].map(([k,v])=><div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl></section>
   </div>
   <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="p-6"><h2 className="text-lg font-semibold">Últimos pedidos</h2><p className="text-sm text-slate-500">Registros recentes desta conta, sem acesso para edição.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{["Pedido","Cliente","Status","Valor","Data"].map(x=><th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody>{detail.recent_orders.map(o=><tr key={o.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">#{o.order_number||o.id}</td><td className="px-5 py-4">{o.customer_name}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">{o.status.replaceAll("_"," ")}</span></td><td className="px-5 py-4">{currency(o.total)}</td><td className="px-5 py-4">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td></tr>)}{!detail.recent_orders.length&&<tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500">Nenhum pedido encontrado.</td></tr>}</tbody></table></div></section>
  </>}
 </section>;
}
