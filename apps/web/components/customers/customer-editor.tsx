"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

type Customer = {
  id: number;
  legal_name: string;
  trade_name?: string | null;
  cnpj: string;
  state_registration?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean | number;
  form_payload?: Record<string, unknown>;
};
const empty = {
  legal_name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  municipal_registration: "",
  address: "",
  address_number: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  delivery_address: "",
  delivery_warnings: "",
  phone: "",
  email: "",
  active: true,
};
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
  ["delivery_warnings", "Advertências de recebimento"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
] as const;

export default function CustomerEditor() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    const r = await api<{ customers: Customer[] }>("/api/admin/customers");
    setRows(r.customers || []);
  }
  useEffect(() => {
    let mounted = true;
    api<{ customers: Customer[] }>("/api/admin/customers")
      .then((r) => {
        if (mounted) setRows(r.customers || []);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : "Falha ao carregar clientes");
      });
    return () => {
      mounted = false;
    };
  }, []);
  const visible = useMemo(
    () =>
      rows.filter((c) => {
        const text = [c.legal_name, c.trade_name, c.cnpj, c.phone]
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        const active = c.active === 1 || c.active === true;
        return (
          text.includes(query.toLocaleLowerCase("pt-BR")) &&
          (filter === "all" || (filter === "active" ? active : !active))
        );
      }),
    [rows, query, filter],
  );
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const paged = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function reset() {
    setEditing(null);
    setForm({ ...empty });
  }
  function edit(c: Customer) {
    const payload = c.form_payload || {};
    const payloadText = (key: string) => String(payload[key] ?? "");
    setEditing(c.id);
    setForm({
      legal_name: c.legal_name || "",
      trade_name: c.trade_name || "",
      cnpj: c.cnpj || "",
      state_registration: c.state_registration || "",
      municipal_registration: payloadText("municipal_registration"),
      address: payloadText("address") || c.address || "",
      address_number: payloadText("address_number") || payloadText("number"),
      neighborhood: payloadText("neighborhood"),
      city: payloadText("city"),
      state: payloadText("state"),
      zip_code: payloadText("zip_code"),
      delivery_address: payloadText("delivery_address"),
      delivery_warnings: payloadText("delivery_warnings"),
      phone: c.phone || "",
      email: c.email || "",
      active: c.active === 1 || c.active === true,
    });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const path = editing === null ? "/api/admin/customers" : `/api/admin/customers/${editing}`;
      const result = await api<{ message?: string }>(path as `/api/${string}`, {
        method: editing === null ? "POST" : "PATCH",
        body: JSON.stringify(form),
      });
      await load();
      reset();
      setNotice(result.message || "Cliente salvo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o cliente");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="min-w-0 space-y-5">
      <div>
        <h2 className="text-xl font-extrabold">Clientes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie a carteira de clientes e seus dados cadastrais.
        </p>
      </div>
      <form
        className="editor-form rounded-2xl border border-[#e4ebf0] bg-white p-5"
        onSubmit={submit}
      >
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              required={key === "legal_name" || key === "cnpj"}
              type={key === "email" ? "email" : "text"}
              value={form[key]}
              onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))}
          />{" "}
          Ativo
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Salvando…" : editing === null ? "Cadastrar cliente" : "Salvar alterações"}
        </button>
        {editing !== null && (
          <button type="button" className="secondary" onClick={reset}>
            Cancelar edição
          </button>
        )}
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="grid gap-3 rounded-2xl border border-[#e4ebf0] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_180px_120px]">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Buscar cliente
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Nome, CNPJ ou telefone"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Situação
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Por página
          <select
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option value={n} key={n}>
                {n} por página
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">{visible.length} cliente(s) encontrado(s)</p>
      <div className="table-wrap rounded-2xl border border-[#e4ebf0] bg-white p-3 shadow-sm">
        <table>
          <thead>
            <tr>
              <th>Razão social</th>
              <th>CNPJ</th>
              <th>Telefone</th>
              <th>Situação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c) => (
              <tr key={c.id}>
                <td>{c.legal_name}</td>
                <td>{c.cnpj}</td>
                <td>{c.phone || "—"}</td>
                <td>{c.active ? "Ativo" : "Inativo"}</td>
                <td>
                  <button className="secondary" type="button" onClick={() => edit(c)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          Página {currentPage} de {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
      <p className="muted">
        Associações comerciais podem ser gerenciadas em Usuários → Carteira. Para clientes
        vinculados a pedidos, utilize a opção Inativo para preservar o histórico.
      </p>
      <a href="/legacy">Acessar funcionalidades ainda não migradas</a>
    </section>
  );
}
