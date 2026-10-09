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
import DashboardView from "../components/dashboard-view";
import SuperAdminView from "../components/superadmin-view";

type Route = "approvals" | "requestCustomer" | "dashboard" | "orders" | "customers" | "companies" | "products" | "occurrences" | "reports" | "goals" | "users" | "admin" | "superAdmin";
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
 if(!endpoint)return <section className="tile"><h2>{route.title}</h2><p>Esta área ainda depende dos formulários e operações do painel anterior. Continue utilizando a versão clássica até a migração dos fluxos.</p><a href="/legacy">Abrir sistema clássico</a></section>;
 if(loading)return <p>Carregando {route.title.toLowerCase()}…</p>;
 if(error)return <p className="error" role="alert">{error} <a href="/legacy">Abrir sistema clássico</a></p>;
 if(!value)return null;
 const items=route.key&&Array.isArray(value[route.key])?value[route.key] as RecordData[]:null;
 return <section className="tile"><h2>{route.title}</h2>{items?<><p className="muted">{items.length} registro(s)</p>
 <div className="table-wrap"><table><thead><tr>{Object.keys(items[0]||{}).filter(k=>!["password_hash","content","form_payload"].includes(k)).slice(0,7).map(k=><th key={k}>{k.replaceAll("_"," ")}</th>)}</tr></thead>
 <tbody>{items.slice(0,100).map((item,i)=><tr key={String(item.id??i)}>{Object.keys(items[0]||{}).filter(k=>!["password_hash","content","form_payload"].includes(k)).slice(0,7).map(k=><td key={k}>{asText(item[k])}</td>)}</tr>)}</tbody></table></div>
 {items.length>100&&<p className="muted">Exibindo os primeiros 100 registros.</p>}</>:<dl className="key-values">{scalarRows(value).map(([key,v])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{asText(v)}</dd></div>)}</dl>}
 <p className="muted">Consultas nativas em React. Edição, exclusão e formulários complexos permanecem na interface anterior durante a migração.</p>
 <a href="/legacy">Abrir operações completas</a></section>;
}
export default function Home(){
 const [view,setView]=useState<"loading"|"login"|"home">("loading");
 const [user,setUser]=useState<SessionUser|null>(null);
 const [route,setRoute]=useState<Route>("dashboard");
 const [username,setUsername]=useState("");const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{let active=true;api<{user:SessionUser}>("/api/me").then(r=>{if(!active)return;setUser(r.user);setRoute(r.user.is_super_admin?"superAdmin":"dashboard");setView("home")}).catch(()=>{if(active)setView("login")});return()=>{active=false}},[]);
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");
 try{await api("/api/login",{method:"POST",body:JSON.stringify({username,password})});const r=await api<{user:SessionUser}>("/api/me");setUser(r.user);setRoute(r.user.is_super_admin?"superAdmin":"dashboard");setView("home");setPassword("")}
 catch(e){setError(e instanceof Error?e.message:"Falha no login")}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{await api("/api/logout",{method:"POST"});setView("login");setUser(null)}catch(e){setError(e instanceof Error?e.message:"Falha ao sair")}finally{setBusy(false)}}
 if(view==="loading")return <main className="wrap">Carregando Hipersales…</main>;
 if(view==="login")return <main className="wrap"><form className="panel" onSubmit={login}><h1>Hipersales</h1><p>Portal comercial</p><label className="field">Usuário<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="field">Senha<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy?"Entrando…":"Entrar"}</button></form></main>;
 const nav=user?.is_super_admin?[{id:"superAdmin" as Route,title:"Superadmin",endpoint:"/api/super-admin/overview" as const}]:user?.role==="admin"?adminRoutes:sellerRoutes;
 const selected=(user?.role==="seller"?[...nav,{id:"requestCustomer" as Route,title:"Solicitar cadastro"}]:nav).find(v=>v.id===route)||nav[0];
 return <div className="workspace"><aside className="nav-side"><h2>Hipersales</h2><p>{user?.name}</p><nav>{(user?.role==="seller"?[...nav,{id:"requestCustomer" as Route,title:"Solicitar cadastro"}]:nav).map(x=><button type="button" key={x.id} onClick={()=>setRoute(x.id)} className={x.id===selected.id?"selected":""}>{x.title}</button>)}</nav><a href="/legacy">Sistema clássico</a></aside><div className="workspace-main"><header className="top"><strong>{selected.title}</strong><button className="secondary" disabled={busy} onClick={logout}>Sair</button></header><main className="content">{selected.id==="superAdmin"&&user?.is_super_admin?<SuperAdminView/>:selected.id==="dashboard"&&user?<DashboardView user={user}/>:selected.id==="admin"&&user?.role==="admin"?<SettingsEditor/>:selected.id==="goals"&&user?<GoalsView user={user}/>:selected.id==="reports"&&user?.role==="admin"?<ReportsView/>:selected.id==="approvals"&&user?.role==="admin"?<RegistrationApprovals/>:selected.id==="users"&&user?.role==="admin"?<UsersEditor/>:selected.id==="orders"?<OrdersView user={user!}/>:selected.id==="requestCustomer"?<CustomerRequest/>:selected.id==="occurrences"&&user?<OccurrenceEditor user={user}/>:user?.role==="admin"&&selected.id==="customers"?<CustomerEditor/>:user?.role==="admin"&&(selected.id==="companies"||selected.id==="products")?<CatalogEditor key={selected.id} kind={selected.id}/>:<DataView key={selected.id} route={selected}/>}</main></div></div>;
}
