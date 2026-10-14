"use client";

import Link from "next/link";
import { FiActivity, FiArrowUpRight, FiClipboard, FiFileText, FiTarget, FiUserPlus, FiUsers } from "react-icons/fi";
import type { SessionUser } from "@/lib/api";

const actions = [
  { title: "Nova proposta", description: "Monte e envie um pedido para seu cliente.", href: "/app/pedidos", Icon: FiFileText, featured: true },
  { title: "Solicitar cliente", description: "Peça o cadastro de um novo cliente.", href: "/app/solicitar-cliente", Icon: FiUserPlus, featured: true },
  { title: "Meus clientes", description: "Consulte sua carteira de clientes.", href: "/app/clientes", Icon: FiUsers },
  { title: "Consultar pedidos", description: "Acompanhe propostas e pedidos.", href: "/app/pedidos", Icon: FiClipboard },
  { title: "Registrar ocorrência", description: "Comunique uma situação comercial.", href: "/app/ocorrencias", Icon: FiActivity },
  { title: "Minhas metas", description: "Acompanhe seus objetivos comerciais.", href: "/app/metas", Icon: FiTarget },
] as const;

export default function SellerHome({ user }: { user: SessionUser }) {
  const firstName = user.name.trim().split(/\s+/)[0] || "Representante";
  return (
    <section className="mx-auto w-full max-w-5xl pb-10" aria-label="Início do representante">
      <header className="mb-7">
        <p className="text-xs font-semibold tracking-wide text-[#0767b4]">Seu espaço de trabalho</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#111111] sm:text-3xl">
          Olá, {firstName}!
        </h2>
        <p className="mt-2 text-sm text-[#607080]">O que você precisa fazer hoje?</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ title, description, href, Icon, featured }) => (
          <Link
            href={href}
            key={title}
            className={`group flex min-h-40 flex-col justify-between rounded-2xl border p-5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0767b4] hover:-translate-y-0.5 hover:shadow-md ${featured ? "border-[#c9e3f5] bg-[#f2f9fe]" : "border-[#e4ebf0] bg-white"}`}
          >
            <div className="flex items-start justify-between">
              <span className={`grid size-11 place-items-center rounded-xl ${featured ? "bg-[#dbeefb] text-[#0767b4]" : "bg-[#f2f5f8] text-[#53697f]"}`}>
                <Icon size={21} aria-hidden="true" />
              </span>
              <FiArrowUpRight className="text-[#8393a4] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={18} aria-hidden="true" />
            </div>
            <div className="mt-5">
              <h3 className="text-base font-bold text-[#111111]">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#617181]">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
