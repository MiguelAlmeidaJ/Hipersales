"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import TenantPreview from "./tenant-preview";

export type Section="dashboard"|"orders"|"occurrences"|"customers"|"companies"|"products"|"reports"|"goals"|"users"|"settings";
type Result={tenant:{id:number;name:string};total:number;records:Record<string,unknown>[];limited:boolean};
const sections:{id:Section;title:string;group:string;icon:string}[]=[
 {id:"dashboard",title:"Dashboard",group:"Ações",icon:"▥"},
 {id:"orders",title:"Pedidos",group:"Ações",icon:"▤"},
 {id:"occurrences",title:"Ocorrências",group:"Ações",icon:"◫"},
 {id:"customers",title:"Clientes",group:"Ações",icon:"♙"},
 {id:"companies",title:"Empresas",group:"Ações",icon:"▦"},
 {id:"products",title:"Produtos",group:"Ações",icon:"◇"},
 {id:"reports",title:"Relatórios",group:"Gestão",icon:"▥"},
 {id:"goals",title:"Metas",group:"Gestão",icon:"◎"},
 {id:"users",title:"Usuários",group:"Gestão",icon:"♧"},
 {id:"settings",title:"Configurações",group:"Gestão",icon:"⚙"},
];
const columns:Record<string,Record<string,string>>={
 id:{id:"ID"},orders:{order_number:"Pedido",customer_name:"Cliente",company_name:"Empresa",seller_name:"Representante",status:"Status",created_at:"Data"},
 occurrences:{reason:"Motivo",customer_name:"Cliente",seller_name:"Representante",status:"Status",created_at:"Data"},
 customers:{legal_name:"Razão social",trade_name:"Nome fantasia",cnpj:"CNPJ",active:"Ativo"},
 companies:{name:"Nome",legal_name:"Razão social",active:"Ativo"},
 products:{name:"Produto",code:"Código",company_name:"Empresa",price:"Preço",active:"Ativo"},
 users:{name:"Nome",email:"Login",role:"Perfil",active:"Ativo"},
 goals:{seller_name:"Representante",year:"Ano",month:"Mês",sales_goal:"Meta vendas",new_customers_goal:"Novos clientes"}
};
const allowedFields:Record<string,string[]>={
 orders:["order_number","customer_name","company_name","seller_name","status","created_at"],
 occurrences:["reason","customer_name","seller_name","status","created_at"],
 customers:["legal_name","trade_name","cnpj","active"],companies:["name","legal_name","active"],
 products:["name","code","company_name","price","active"],users:["name","email","role","active"],
 goals:["seller_name","year","month","sales_goal","new_customers_goal"]
};
const display=(value:unknown,key:string)=>{
 if(value==null)return "—";
 if(key==="active")return value===1||value===true?"Sim":"Não";
 if(key==="created_at")return new Date(String(value)).toLocaleDateString("pt-BR");
 if(key==="price"||key==="sales_goal")return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value)||0);
 return String(value);
};
export default function TenantConsole({tenantId,tenantName,section,onBack}:{tenantId:number;tenantName:string;section:Section;onBack:()=>void}){
 const [search,setSearch]=useState(""),[term,setTerm]=useState("");
 const [result,setResult]=useState<Result|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 useEffect(()=>{if(section==="dashboard"||section==="reports"||section==="settings")return;
 let alive=true;setLoading(true);setError("");setResult(null);
 const q=new URLSearchParams();if(term)q.set("q",term);
 api<Result>(`/api/super-admin/tenants/${tenantId}/records/${section}${q.size?"?"+q:""}`)
 .then(x=>{if(alive)setResult(x)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Falha ao carregar registros")}).finally(()=>{if(alive)setLoading(false)});
 return()=>{alive=false};
 },[tenantId,section,term,revision]);
 const selected=sections.find(x=>x.id===section)!;
 useEffect(()=>{setSearch("");setTerm("");setError("");setResult(null);},[section,tenantId]);
 function submit(e:FormEvent){e.preventDefault();setTerm(search)}
 return <section className="min-w-0 space-y-5">
 {section==="dashboard"?<TenantPreview tenantId={tenantId} onBack={onBack} hideBack/>:
 section==="reports"?<div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Relatórios da empresa</h2><p className="mt-2 text-sm text-slate-600">Os indicadores, rankings e filtros estão disponíveis no Dashboard. A exportação de relatórios pertence ao administrador autenticado do tenant.</p><button className="mt-4 rounded-lg bg-violet-700 px-4 py-2.5 font-semibold text-white" onClick={onBack}>Voltar ao Superadmin</button></div>:
 section==="settings"?<div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Configurações do tenant</h2><p className="mt-2 text-sm text-slate-600">Configurações de SMTP, credenciais e integrações não são expostas na visualização Superadmin por segurança. Para editar, entre com uma conta administradora do tenant.</p></div>:
 <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-800">Operações / {selected.group}</p><h2 className="mt-1 text-2xl font-bold">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">Dados da empresa selecionada, sem permissão de alteração.</p></div><button type="button" onClick={()=>setRevision(x=>x+1)} className="rounded-lg border px-3 py-2 text-sm font-semibold">↻ Atualizar</button></div><form onSubmit={submit} className="mt-5 flex flex-wrap gap-2"><label className="min-w-[180px] flex-1"><span className="sr-only">Buscar registros</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar registros…" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/></label><button className="rounded-lg bg-violet-800 px-5 py-2 text-sm font-bold text-white">Buscar</button></form></div>
 {error&&<p className="p-5 text-red-700" role="alert">{error}</p>}
 {loading&&<p className="p-5 text-slate-500" role="status">Carregando registros…</p>}
 {result&&!loading&&<><div className="overflow-x-auto"><table className="w-full min-w-[630px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">ID</th>{allowedFields[section].map(key=><th key={key} className="px-4 py-3">{columns[section][key]||key}</th>)}</tr></thead><tbody>{result.records.map(row=><tr key={String(row.id)} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold">#{display(row.id,"id")}</td>{allowedFields[section].map(key=><td className="px-4 py-3" key={key}>{display(row[key],key)}</td>)}</tr>)}{!result.records.length&&<tr><td colSpan={allowedFields[section].length+1} className="p-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>}</tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{result.records.length} de {result.total} registro(s){result.limited?" · Exibindo os primeiros 100":""}</div></>}
 </section>}
 </section>;
}
