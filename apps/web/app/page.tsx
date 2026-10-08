"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, type SessionUser } from "../lib/api";

type View = "loading" | "login" | "home" | "legacy";
const links = [
  ["dashboard", "Dashboard"],
  ["orders", "Pedidos e propostas"],
  ["customers", "Clientes"],
  ["companies", "Empresas"],
  ["products", "Produtos"],
  ["occurrences", "Ocorrências"],
  ["reports", "Relatórios"],
  ["goals", "Metas"],
  ["users", "Usuários"],
  ["admin", "Configurações"],
] as const;

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ user: SessionUser }>("/api/me")
      .then(({ user }) => { if (active) { setUser(user); setView("home"); } })
      .catch(() => { if (active) setView("login"); });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      // O backend mantem o contrato de autenticacao atual.
      await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      const result = await api<{ user: SessionUser }>("/api/me");
      setUser(result.user); setView("home"); setPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha no login."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);setError("");
    try { await api("/api/logout", { method: "POST" }); setUser(null);setView("login"); }
    catch (err) { setError(err instanceof Error ? err.message : "Falha ao sair."); }
    finally { setBusy(false); }
  }

  if (view === "loading") return <main className="wrap"><p>Carregando Hipersales…</p></main>;
  if (view === "legacy") return <iframe title="Hipersales — módulos legados" className="legacy-frame" src="/legacy" />;
  if (view === "login") return <main className="wrap"><form className="panel" onSubmit={login}>
    <h1>Hipersales</h1><p>Entre com sua conta para acessar o ambiente comercial.</p>
    <label className="field">Usuário<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></label>
    <label className="field">Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button disabled={busy} className="primary">{busy?"Entrando…":"Entrar"}</button>
  </form></main>;
  return <><header className="top"><div><strong>Hipersales</strong><div className="muted status">{user?.name}</div></div><div><button className="secondary" onClick={()=>setView("legacy")}>Abrir sistema completo</button> <button className="secondary" disabled={busy} onClick={logout}>Sair</button></div></header>
    <main className="content"><h1>Área comercial</h1><p className="muted">Novo frontend Next.js + TypeScript em migração gradual. Os módulos atuais continuam disponíveis sem mudança de regras.</p>
    <div className="grid">{links.filter(([route])=>user?.role==="admin"||route!=="users").map(([route,label])=><article key={route} className="tile"><button onClick={()=>setView("legacy")}>{label} →</button><p className="muted status">Abrir módulo existente</p></article>)}</div>
    </main></>;
}
