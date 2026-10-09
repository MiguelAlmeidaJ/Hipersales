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
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
};
type Draft = Pick<RequestRow, "legal_name" | "cnpj"> & {
  trade_name: string;
  state_registration: string;
  address: string;
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
  address: r.address || "",
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
  ["address", "Endereço"],
  ["phone_1", "Telefone"],
  ["purchase_email", "E-mail de compras"],
  ["delivery_warnings", "Observações"],
] as const;
export default function RegistrationApprovals() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("pendente");
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
    () => requests.filter((r) => filter === "todas" || r.status === filter),
    [requests, filter],
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
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Solicitações de cadastro</h2>
            <p className="text-sm text-slate-500">
              Analise os dados enviados pelos representantes.
            </p>
          </div>
          <label className="grid gap-1 text-sm">
            Filtrar por status
            <select
              className="rounded-lg border border-slate-300 bg-white p-2.5"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="pendente">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="recusada">Recusadas</option>
              <option value="todas">Todas</option>
            </select>
          </label>
        </div>
        <p className="mb-3 text-sm text-slate-500">{visible.length} solicitação(ões)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["ID", "Cliente", "CNPJ", "Representante", "Status", "Ação"].map((h) => (
                  <th className="border-b border-slate-200 p-3" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="border-b p-3">{r.id}</td>
                  <td className="border-b p-3">{r.legal_name}</td>
                  <td className="border-b p-3">{r.cnpj}</td>
                  <td className="border-b p-3">{r.seller_name}</td>
                  <td className="border-b p-3">{r.status}</td>
                  <td className="border-b p-3">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-2 text-brand"
                      type="button"
                      onClick={() => open(r)}
                    >
                      Analisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {draft && (
        <form onSubmit={submit} className="rounded-xl border border-blue-200 bg-white p-5">
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
                  className="rounded-lg border border-slate-300 p-2.5"
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm">
              Decisão
              <select
                className="rounded-lg border border-slate-300 bg-white p-2.5"
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
        </form>
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
