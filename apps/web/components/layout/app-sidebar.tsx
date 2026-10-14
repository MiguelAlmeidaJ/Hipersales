"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FiActivity, FiBarChart2, FiBox, FiBriefcase, FiCheckCircle, FiChevronDown,
  FiChevronsLeft, FiChevronsRight, FiClipboard, FiFileText, FiHome, FiMenu,
  FiSettings, FiTarget, FiUserPlus, FiUsers, FiX,
} from "react-icons/fi";
import type { SessionUser } from "@/lib/api";
import { modulePath, type ModuleDefinition, type ModuleId } from "@/lib/navigation";

type SidebarProps = {
  user: SessionUser;
  items: ModuleDefinition[];
  activeId?: string;
  open: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
};

type MenuSection = { title: string; ids: ModuleId[] };
const sections: MenuSection[] = [
  { title: "Principal", ids: ["dashboard", "orders", "occurrences", "goals"] },
  { title: "Cadastros", ids: ["customers", "companies", "products", "requestCustomer"] },
  { title: "Administração", ids: ["approvals", "reports", "users", "admin"] },
];
const icons: Record<ModuleId, ComponentType<{ size?: number; className?: string }>> = {
  dashboard: FiHome,
  orders: FiClipboard,
  occurrences: FiActivity,
  customers: FiUsers,
  companies: FiBriefcase,
  products: FiBox,
  reports: FiBarChart2,
  goals: FiTarget,
  users: FiUsers,
  admin: FiSettings,
  approvals: FiCheckCircle,
  requestCustomer: FiUserPlus,
};

export default function AppSidebar({ user, items, activeId, open, collapsed, onToggleCollapsed, onClose }: SidebarProps) {
  const [expanded, setExpanded] = useState<string[]>(["Principal"]);
  const seller = user.role === "seller";
  const roleLabel = user.role === "dev" ? "Desenvolvedor" : user.role === "admin" ? "Administrador" : "Representante";

  useEffect(() => {
    const activeSection = sections.find(section => section.ids.includes(activeId as ModuleId))?.title;
    if (activeSection) setExpanded(previous => previous.includes(activeSection) ? previous : [...previous, activeSection]);
  }, [activeId]);

  function toggleSection(title: string) {
    setExpanded(previous => previous.includes(title) ? previous.filter(value => value !== title) : [...previous, title]);
  }

  return (
    <>
      {open && <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/35 md:hidden" onClick={onClose} />}
      <aside id="app-navigation" className={`nav-side app-sidebar ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <div className="app-sidebar-brand-row">
          <Link href="/app/painel" className="app-brand" onClick={onClose} title="HiperSales — Painel" aria-label="HiperSales — Painel">
            {collapsed
              ? <Image src="/assets/favicon.png" width={40} height={40} alt="HiperSales" className="app-brand-icon" priority />
              : <Image src="/assets/logo_Hipersalesweb.png" width={220} height={96} alt="HiperSales" className="app-brand-image" priority />}
          </Link>
          <button type="button" className="app-collapse-button" onClick={onToggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}>
            {collapsed ? <FiChevronsRight size={18} /> : <FiChevronsLeft size={18} />}
          </button>
          <button type="button" className="app-sidebar-mobile-close" onClick={onClose} aria-label="Fechar menu"><FiX size={21} /></button>
        </div>

        <nav className="app-menu" aria-label="Navegação principal">
          {sections.map(section => {
            const available = section.ids.map(id => items.find(item => item.id === id)).filter((item): item is ModuleDefinition => Boolean(item));
            if (!available.length) return null;
            const isExpanded = expanded.includes(section.title);
            return (
              <div key={section.title} className="app-nav-section">
                {!collapsed && !seller && (
                  <button type="button" className="app-menu-section-trigger" onClick={() => toggleSection(section.title)}
                    aria-expanded={isExpanded} aria-controls={`nav-${section.title.replace(/\\W/g, "")}`}>
                    <span>{section.title}</span>
                    <FiChevronDown size={15} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                )}
                {(seller || collapsed || isExpanded) && (
                  <div id={`nav-${section.title.replace(/\\W/g, "")}`} className="app-menu-section-links">
                    {available.map(item => {
                      const Icon = icons[item.id];
                      const active = item.id === activeId;
                      return (
                        <Link key={item.id} href={modulePath(item)} onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? item.title : undefined}
                          aria-label={collapsed ? item.title : undefined}
                          className={`app-menu-link ${active ? "is-active" : ""}`}>
                          <span className="app-menu-icon" aria-hidden="true"><Icon size={19} /></span>
                          {!collapsed && <span className="app-menu-title">{item.title}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <span className="app-user-avatar" aria-hidden="true">{(user.name || "H").slice(0, 1).toUpperCase()}</span>
          {!collapsed && <div className="min-w-0">
            <strong className="block truncate text-xs text-[#111111]">{user.name}</strong>
            <span className="text-[11px] text-[#65717c]">{roleLabel}</span>
          </div>}
        </div>
      </aside>
    </>
  );
}
