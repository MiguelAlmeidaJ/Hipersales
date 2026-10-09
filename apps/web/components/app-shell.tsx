"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api, type SessionUser } from "../lib/api";
import { getModuleFromPath, visibleModules } from "../lib/navigation";
import AppHeader from "./app-header";
import AppSidebar from "./app-sidebar";
import PasswordChange from "./password-change";
import { SessionContext } from "./session-context";

// Keep the existing hook API available to feature modules.
export { useAuthenticatedUser } from "./session-context";

type SessionStatus = "loading" | "login" | "home";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    api<{ user: SessionUser }>("/api/me")
      .then((response) => {
        if (!active) return;
        setUser(response.user);
        setStatus("home");
      })
      .catch(() => {
        if (active) setStatus("login");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const response = await api<{ user: SessionUser }>("/api/me");
      setUser(response.user);
      setStatus("home");
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no login");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);

    try {
      await api("/api/logout", { method: "POST" });
      setUser(null);
      setStatus("login");
      router.replace("/app/painel");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao sair");
    } finally {
      setBusy(false);
    }
  }

  async function refreshUser() {
    const response = await api<{ user: SessionUser }>("/api/me");
    setUser(response.user);
  }

  if (status === "loading") {
    return (
      <main className="wrap" role="status">
        Carregando Hipersales…
      </main>
    );
  }

  if (status === "login") {
    return (
      <main className="wrap">
        <form className="panel" onSubmit={login}>
          <h1>Hipersales</h1>
          <p>Portal comercial da HiperMix</p>
          <label className="field">
            Usuário
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="field">
            Senha
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button disabled={busy} className="primary">
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  if (user?.must_change_password) {
    return (
      <main className="wrap">
        <PasswordChange required onSuccess={refreshUser} />
      </main>
    );
  }

  const navigation = visibleModules(user?.role ?? "seller");
  const requestedModule = getModuleFromPath(pathname);
  const selectedModule = navigation.find(
    (item) => item.id === requestedModule?.id,
  );

  return (
    <div className="workspace app-frame">
      <button
        type="button"
        className="app-mobile-toggle md:hidden"
        aria-label={menuOpen ? "Fechar navegação" : "Abrir navegação"}
        aria-expanded={menuOpen}
        aria-controls="app-navigation"
        onClick={() => setMenuOpen((value) => !value)}
      >
        {menuOpen ? "×" : "☰"}
      </button>

      <AppSidebar
        user={user!}
        items={navigation}
        activeId={selectedModule?.id}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="workspace-main app-main">
        <AppHeader
          title={selectedModule?.title ?? "Hipersales"}
          user={user!}
          busy={busy}
          onLogout={logout}
          onUserChange={setUser}
        />

        <main className="content app-content">
          {selectedModule ? (
            <SessionContext.Provider value={user}>
              {children}
            </SessionContext.Provider>
          ) : (
            <section className="tile">
              <h1>Acesso indisponível</h1>
              <p className="mt-2 text-slate-600">
                Esta página não está disponível para o seu perfil.
              </p>
              <Link
                href="/app/painel"
                className="mt-4 inline-block font-semibold text-violet-700"
              >
                Ir para o painel
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
