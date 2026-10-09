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
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[menuOpen,setMenuOpen]=useState(false);
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
 return <div className="workspace">
 <button type="button" className="fixed bottom-5 right-5 z-50 rounded-xl bg-violet-800 px-5 py-3 font-semibold text-white shadow-lg md:hidden" aria-controls="app-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?"Fechar":"☰ Menu"}</button>
 {menuOpen&&<button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" onClick={()=>setMenuOpen(false)}/>}
 <aside id="app-navigation" className={`nav-side ${menuOpen?"":"max-md:hidden"}`}>
 <div className="nav-brand"><div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 text-xl font-extrabold text-white">H</span><div><h2>Hipersales</h2><p>Console comercial</p></div></div></div>
 <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Ambiente</p><p className="mt-1 truncate text-sm font-semibold text-white">HiperMix Representações</p></div>
 <nav aria-label="Navegação principal">{nav.map((item,i)=><div key={item.id}>{(i===0||nav[i-1].group!==item.group)&&<p className="nav-group-label">{item.group}</p>}<Link href={modulePath(item)} aria-current={selected?.id===item.id?"page":undefined} className={`flex w-full items-center rounded-xl border px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 ${selected?.id===item.id?"border-white/25 bg-white/15 shadow-sm":"border-transparent"}`}><span aria-hidden className="mr-3 inline-flex w-5 justify-center text-lg text-violet-100">{item.icon}</span><span>{item.title}</span>{selected?.id===item.id&&<span className="ml-auto size-1.5 rounded-full bg-violet-200"/>}</Link></div>)}</nav>
 <div className="mt-auto border-t border-white/10 pt-4"><p className="truncate px-3 text-xs text-violet-200">{user?.name}</p></div>
 </aside>
 <div className="workspace-main"><header className="top"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">HiperMix / Hipersales</span><strong className="block truncate text-base">{selected?.title||"Hipersales"}</strong></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{user?.name}</span>{user?.is_dev&&<span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-violet-800">Dev</span>}<button type="button" className="secondary" disabled={busy} onClick={logout}>Sair</button></div></header>
 <main className="content"><div className="mb-5 flex justify-end"><PasswordChange onSuccess={async()=>{const result=await api<{user:SessionUser}>("/api/me");setUser(result.user)}}/></div>{selected?<SessionContext.Provider value={user}>{children}</SessionContext.Provider>:<section className="tile"><h1>Acesso indisponível</h1><p className="mt-2 text-slate-600">Esta página não está disponível para o seu perfil.</p><Link href="/app/painel" className="mt-4 inline-block font-semibold text-violet-700">Ir para o painel</Link></section>}</main></div>
 </div>;
}
