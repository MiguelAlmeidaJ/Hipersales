"use client";

import { useState } from "react";
import type { SessionUser } from "../lib/api";
import { api } from "../lib/api";
import PasswordChange from "./password-change";

type HeaderProps = {
  title: string;
  user: SessionUser;
  busy: boolean;
  onLogout: () => void;
  onUserChange: (user: SessionUser) => void;
};

export default function AppHeader({
  title,
  user,
  busy,
  onLogout,
  onUserChange,
}: HeaderProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  async function onPasswordChanged() {
    const result = await api<{ user: SessionUser }>("/api/me");
    onUserChange(result.user);
    setAccountOpen(false);
  }

  return (
    <header className="top app-header">
      <div className="min-w-0">
        <p className="app-breadcrumb">
          HiperMix <span className="mx-1 text-slate-300">/</span> {title}
        </p>
        <h1 className="app-header-title">{title}</h1>
      </div>

      <div className="app-header-actions">
        <span className="hidden text-sm font-medium text-slate-600 lg:inline">
          {user.name}
        </span>
        {user.is_dev && (
          <span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-800">
            Dev
          </span>
        )}
        <div className="relative">
          <button
            type="button"
            className="app-account-button"
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            onClick={() => setAccountOpen((value) => !value)}
          >
            Minha conta <span aria-hidden="true">{accountOpen ? "⌃" : "⌄"}</span>
          </button>
          {accountOpen && (
            <div
              role="dialog"
              aria-label="Configurações da conta"
              className="app-account-popover"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">Segurança da conta</p>
                </div>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => setAccountOpen(false)}
                >
                  ×
                </button>
              </div>
              <PasswordChange onSuccess={onPasswordChanged} />
            </div>
          )}
        </div>
        <button
          type="button"
          className="app-logout-button"
          disabled={busy}
          onClick={onLogout}
        >
          Sair
        </button>
      </div>
    </header>
  );
}
