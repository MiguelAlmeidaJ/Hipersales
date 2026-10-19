"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "@/components/auth/session-context";
import ProposalForm from "@/components/orders/proposal-form";
export default function NewProposalPage(){
  const user=useAuthenticatedUser(); const router=useRouter();
  return <main className="mx-auto w-full max-w-6xl space-y-5 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">Gestão de pedidos</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Nova proposta</h1><p className="text-sm text-slate-500">Preencha as condições negociadas e os produtos.</p></div><Link href="/app/pedidos" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Voltar aos pedidos</Link></div>
    <ProposalForm user={user} onCreated={()=>router.push("/app/pedidos")}/>
  </main>;
}
