"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

type Item = {
  id: number;
  name: string;
  legal_name?: string;
  active?: number | boolean;
  company_id?: number;
  code?: string;
  unit?: string;
  price?: number;
};
type Kind = "companies" | "products";

export function CatalogEditor({ kind }: { kind: Kind }) {
  const [records, setRecords] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<Item[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    company_id: "",
    code: "",
    unit: "UN",
    price: "0",
    active: true,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const endpoint = kind === "companies" ? "/api/admin/companies" : "/api/admin/products";
  async function reload() {
    const data = await api<{ companies?: Item[]; products?: Item[] }>(endpoint);
    setRecords(data[kind] || []);
    if (kind === "products") {
      const c = await api<{ companies: Item[] }>("/api/admin/companies");
      setCompanies(c.companies || []);
    }
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api<{ companies?: Item[]; products?: Item[] }>(endpoint);
        if (active) setRecords(data[kind] || []);
        if (kind === "products") {
          const c = await api<{ companies: Item[] }>("/api/admin/companies");
          if (active) setCompanies(c.companies || []);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Falha ao carregar");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [endpoint, kind]);
  async function removeProduct(item: Item) {
    if (
      kind !== "products" ||
      !window.confirm(
        `Excluir o produto "${item.name}"? A API impedirá a exclusão se houver pedidos vinculados.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ message?: string }>(`/api/admin/products/${item.id}`, {
        method: "DELETE",
      });
      await reload();
      if (editing === item.id) reset();
      setNotice(result.message || "Produto excluído.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir o produto");
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setEditing(null);
    setForm({
      name: "",
      legal_name: "",
      company_id: "",
      code: "",
      unit: "UN",
      price: "0",
      active: true,
    });
  }
  function edit(item: Item) {
    setEditing(item.id);
    setForm({
      name: item.name,
      legal_name: item.legal_name || "",
      company_id: String(item.company_id ?? ""),
      code: item.code || "",
      unit: item.unit || "UN",
      price: String(item.price ?? 0),
      active: item.active === true || item.active === 1,
    });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload =
        kind === "companies"
          ? { name: form.name, legal_name: form.legal_name, active: form.active }
          : {
              name: form.name,
              company_id: Number(form.company_id),
              code: form.code,
              unit: form.unit,
              price: Number(form.price),
              active: form.active,
            };
      if (kind === "products" && !form.company_id) throw new Error("Selecione a empresa.");
      await api(`${endpoint}${editing === null ? "" : "/" + editing}` as `/api/${string}`, {
        method: editing === null ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      await reload();
      reset();
      setNotice("Dados salvos com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }
  const filtered = records.filter(item => {
    const searchable = [item.name, item.legal_name, item.code, item.id].join(" ").toLocaleLowerCase("pt-BR");
    const active = item.active === true || item.active === 1;
    return searchable.includes(query.trim().toLocaleLowerCase("pt-BR")) &&
      (stateFilter === "all" || (stateFilter === "active" ? active : !active)) &&
      (kind !== "products" || !companyFilter || String(item.company_id) === companyFilter);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <section className="min-w-0 space-y-5">
      <div><h2 className="text-xl font-extrabold text-slate-900">{kind === "companies" ? "Empresas" : "Produtos"}</h2><p className="mt-1 text-sm text-slate-500">Gerencie o catálogo, consulte registros e filtre por situação.</p></div>
      <form onSubmit={submit} className="editor-form rounded-2xl border border-[#e4ebf0] bg-white p-5 shadow-sm">
        <label>
          Nome
          <input
            required
            value={form.name}
            onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
          />
        </label>
        {kind === "companies" ? (
          <label>
            Razão social
            <input
              value={form.legal_name}
              onChange={(e) => setForm((x) => ({ ...x, legal_name: e.target.value }))}
            />
          </label>
        ) : (
          <>
            <label>
              Empresa
              <select
                required
                value={form.company_id}
                onChange={(e) => setForm((x) => ({ ...x, company_id: e.target.value }))}
              >
                <option value="">Selecione</option>
                {companies.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Código
              <input
                required
                value={form.code}
                onChange={(e) => setForm((x) => ({ ...x, code: e.target.value }))}
              />
            </label>
            <label>
              Unidade
              <input
                value={form.unit}
                onChange={(e) => setForm((x) => ({ ...x, unit: e.target.value }))}
              />
            </label>
            <label>
              Preço
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.price}
                onChange={(e) => setForm((x) => ({ ...x, price: e.target.value }))}
              />
            </label>
          </>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((x) => ({ ...x, active: e.target.checked }))}
          />{" "}
          Ativo
        </label>
        <button className="primary" disabled={busy} type="submit">
          {busy ? "Salvando…" : editing !== null ? "Salvar alterações" : "Cadastrar"}
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
      <div className="grid min-w-0 gap-3 rounded-2xl border border-[#e4ebf0] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">Buscar
          <input type="search" value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} placeholder={kind === "companies" ? "Nome ou razão social" : "Nome, código ou ID"} className="w-full min-w-0 rounded-lg border border-slate-200 p-2.5 text-sm"/>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Situação
          <select value={stateFilter} onChange={e => {setStateFilter(e.target.value);setPage(1);}} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select>
        </label>
        {kind === "products" && <label className="grid gap-1 text-xs font-semibold text-slate-600">Empresa
          <select value={companyFilter} onChange={e => {setCompanyFilter(e.target.value);setPage(1);}} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"><option value="">Todas as empresas</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
        </label>}
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Por página
          <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value));setPage(1);}} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm">{[10,20,50,100].map(n => <option key={n} value={n}>{n} por página</option>)}</select>
        </label>
      </div>
      <div className="table-wrap rounded-2xl border border-[#e4ebf0] bg-white p-3 shadow-sm">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              {kind === "products" && (
                <>
                  <th>Código</th>
                  <th>Preço</th>
                </>
              )}
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((x) => (
              <tr key={x.id}>
                <td>{x.id}</td>
                <td>{x.name}</td>
                {kind === "products" && (
                  <>
                    <td>{x.code}</td>
                    <td>{x.price}</td>
                  </>
                )}
                <td>{x.active ? "Ativo" : "Inativo"}</td>
                <td>
                  <button type="button" className="secondary" onClick={() => edit(x)}>
                    Editar
                  </button>
                  {kind === "products" && (
                    <button
                      type="button"
                      disabled={busy}
                      className="ml-3 text-red-700"
                      onClick={() => void removeProduct(x)}
                    >
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={kind === "products" ? 6 : 4} className="p-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{filtered.length} registro(s) · Página {currentPage} de {pages}</span><div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div>
    </section>
  );
}
