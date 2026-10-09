"use client";

import Link from "next/link";
import type { SessionUser } from "../lib/api";
import { modulePath, type ModuleDefinition } from "../lib/navigation";

type SidebarProps = {
  user: SessionUser;
  items: ModuleDefinition[];
  activeId?: string;
  open: boolean;
  onClose: () => void;
};

export default function AppSidebar({ user, items, activeId, open, onClose }: SidebarProps) {
  const roleLabel = user.is_dev
    ? "Desenvolvedor"
    : user.role === "admin"
      ? "Administrador"
      : "Representante";

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          onClick={onClose}
        />
      )}

      <aside id="app-navigation" className={`nav-side app-sidebar ${open ? "is-open" : ""}`}>
        <Link href="/app/painel" className="app-brand" onClick={onClose}>
          <span className="app-brand-mark" aria-hidden="true">
            H
          </span>
          <span className="min-w-0">
            <strong className="block text-lg font-extrabold tracking-tight">Hipersales</strong>
            <span className="block text-xs text-violet-200/80">Gestão comercial</span>
          </span>
        </Link>

        <nav className="app-menu" aria-label="Navegação principal">
          {items.map((item, index) => {
            const firstInGroup = index === 0 || items[index - 1].group !== item.group;
            const active = item.id === activeId;

            return (
              <div key={item.id}>
                {firstInGroup && <p className="app-menu-heading">{item.group}</p>}
                <Link
                  href={modulePath(item)}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`app-menu-link ${active ? "is-active" : ""}`}
                >
                  <span className="app-menu-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.title}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <span className="app-user-avatar" aria-hidden="true">
            {(user.name || "H").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-xs text-white">{user.name}</strong>
            <span className="text-[11px] text-violet-200/70">{roleLabel}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
