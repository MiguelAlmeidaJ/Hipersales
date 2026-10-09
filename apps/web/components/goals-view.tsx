"use client";
import { useEffect, useState } from "react";
import { api, type SessionUser } from "../lib/api";

type Progress={enabled:boolean;goal:number|null;realized:number;missing:number;percent:number};
type Performance={sales:Progress;new_customers:Progress;customer_positivation:Progress;portfolio:{customers:number;attended:number}};
type Entry={seller:{id:number;name:string;active:number|boolean};goals:Performance};
type GoalsResponse={year:number;month:number;rows:Entry[];goals?:Performance};
const fmt=(n:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(n);
const currency=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const names=[["sales","Vendas (R$)"],["new_customers","Novos clientes"],["customer_positivation","Positivação (%)"]] as const;
function Metric({name,value}:{name:string;value:Progress}){
 const isMoney=name==="sales";
 return <div className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-medium text-slate-600">{names.find(([key])=>key===name)?.[1]}</p>
 <p className="mt-1 text-lg font-bold">{isMoney?currency(value.realized):fmt(value.realized)} <span className="text-sm font-normal text-slate-500">/ {value.enabled?(isMoney?currency(value.goal||0):fmt(value.goal||0)):"Sem meta"}</span></p>
 <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{width:`${Math.max(0,Math.min(100,value.percent))}%`}}/></div>
 </div>;
}
export default function GoalsView({user}:{user:SessionUser}){
 const admin=user.role==="admin";
 const [month,setMonth]=useState(new Date().getMonth()+1),[year,setYear]=useState(new Date().getFullYear());
 const [entries,setEntries]=useState<Entry[]>([]),[mine,setMine]=useState<Performance|null>(null);
 const [draft,setDraft]=useState<Record<number,{sales:string;customers:string;positivation:string}>>({});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{let active=true;setLoading(true);setError("");
 const url=(admin?"/api/admin/goals":"/api/goals/my")+ `?year=${year}&month=${month}`;
 api<GoalsResponse>(url as `/api/${string}`).then(result=>{
  if(!active)return;
  if(admin){setEntries(result.rows||[]);setDraft(Object.fromEntries((result.rows||[]).map(row=>[row.seller.id,{
   sales:row.goals.sales.goal==null?"":String(row.goals.sales.goal),
   customers:row.goals.new_customers.goal==null?"":String(row.goals.new_customers.goal),
   positivation:row.goals.customer_positivation.goal==null?"":String(row.goals.customer_positivation.goal)
  }])));}
  else setMine(result.goals||null);
 }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao consultar metas")}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};},[admin,month,year]);
 async function save(){setSaving(true);setNotice("");setError("");
 try{
  const goals=entries.map(({seller})=>({seller_id:seller.id,
   sales_goal:draft[seller.id]?.sales||null,new_customers_goal:draft[seller.id]?.customers||null,
   customer_positivation_goal:draft[seller.id]?.positivation||null}));
  const r=await api<{message:string}>("/api/admin/goals",{method:"POST",body:JSON.stringify({year,month,goals})});setNotice(r.message);
 }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar")}finally{setSaving(false)}}
 const input="w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
 return <section className="space-y-5"><div className="rounded-xl border border-slate-200 bg-white p-5">
 <h2 className="mb-4 text-xl font-semibold">Metas comerciais</h2>
 <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Mês<select className={input} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Date(2026,i,1).toLocaleString("pt-BR",{month:"long"})}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Ano<input className={input} type="number" min="2020" max="2100" value={year} onChange={e=>setYear(Number(e.target.value))}/></label></div></div>
 {loading?<p role="status">Carregando metas…</p>:admin?<div className="space-y-4">{entries.map(({seller,goals})=><div className="rounded-xl border border-slate-200 bg-white p-5" key={seller.id}><h3 className="mb-4 text-lg font-semibold">{seller.name}</h3>
 <div className="grid gap-3 md:grid-cols-3">{names.map(([key])=><Metric key={key} name={key} value={goals[key]}/>)}</div>
 <div className="mt-4 grid gap-3 md:grid-cols-3">{([["sales","Meta de vendas"],["customers","Novos clientes"],["positivation","Positivação (%)"]] as const).map(([key,name])=><label className="grid gap-1 text-sm" key={key}>{name}<input type="number" min="0" step={key==="customers"?"1":"0.01"} className={input} value={draft[seller.id]?.[key]||""} onChange={e=>setDraft(v=>({...v,[seller.id]:{...v[seller.id],[key]:e.target.value}}))}/></label>)}</div></div>)}
 <button className="rounded-lg bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={saving} onClick={save}>Salvar metas</button></div>:mine?<div className="grid gap-4 md:grid-cols-3">{names.map(([key])=><Metric key={key} name={key} value={mine[key]}/>)}</div>:null}
 {error&&<p role="alert" className="text-red-700">{error}</p>}{notice&&<p role="status" className="text-green-700">{notice}</p>}
 </section>;
}
