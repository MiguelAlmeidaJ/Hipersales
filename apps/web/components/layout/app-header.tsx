"use client";

import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiDownload, FiKey, FiLogOut, FiShield, FiUser, FiX } from "react-icons/fi";
import PasswordChange from "@/components/auth/password-change";
import { api, type SessionUser } from "@/lib/api";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type HeaderProps = {
  title: string;
  user: SessionUser;
  busy: boolean;
  onLogout: () => void;
  onUserChange: (user: SessionUser) => void;
};

export default function AppHeader({ title, user, busy, onLogout, onUserChange }: HeaderProps) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const roleLabel = user.is_dev ? "Desenvolvedor" : user.role === "admin" ? "Administrador" : "Representante";
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "HS";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
        setPasswordOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setPasswordOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(standalone);
    function beforeInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    function afterInstall() {
      setInstalled(true);
      setInstallHelp(false);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", afterInstall);
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", afterInstall);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) { setInstallHelp(value => !value); return; }
    setInstallBusy(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } finally {
      setInstallBusy(false);
    }
  }

  async function onPasswordChanged() {
    const result = await api<{ user: SessionUser }>("/api/me");
    onUserChange(result.user);
    setPasswordOpen(false);
    setAccountOpen(false);
  }

  return (
    <header className="top app-header">
      <div className="min-w-0">
        <nav aria-label="Caminho da página" className="app-breadcrumb">
          <span>HiperMix</span><span className="mx-2 text-slate-300">/</span><span className="text-slate-600">{title}</span>
        </nav>
        <h1 className="app-header-title">{title}</h1>
      </div>

      <div className="app-header-actions">
        {!installed && (
          <div className="relative">
            <button type="button" onClick={installApp} disabled={installBusy}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cde4f4] bg-[#edf5fc] px-3 text-xs font-bold text-[#073c96] transition hover:bg-[#dfedfa] disabled:opacity-60"
              aria-label="Instalar aplicativo HiperSales">
              <FiDownload size={16} /><span className="hidden sm:inline">Instalar app</span>
            </button>
            {installHelp && (
              <div role="status" className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(85vw,310px)] rounded-xl border border-[#e4ebf0] bg-white p-4 text-xs leading-relaxed text-slate-600 shadow-xl">
                No iPhone, use Compartilhar → Adicionar à Tela de Início. No computador ou Android, procure Instalar app no menu do navegador. A instalação requer HTTPS ou localhost.
                <button type="button" className="mt-3 block font-bold text-[#0767b4]" onClick={() => setInstallHelp(false)}>Fechar</button>
              </div>
            )}
          </div>
        )}
        <div ref={menuRef} className="relative">
          <button type="button" className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-[#a8cde8] hover:bg-[#f7fbff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0767b4]"
            aria-expanded={accountOpen} aria-haspopup="dialog" aria-controls="app-account-menu"
            onClick={() => { setAccountOpen(value => !value); setPasswordOpen(false); }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e5f2fb] text-xs font-extrabold text-[#073c96]">{initials}</span>
            <span className="hidden min-w-0 flex-col sm:flex">
              <span className="max-w-32 truncate text-xs font-bold text-[#111111]">{user.name}</span>
              <span className="text-[11px] text-slate-500">{roleLabel}</span>
            </span>
            {user.is_dev && <span className="hidden rounded-md bg-[#eef2ff] px-1.5 py-1 text-[10px] font-bold text-[#073c96] lg:inline">DEV</span>}
            <FiChevronDown size={15} className={`text-slate-500 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
          </button>

          {accountOpen && (
            <div id="app-account-menu" role="dialog" aria-label="Menu da conta" className="app-account-popover">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e5f2fb] text-sm font-black text-[#073c96]">{initials}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-[#111111]">{user.name}</p><p className="flex items-center gap-1 text-xs text-slate-500"><FiShield size={12}/>{roleLabel}</p></div>
                </div>
                <button type="button" aria-label="Fechar menu" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => {setAccountOpen(false);setPasswordOpen(false);}}><FiX size={17}/></button>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500"><FiUser size={15}/> Minha conta</div>
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#073c96] hover:bg-[#edf5fc]" aria-expanded={passwordOpen} onClick={() => setPasswordOpen(value => !value)}><span className="flex items-center gap-2"><FiKey size={16}/> Alterar minha senha</span><FiChevronDown size={14} className={passwordOpen ? "rotate-180" : ""}/></button>
                {passwordOpen && <div className="rounded-xl bg-slate-50 p-3"><PasswordChange onSuccess={onPasswordChanged}/></div>}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" disabled={busy} onClick={onLogout}><FiLogOut size={16}/> Sair da conta</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
