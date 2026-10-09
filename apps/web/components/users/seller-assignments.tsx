"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type AssignedItem = {
  id: number;
  name?: string;
  legal_name?: string;
  cnpj?: string;
  active?: number | boolean;
  assigned: boolean;
};
type Kind = "customers" | "companies";
const labels: { [K in Kind]: string } = { customers: "Clientes", companies: "Empresas" };
export default function SellerAssignments({
  sellerId,
  sellerName,
}: {
  sellerId: number;
  sellerName: string;
}) {
  const [kind, setKind] = useState<Kind>("customers");
  const [items, setItems] = useState<AssignedItem[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ q: query, active });
    api<Record<Kind, AssignedItem[]>>(`/api/admin/users/${sellerId}/${kind}?${qs.toString()}`)
      .then((r) => {
        if (mounted) setItems(r[kind] || []);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : "Falha ao buscar associações");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [sellerId, kind, query, active, revision]);
  const linked = useMemo(() => items.filter((x) => x.assigned).length, [items]);
  async function toggle(item: AssignedItem) {
    const target = !item.assigned;
    if (
      !target &&
      !window.confirm(`Desvincular ${item.name || item.legal_name || item.id} deste representante?`)
    )
      return;
    setSaving(item.id);
    setError("");
    setNotice("");
    try {
      const path =
        kind === "customers" ? "/api/admin/customer-assignments" : "/api/admin/company-assignments";
      const payload = {
        seller_id: sellerId,
        [kind === "customers" ? "customer_id" : "company_id"]: item.id,
        assigned: target,
      };
      const result = await api<{ message?: string }>(path, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setItems((v) => v.map((x) => (x.id === item.id ? { ...x, assigned: target } : x)));
      setNotice(result.message || "Associação atualizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a associação");
    } finally {
      setSaving(null);
    }
  }
  return (
    <section
      className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4"
      aria-label="Associações comerciais"
    >
      <div>
        <h3 className="text-lg font-semibold">Carteira de {sellerName}</h3>
        <p className="text-sm text-slate-500">
          Atribuições controlam os clientes e indústrias disponíveis ao representante nos pedidos.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["customers", "companies"] as const).map((k) => (
          <button
            type="button"
            key={k}
            className={
              kind === k
                ? "rounded-lg bg-brand px-4 py-2 text-white"
                : "rounded-lg border bg-white px-4 py-2"
            }
            onClick={() => {
              setKind(k);
              setQuery("");
              setActive("all");
            }}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Buscar
          <input
            type="search"
            className="rounded-lg border bg-white p-2.5"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou CNPJ"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Situação
          <select
            className="rounded-lg border bg-white p-2.5"
            value={active}
            onChange={(e) => setActive(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-green-700">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando vínculos…</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {linked} associado(s) nesta consulta · {items.length} resultado(s){" "}
            <button
              type="button"
              className="ml-2 text-brand underline"
              onClick={() => setRevision((v) => v + 1)}
            >
              Atualizar
            </button>
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3">Vínculo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      {item.legal_name || item.name || "—"}
                      {item.cnpj && (
                        <span className="block text-xs text-slate-500">{item.cnpj}</span>
                      )}
                    </td>
                    <td className="p-3">{item.active ? "Ativo" : "Inativo"}</td>
                    <td className="p-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={saving !== null}
                          checked={Boolean(item.assigned)}
                          onChange={() => void toggle(item)}
                        />
                        <span>{item.assigned ? "Associado" : "Não associado"}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
