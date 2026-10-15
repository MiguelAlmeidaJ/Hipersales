"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

type RequestRow = {
  id: number;
  status: string;
  seller_name: string;
  created_at: string;
  legal_name: string;
  trade_name?: string;
  cnpj: string;
  state_registration?: string;
  municipal_registration?: string;
  address?: string;
  address_number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  delivery_address?: string;
  phone?: string;
  email?: string;
  notes?: string;
};
type Draft = Pick<RequestRow, "legal_name" | "cnpj"> & {
  trade_name: string;
  state_registration: string;
  municipal_registration: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  delivery_address: string;
  phone_1: string;
  purchase_email: string;
  delivery_warnings: string;
  status: "pendente" | "aprovada" | "recusada";
};
const initial = (r: RequestRow): Draft => ({
  legal_name: r.legal_name || "",
  trade_name: r.trade_name || "",
  cnpj: r.cnpj || "",
  state_registration: r.state_registration || "",
  municipal_registration: r.municipal_registration || "",
  address: r.address || "",
  address_number: r.address_number || "",
  neighborhood: r.neighborhood || "",
  city: r.city || "",
  state: r.state || "",
  zip_code: r.zip_code || "",
  delivery_address: r.delivery_address || "",
  phone_1: r.phone || "",
  purchase_email: r.email || "",
  delivery_warnings: r.notes || "",
  status: (["pendente", "aprovada", "recusada"].includes(r.status)
    ? r.status
    : "pendente") as Draft["status"],
});
const fields = [
  ["legal_name", "Razão social"],
  ["trade_name", "Nome fantasia"],
  ["cnpj", "CNPJ"],
  ["state_registration", "Inscrição estadual"],
  ["municipal_registration", "Inscrição municipal"],
  ["address", "Endereço"],
  ["address_number", "Número"],
  ["neighborhood", "Bairro"],
  ["city", "Município"],
  ["state", "UF"],
  ["zip_code", "CEP"],
  ["delivery_address", "Endereço de entrega"],
  ["phone_1", "Telefone"],
  ["purchase_email", "E-mail de compras"],
  ["delivery_warnings", "Observações"],
] as const;
export default function RegistrationApprovals() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("pendente");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function refresh() {
    const r = await api<{ requests: RequestRow[] }>("/api/admin/requests");
    setRequests(r.requests || []);
  }
  useEffect(() => {
    let active = true;
    api<{ requests: RequestRow[] }>("/api/admin/requests")
      .then((r) => {
        if (active) setRequests(r.requests || []);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Não foi possível consultar solicitações");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const visible = useMemo(
    () => requests.filter((r) => (filter === "todas" || r.status === filter) && [r.legal_name,r.trade_name,r.cnpj,r.seller_name,r.id].join(" ").toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))),
    [requests, filter, query],
  );
  function open(r: RequestRow) {
    setSelected(r.id);
    setDraft(initial(r));
    setError("");
    setNotice("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || selected === null) return;
    if (
      draft.status === "aprovada" &&
      !window.confirm(
        "Aprovar este cadastro? A API poderá criar ou atualizar o cliente e associá-lo ao representante.",
      )
    )
      return;
    if (draft.status === "recusada" && !window.confirm("Confirmar recusa desta solicitação?"))
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ message?: string }>(`/api/admin/requests/${selected}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      await refresh();
      setNotice(result.message || "Solicitação atualizada.");
      setDraft(null);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar solicitação");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Carregando solicitações…</p>;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-extrabold uppercase tracking-widest text-[#0767b4]">Análise de cadastros</p><p className="mt-1 text-sm text-slate-500">Confira os dados enviados pelos representantes antes da aprovação.</p></div>
        <span className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-[#0767b4]">{requests.length} solicitações recebidas</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {title:"Total",value:requests.length,filter:"todas",color:"text-slate-800",bg:"bg-slate-50"},
          {title:"Pendentes",value:requests.filter(r=>r.status==="pendente").length,filter:"pendente",color:"text-amber-700",bg:"bg-amber-50"},
          {title:"Aprovadas",value:requests.filter(r=>r.status==="aprovada").length,filter:"aprovada",color:"text-emerald-700",bg:"bg-emerald-50"},
          {title:"Recusadas",value:requests.filter(r=>r.status==="recusada").length,filter:"recusada",color:"text-rose-700",bg:"bg-rose-50"},
        ].map(card=><button type="button" key={card.title} onClick={()=>setFilter(card.filter)}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${filter===card.filter?"border-[#0767b4] ring-1 ring-[#0767b4]/20":"border-slate-200"} ${card.bg}`}>
          <span className={`block text-2xl font-extrabold ${card.color}`}>{card.value}</span>
          <span className="mt-1 block text-xs font-semibold text-slate-600">{card.title}</span>
        </button>)}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[220px] flex-1 gap-1.5 text-xs font-semibold text-slate-600">Buscar solicitação
            <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cliente, CNPJ, representante ou ID"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0767b4]" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Status
            <select value={filter} onChange={e=>setFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="pendente">Pendentes</option><option value="aprovada">Aprovadas</option>
              <option value="recusada">Recusadas</option><option value="todas">Todas</option>
            </select>
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-500">{visible.length} solicitação(ões) encontrada(s)</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              {["ID","Cliente","CNPJ","Representante","Status","Ação"].map(h=><th key={h} className="border-b border-slate-200 p-3 font-bold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.map(r=><tr key={r.id} className="transition hover:bg-[#f7fbff]">
                <td className="border-b border-slate-100 p-3 font-bold text-[#0767b4]">#{r.id}</td>
                <td className="border-b border-slate-100 p-3"><strong className="block text-slate-900">{r.legal_name}</strong>{r.trade_name && <span className="text-xs text-slate-500">{r.trade_name}</span>}</td>
                <td className="border-b border-slate-100 p-3 text-slate-600">{r.cnpj}</td>
                <td className="border-b border-slate-100 p-3">{r.seller_name}</td>
                <td className="border-b border-slate-100 p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status==="aprovada"?"bg-emerald-50 text-emerald-700":r.status==="recusada"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{r.status==="aprovada"?"Aprovada":r.status==="recusada"?"Recusada":"Pendente"}</span></td>
                <td className="border-b border-slate-100 p-3"><button type="button" onClick={()=>open(r)} className="rounded-xl border border-[#cde4f4] bg-[#f7fbff] px-3 py-2 text-xs font-bold text-[#0767b4] hover:bg-blue-50">{r.status==="pendente"?"Analisar":"Visualizar"}</button></td>
              </tr>)}
              {visible.length===0 && <tr><td colSpan={6} className="p-10 text-center"><p className="font-bold text-slate-700">Nenhuma solicitação encontrada</p><p className="mt-1 text-xs text-slate-500">Experimente outro filtro ou aguarde novos cadastros.</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {draft && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setDraft(null);setSelected(null);}}}><form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Analisar solicitação" className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Solicitação #{selected}</h3>
            <button
              type="button"
              className="rounded-lg border px-3 py-2"
              onClick={() => {
                setDraft(null);
                setSelected(null);
              }}
            >
              Fechar
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([key, title]) => (
              <label className="grid gap-1.5 text-sm" key={key}>
                {title}
                <input
                  required={key === "legal_name" || key === "cnpj"}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm">
              Decisão
              <select
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, status: e.target.value as Draft["status"] } : d))
                }
              >
                <option value="pendente">Pendente</option>
                <option value="aprovada">Aprovar</option>
                <option value="recusada">Recusar</option>
              </select>
            </label>
          </div>
          <button
            className="mt-5 rounded-lg bg-brand px-5 py-2.5 font-semibold text-white disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Salvando…" : "Confirmar decisão"}
          </button>
        </form></div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}
    </section>
  );
}
