"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiBriefcase, FiUser } from "react-icons/fi";
import { api } from "@/lib/api";
import { useAuthenticatedUser } from "@/components/auth/session-context";
import SellerAssignments from "./seller-assignments";

type Seller = { id: number; name: string; role: string };
export default function SellerPortfolioPage({ id }: { id: string }) {
  const user = useAuthenticatedUser();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user.role === "seller") { setLoading(false); return; }
    let mounted = true;
    api<{ users: Seller[] }>("/api/admin/users").then(result => {
      const selected = result.users.find(item => String(item.id) === id && item.role === "seller");
      if (mounted) {
        setSeller(selected ?? null);
        if (!selected) setError("Representante não encontrado.");
      }
    }).catch(reason => {
      if (mounted) setError(reason instanceof Error ? reason.message : "Não foi possível consultar o representante.");
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, user.role]);
  if (user.role === "seller") return <p role="alert" className="rounded-xl border bg-white p-6">Acesso não autorizado.</p>;
  return <section className="min-w-0 space-y-5">
    <Link href="/app/usuarios" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0767b4]"><FiArrowLeft/> Voltar para usuários</Link>
    <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e4ebf0] bg-white p-5 shadow-sm">
      <span className="grid size-12 place-items-center rounded-xl bg-[#e5f2fb] text-[#073c96]"><FiBriefcase size={22}/></span>
      <div><p className="text-xs font-bold uppercase tracking-wider text-[#0767b4]">Gestão comercial</p><h2 className="text-xl font-extrabold text-[#111111]">Carteira do representante</h2><p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><FiUser/>{seller?.name || "Carregando representante..."}</p></div>
    </header>
    {loading && <p role="status" className="rounded-xl bg-white p-6">Carregando representante…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
    {seller && <SellerAssignments sellerId={seller.id} sellerName={seller.name}/>}
  </section>;
}
