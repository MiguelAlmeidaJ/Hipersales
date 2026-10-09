"use client";
import { useEffect, useState } from "react";
import { api, type SessionUser } from "../lib/api";
type Overview={summary?:Record<string,number>;status_counts?:Record<string,number>};
const titles:Record<string,string>={users:"Usuários",admins:"Administradores",sellers:"Representantes",companies:"Indústrias",products:"Produtos",customers:"Clientes",associations:"Associações",proposals:"Pedidos",approved_orders:"Aprovados",pending_requests:"Cadastros pendentes",outbox:"Mensagens"};
const statuses:Record<string,string>={em_analise:"Em análise",pedido_aprovado:"Pedido aprovado",recusado:"Recusado",em_producao:"Em produção",faturado:"Faturado",entregue:"Entregue"};
export default function DashboardView({user}:{user:SessionUser}){
 const [data,setData]=useState<Overview|Record<string,unknown>>({}),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const admin=user.role==="admin";
 useEffect(()=>{let active=true;setBusy(true);api<Overview|Record<string,unknown>>(admin?"/api/admin/overview":"/api/dashboard").then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao consultar indicadores")}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[admin]);
 if(busy)return <p role="status">Carregando indicadores…</p>;
 if(error)return <p role="alert" className="text-red-700">{error}</p>;
 const overview=data as Overview;
 const summary=overview.summary||Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==="number")) as Record<string,number>;
 const statusCounts=overview.status_counts||{};
 const total=Object.values(statusCounts).reduce((a,b)=>a+b,0);
 return <section className="space-y-6"><div><h2 className="text-2xl font-bold">Visão geral</h2><p className="text-sm text-slate-500">{admin?"Indicadores da operação":"Indicadores comerciais do representante"}</p></div>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(summary).map(([key,val])=><div key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{titles[key]||key.replaceAll("_"," ")}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{typeof val==="number"?val.toLocaleString("pt-BR"):String(val)}</p></div>)}</div>
 {total>0&&<section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-4 text-lg font-semibold">Pedidos por etapa</h3><div className="space-y-3">{Object.entries(statusCounts).map(([key,val])=><div key={key}><div className="mb-1 flex justify-between text-sm"><span>{statuses[key]||key}</span><span>{val}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{width:`${total?100*val/total:0}%`}}/></div></div>)}</div></section>}
 {!Object.keys(summary).length&&<div className="rounded-xl border bg-white p-5 text-slate-500">Não há indicadores numéricos disponíveis neste retorno.</div>}
 </section>;
}
