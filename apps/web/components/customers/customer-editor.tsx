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
};
const empty = {
  legal_name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  address: "",
  phone: "",
  email: "",
  active: true,
};
const fields = [
  ["legal_name", "Razão social"],
  ["trade_name", "Nome fantasia"],
  ["cnpj", "CNPJ"],
  ["state_registration", "Inscrição estadual"],
  ["address", "Endereço"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
] as const;

export default function CustomerEditor() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
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
  function reset() {
    setEditing(null);
    setForm({ ...empty });
  }
  function edit(c: Customer) {
    setEditing(c.id);
    setForm({
      legal_name: c.legal_name || "",
      trade_name: c.trade_name || "",
      cnpj: c.cnpj || "",
      state_registration: c.state_registration || "",
      address: c.address || "",
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
    <section className="tile">
      <h2>Clientes</h2>
      <p className="muted">Cadastro e edição utilizando as mesmas regras da API atual.</p>
      <form className="editor-form" onSubmit={submit}>
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
      <div className="editor-form">
        <label>
          Buscar cliente
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, CNPJ ou telefone"
          />
        </label>
        <label>
          Situação
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
      </div>
      <p className="muted">{visible.length} cliente(s) encontrado(s)</p>
      <div className="table-wrap">
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
            {visible.map((c) => (
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
      <p className="muted">
        Associações comerciais podem ser gerenciadas em Usuários → Carteira. Para clientes
        vinculados a pedidos, utilize a opção Inativo para preservar o histórico.
      </p>
      <a href="/legacy">Acessar funcionalidades ainda não migradas</a>
    </section>
  );
}
