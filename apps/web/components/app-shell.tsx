"use client";
import {useEffect,useState,createContext,useContext,type FormEvent,type ReactNode} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {api,type SessionUser} from "../lib/api";
import {getModuleFromPath,modulePath,visibleModules} from "../lib/navigation";
import PasswordChange from "./password-change";

const SessionContext=createContext<SessionUser|null>(null);
export function useAuthenticatedUser(){const user=useContext(SessionContext);if(!user)throw new Error("Authenticated session is required");return user;}

export default function AppShell({children}:{children:ReactNode}){
 const pathname=usePathname(),router=useRouter();
 const [view,setView]=useState<"loading"|"login"|"home">("loading");
 const [user,setUser]=useState<SessionUser|null>(null);
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[menuOpen,setMenuOpen]=useState(false),[accountOpen,setAccountOpen]=useState(false);
 useEffect(()=>{let active=true;api<{user:SessionUser}>("/api/me").then(result=>{if(active){setUser(result.user);setView("home")}}).catch(()=>{if(active)setView("login")});return()=>{active=false}},[]);
 useEffect(()=>{setMenuOpen(false)},[pathname]);
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");
 try{await api("/api/login",{method:"POST",body:JSON.stringify({username,password})});const result=await api<{user:SessionUser}>("/api/me");setUser(result.user);setView("home");setPassword("")}catch(e){setError(e instanceof Error?e.message:"Falha no login")}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{await api("/api/logout",{method:"POST"});setView("login");setUser(null);router.replace("/app/painel")}catch(e){setError(e instanceof Error?e.message:"Falha ao sair")}finally{setBusy(false)}}
 if(view==="loading")return <main className="wrap" role="status">Carregando Hipersales…</main>;
 if(view==="login")return <main className="wrap"><form className="panel" onSubmit={login}><h1>Hipersales</h1><p>Portal comercial da HiperMix</p><label className="field">Usuário<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="field">Senha<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}<button disabled={busy} className="primary">{busy?"Entrando…":"Entrar"}</button></form></main>;
 if(user?.must_change_password)return <main className="wrap"><PasswordChange required onSuccess={async()=>{const result=await api<{user:SessionUser}>("/api/me");setUser(result.user)}}/></main>;
 const module=getModuleFromPath(pathname);
 const nav=visibleModules(user?.role||"seller");
 const allowed=module&&nav.some(item=>item.id===module.id);
 const selected=allowed?module:null;
 return <div className="workspace app-frame">
 <button type="button" className="app-mobile-toggle md:hidden" aria-label={menuOpen?"Fechar navegação":"Abrir navegação"} aria-expanded={menuOpen} aria-controls="app-navigation" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?"×":"☰"}</button>
 {menuOpen&&<button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/60 md:hidden" onClick={()=>setMenuOpen(false)}/>}
 <aside id="app-navigation" className={`nav-side app-sidebar ${menuOpen?"is-open":""}`}>
  <Link href="/app/painel" className="app-brand" onClick={()=>setMenuOpen(false)}>
   <span className="app-brand-mark" aria-hidden>H</span><span className="min-w-0"><strong className="block text-lg font-extrabold tracking-tight">Hipersales</strong><span className="block text-xs text-violet-200/80">Gestão comercial</span></span>
  </Link>
  <nav className="app-menu" aria-label="Navegação principal">{nav.map((item,i)=><div key={item.id}>{(i===0||nav[i-1].group!==item.group)&&<p className="app-menu-heading">{item.group}</p>}<Link href={modulePath(item)} onClick={()=>setMenuOpen(false)} aria-current={selected?.id===item.id?"page":undefined} className={`app-menu-link ${selected?.id===item.id?"is-active":""}`}><span className="app-menu-icon" aria-hidden>{item.icon}</span><span className="truncate">{item.title}</span></Link></div>)}</nav>
  <div className="app-sidebar-footer"><span className="app-user-avatar" aria-hidden>{(user?.name||"H").slice(0,1).toUpperCase()}</span><div className="min-w-0"><strong className="block truncate text-xs text-white">{user?.name}</strong><span className="text-[11px] text-violet-200/70">{user?.is_dev?"Desenvolvedor":user?.role==="admin"?"Administrador":"Representante"}</span></div></div>
 </aside>
 <div className="workspace-main app-main">
  <header className="top app-header">
   <div className="min-w-0"><p className="app-breadcrumb">HiperMix <span className="mx-1 text-slate-300">/</span> {selected?.title||"Sistema"}</p><h1 className="app-header-title">{selected?.title||"Hipersales"}</h1></div>
   <div className="app-header-actions"><span className="hidden text-sm font-medium text-slate-600 lg:inline">{user?.name}</span>{user?.is_dev&&<span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-800">Dev</span>}<button type="button" className="app-account-button" aria-expanded={accountOpen} onClick={()=>setAccountOpen(v=>!v)}>Minha conta <span aria-hidden>{accountOpen?"⌃":"⌄"}</span></button><button type="button" className="app-logout-button" disabled={busy} onClick={logout}>Sair</button></div>
  </header>
  <main className="content app-content">
   {accountOpen&&<div className="app-account-panel"><PasswordChange onSuccess={async()=>{const result=await api<{user:SessionUser}>("/api/me");setUser(result.user);setAccountOpen(false)}}/></div>}
   {selected?<SessionContext.Provider value={user}>{children}</SessionContext.Provider>:<section className="tile"><h1>Acesso indisponível</h1><p className="mt-2 text-slate-600">Esta página não está disponível para o seu perfil.</p><Link href="/app/painel" className="mt-4 inline-block font-semibold text-violet-700">Ir para o painel</Link></section>}
  </main>
 </div>
 </div>;
}
