"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import TenantPreview from "./tenant-preview";
type Tenant={id:number;name?:string;slug?:string;status?:string;created_at?:string;owner_email?:string;users_count?:number;companies_count?:number;customers_count?:number;proposals_count?:number};
type Payload={tenants:Tenant[]};
export default function SuperAdminView(){
 const [tenants,setTenants]=useState<Tenant[]>([]),[overview,setOverview]=useState<Record<string,unknown>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [saving,setSaving]=useState(false),[notice,setNotice]=useState("");
 const [selectedTenant,setSelectedTenant]=useState<number|null>(null),[search,setSearch]=useState("");
 const [form,setForm]=useState({name:"",slug:"",owner_email:"",admin_name:"",admin_email:"",admin_password:""});
 useEffect(()=>{let active=true;setLoading(true);setError("");
 Promise.all([api<Record<string,unknown>>("/api/super-admin/overview"),api<Payload>("/api/super-admin/tenants")]).then(([o,t])=>{
 if(active){setOverview(o);setTenants(t.tenants||[]);}
 }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Erro ao carregar painel SaaS")}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};},[revision]);
 const summary=(overview.summary&&typeof overview.summary==="object"?overview.summary:{}) as Record<string,number>;
 const metrics=Object.entries(summary).filter(([,value])=>typeof value==="number");
 const metricNames:Record<string,string>={tenants:"Total de tenants",active_tenants:"Contas ativas",tenant_users:"Usuários",proposals:"Pedidos e propostas",outbox:"Mensagens enviadas"};
 const filtered=tenants.filter(t=>[t.name,t.slug,t.owner_email].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 if(selectedTenant!==null)return <TenantPreview tenantId={selectedTenant} onBack={()=>setSelectedTenant(null)}/>;
 async function createTenant(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");setNotice("");try{
  if(form.admin_password.length<8)throw new Error("Defina uma senha com pelo menos 8 caracteres.");
  const result=await api<{message?:string}>("/api/super-admin/tenants",{method:"POST",body:JSON.stringify(form)});
  setNotice(result.message||"Conta criada.");setForm({name:"",slug:"",owner_email:"",admin_name:"",admin_email:"",admin_password:""});setRevision(x=>x+1);
 }catch(err){setError(err instanceof Error?err.message:"Não foi possível criar a conta")}finally{setSaving(false)}}
 return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Superadmin</h2><p className="text-sm text-slate-500">Monitoramento central de contas do Hipersales.</p></div>
 <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={()=>setRevision(v=>v+1)}>Atualizar</button></div>
 {notice&&<p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{notice}</p>}
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
 {loading?<p role="status">Carregando contas…</p>:<>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([key,value])=><div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{metricNames[key]||key.replaceAll("_"," ")}</p><p className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p></div>)}<div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Contas cadastradas</p><p className="mt-2 text-3xl font-bold tabular-nums">{tenants.length}</p></div></div>
 <form onSubmit={createTenant} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-1 text-lg font-semibold">Criar conta SaaS</h3><p className="mb-5 text-sm text-slate-500">Configure uma nova empresa e seu usuário administrador.</p><div className="grid gap-4 sm:grid-cols-2">{([["name","Nome da empresa"],["slug","Identificador (opcional)"],["owner_email","E-mail do proprietário (opcional)"],["admin_name","Nome do administrador"],["admin_email","Login do administrador"],["admin_password","Senha inicial"]] as const).map(([key,title])=><label key={key} className="grid gap-1.5 text-sm">{title}<input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" type={key==="admin_password"?"password":"text"} autoComplete={key==="admin_password"?"new-password":"off"} required={["name","admin_name","admin_email","admin_password"].includes(key)} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>)}</div><button disabled={saving} className="mt-4 rounded-lg bg-brand px-5 py-2.5 font-semibold text-white disabled:opacity-60">{saving?"Criando…":"Criar nova conta"}</button></form>
 <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Contas / tenants</h3><p className="text-sm text-slate-500">Selecione uma empresa para visualizar seus indicadores.</p></div><label className="text-sm"><span className="sr-only">Buscar tenants</span><input type="search" placeholder="Buscar nome ou identificador…" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5"/></label></div><table className="w-full text-left text-sm"><thead><tr>{["ID","Nome","Identificador","Status","Usuários","Pedidos","Cadastro","Ações"].map(t=><th className="border-b p-3" key={t}>{t}</th>)}</tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td className="border-b p-3">{t.id}</td><td className="border-b p-3">{t.name||"—"}</td><td className="border-b p-3">{t.slug||"—"}</td><td className="border-b p-3">{t.status||"—"}</td><td className="border-b p-3">{t.users_count??0}</td><td className="border-b p-3">{t.proposals_count??0}</td><td className="border-b p-3">{t.created_at?new Date(t.created_at).toLocaleDateString("pt-BR"):"—"}</td><td className="border-b p-3"><button type="button" onClick={()=>setSelectedTenant(t.id)} className="whitespace-nowrap rounded-lg bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800">Ver tenant →</button></td></tr>)}</tbody></table></div>
 </>}
 </section>;
}
