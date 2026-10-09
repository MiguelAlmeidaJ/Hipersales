"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
type Tenant={id:number;name?:string;slug?:string;status?:string;created_at?:string};
type Payload={tenants:Tenant[]};
export default function SuperAdminView(){
 const [tenants,setTenants]=useState<Tenant[]>([]),[overview,setOverview]=useState<Record<string,unknown>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError("");
 Promise.all([api<Record<string,unknown>>("/api/super-admin/overview"),api<Payload>("/api/super-admin/tenants")]).then(([o,t])=>{
 if(active){setOverview(o);setTenants(t.tenants||[]);}
 }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Erro ao carregar painel SaaS")}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};},[revision]);
 const metrics=Object.entries(overview).filter(([,value])=>typeof value==="number");
 return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Superadmin</h2><p className="text-sm text-slate-500">Monitoramento central de contas do Hipersales.</p></div>
 <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={()=>setRevision(v=>v+1)}>Atualizar</button></div>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
 {loading?<p role="status">Carregando contas…</p>:<>
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([key,value])=><div key={key} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{key.replaceAll("_"," ")}</p><p className="text-2xl font-semibold">{String(value)}</p></div>)}<div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Contas cadastradas</p><p className="text-2xl font-semibold">{tenants.length}</p></div></div>
 <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5"><h3 className="mb-4 text-lg font-semibold">Contas / tenants</h3><table className="w-full text-left text-sm"><thead><tr>{["ID","Nome","Identificador","Status","Cadastro"].map(t=><th className="border-b p-3" key={t}>{t}</th>)}</tr></thead><tbody>{tenants.map(t=><tr key={t.id}><td className="border-b p-3">{t.id}</td><td className="border-b p-3">{t.name||"—"}</td><td className="border-b p-3">{t.slug||"—"}</td><td className="border-b p-3">{t.status||"—"}</td><td className="border-b p-3">{t.created_at||"—"}</td></tr>)}</tbody></table></div>
 </>}
 </section>;
}
