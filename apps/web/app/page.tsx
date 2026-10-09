"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, type SessionUser } from "../lib/api";
import { CatalogEditor } from "../components/catalog-editor";
import CustomerEditor from "../components/customer-editor";
import OccurrenceEditor from "../components/occurrence-editor";
import CustomerRequest from "../components/customer-request";
import OrdersView from "../components/orders-view";
import UsersEditor from "../components/users-editor";
import RegistrationApprovals from "../components/registration-approvals";
import GoalsView from "../components/goals-view";
import ReportsView from "../components/reports-view";
import SettingsEditor from "../components/settings-editor";
import PasswordChange from "../components/password-change";
import DashboardView from "../components/dashboard-view";

type Route = "approvals" | "requestCustomer" | "dashboard" | "orders" | "customers" | "companies" | "products" | "occurrences" | "reports" | "goals" | "users" | "admin";
type RecordData = Record<string, unknown>;
const adminRoutes: { id:Route; title:string; endpoint?:`/api/${string}`; key?:string }[] = [
 {id:"dashboard",title:"Dashboard",endpoint:"/api/admin/overview"},
 {id:"orders",title:"Pedidos e propostas",endpoint:"/api/proposals",key:"proposals"},
 {id:"customers",title:"Clientes",endpoint:"/api/admin/customers",key:"customers"},
 {id:"approvals",title:"Aprovação de cadastros",endpoint:"/api/admin/requests",key:"requests"},
 {id:"companies",title:"Empresas",endpoint:"/api/admin/companies",key:"companies"},
 {id:"products",title:"Produtos",endpoint:"/api/admin/products",key:"products"},
 {id:"occurrences",title:"Ocorrências",endpoint:"/api/occurrences",key:"occurrences"},
 {id:"reports",title:"Relatórios"},
 {id:"goals",title:"Metas",endpoint:"/api/admin/goals"},
 {id:"users",title:"Usuários",endpoint:"/api/admin/users",key:"users"},
 {id:"admin",title:"Configurações",endpoint:"/api/admin/settings"}
];
const sellerRoutes = adminRoutes.filter(x=>["dashboard","orders","customers","companies","products","occurrences","goals"].includes(x.id)).map(x=>({
 ...x,
 endpoint: ({dashboard:"/api/dashboard",customers:"/api/customers",companies:"/api/companies",products:"/api/products",goals:"/api/goals/my"} as Record<string,`/api/${string}`>)[x.id] || x.endpoint
}));
const asText=(v:unknown):string => v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
const scalarRows=(data:RecordData)=>Object.entries(data).filter(([,v])=>typeof v!=="object"||v===null);
function DataView({route}:{route:(typeof adminRoutes)[number]}) {
 const [value,setValue]=useState<RecordData|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(false);
 const endpoint=route.endpoint;
 useEffect(()=>{let active=true;if(!endpoint){setValue(null);return;}setLoading(true);setError("");setValue(null);
 api<RecordData>(endpoint).then(v=>{if(active)setValue(v)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao carregar")}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};},[endpoint]);
 if(!endpoint)return <section className="tile"><h2>{route.title}</h2><p>Esta área não possui operações disponíveis nesta tela.</p></section>;
 if(loading)return <p>Carregando {route.title.toLowerCase()}…</p>;
 if(error)return <p className="error" role="alert">{error}</p>;
 if(!value)return null;
 const items=route.key&&Array.isArray(value[route.key])?value[route.key] as RecordData[]:null;
 return <section className="tile"><h2>{route.title}</h2>{items?<><p className="muted">{items.length} registro(s)</p>
 <div className="table-wrap"><table><thead><tr>{Object.keys(items[0]||{}).filter(k=>!["password_hash","content","form_payload"].includes(k)).slice(0,7).map(k=><th key={k}>{k.replaceAll("_"," ")}</th>)}</tr></thead>
 <tbody>{items.slice(0,100).map((item,i)=><tr key={String(item.id??i)}>{Object.keys(items[0]||{}).filter(k=>!["password_hash","content","form_payload"].includes(k)).slice(0,7).map(k=><td key={k}>{asText(item[k])}</td>)}</tr>)}</tbody></table></div>
 {items.length>100&&<p className="muted">Exibindo os primeiros 100 registros.</p>}</>:<dl className="key-values">{scalarRows(value).map(([key,v])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{asText(v)}</dd></div>)}</dl>}
 <p className="muted">Consulta de dados pela API existente.</p></section>;
}
export default function Home(){
 const [view,setView]=useState<"loading"|"login"|"home">("loading");
 const [user,setUser]=useState<SessionUser|null>(null);
 const [route,setRoute]=useState<Route>("dashboard");
 const [username,setUsername]=useState("");const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{let active=true;api<{user:SessionUser}>("/api/me").then(r=>{if(!active)return;setUser(r.user);setRoute("dashboard");setView("home")}).catch(()=>{if(active)setView("login")});return()=>{active=false}},[]);
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");
 try{await api("/api/login",{method:"POST",body:JSON.stringify({username,password})});const r=await api<{user:SessionUser}>("/api/me");setUser(r.user);setRoute(r.user.is_super_admin?"superAdmin":"dashboard");setView("home");setPassword("")}
 catch(e){setError(e instanceof Error?e.message:"Falha no login")}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{await api("/api/logout",{method:"POST"});setView("login");setUser(null)}catch(e){setError(e instanceof Error?e.message:"Falha ao sair")}finally{setBusy(false)}}
 if(view==="home"&&user?.must_change_password)return <PasswordChange required onSuccess={async()=>{const result=await api<{user:SessionUser}>("/api/me");setUser(result.user)}}/>;
 if(view==="loading")return <main className="wrap">Carregando Hipersales…</main>;
 if(view==="login")return <main className="wrap"><form className="panel" onSubmit={login}><h1>Hipersales</h1><p>Portal comercial</p><label className="field">Usuário<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="field">Senha<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy?"Entrando…":"Entrar"}</button></form></main>;
 const nav=user?.role==="admin"?adminRoutes:sellerRoutes;
 const navItems=user?.role==="seller"?[...nav,{id:"requestCustomer" as Route,title:"Solicitar cadastro"}]:nav;
 const selected=navItems.find(v=>v.id===route)||nav[0];
 const title=selected.title;
 return <div className="workspace">
 <button type="button" className="fixed bottom-5 right-5 z-50 rounded-xl bg-violet-800 px-5 py-3 font-semibold text-white shadow-lg md:hidden" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-controls="app-navigation">{menuOpen?"Fechar":"☰ Menu"}</button>
 {menuOpen&&<button type="button" aria-label="Fechar navegação" className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" onClick={()=>setMenuOpen(false)}/>}
 <aside id="app-navigation" className={`nav-side ${menuOpen?"":"max-md:hidden"}`}>
 <div className="nav-brand"><h2>◆ Hipersales</h2><p>Console de gestão</p></div>
 <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Empresa</p><p className="mt-2 text-sm font-bold text-white">HiperMix Representações</p></div>
 <nav aria-label="Navegação principal">{navItems.map((item,i)=><div key={item.id}>{(i===0||i===7)&&<p className="nav-group-label">{i===0?"Ações":"Gestão"}</p>}<button type="button" className={item.id===selected.id?"selected":""} onClick={()=>{setRoute(item.id);setMenuOpen(false)}}>{item.title}</button></div>)}</nav>
 <div className="mt-auto border-t border-white/10 pt-4"><p className="truncate px-3 text-xs text-violet-200">{user?.name}</p></div>
 </aside>
 <div className="workspace-main">
 <header className="top"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">{"HiperMix / Hipersales"}</span><strong className="block truncate text-base">{title}</strong></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{user?.name}</span><button className="secondary" disabled={busy} onClick={logout}>Sair</button></div></header>
 <main className="content"><div className="mb-5 flex justify-end"><PasswordChange onSuccess={async()=>{const result=await api<{user:SessionUser}>("/api/me");setUser(result.user)}}/></div>
 {selected.id==="dashboard"&&user?<DashboardView user={user}/>:
 selected.id==="admin"&&user?.role==="admin"?<SettingsEditor/>:
 selected.id==="goals"&&user?<GoalsView user={user}/>:
 selected.id==="reports"&&user?.role==="admin"?<ReportsView/>:
 selected.id==="approvals"&&user?.role==="admin"?<RegistrationApprovals/>:
 selected.id==="users"&&user?.role==="admin"?<UsersEditor/>:
 selected.id==="orders"?<OrdersView user={user!}/>:
 selected.id==="requestCustomer"?<CustomerRequest/>:
 selected.id==="occurrences"&&user?<OccurrenceEditor user={user}/>:
 user?.role==="admin"&&selected.id==="customers"?<CustomerEditor/>:
 user?.role==="admin"&&(selected.id==="companies"||selected.id==="products")?<CatalogEditor key={selected.id} kind={selected.id}/>:
 <DataView key={selected.id} route={selected}/>}
 </main></div></div>;
}
