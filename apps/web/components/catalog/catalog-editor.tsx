"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, downloadApiFile } from "@/lib/api";

type Item = {
  id: number;
  name: string;
  legal_name?: string;
  trade_name?: string;
  cnpj?: string;
  state_registration?: string;
  tax_regime?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  district?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  lead_time_days?: number;
  active?: number | boolean;
  company_id?: number;
  company_name?: string;
  code?: string;
  product_group?: string | null;
  subgroup?: string | null;
  unit?: string;
  brand?: string | null;
  minimum_sale_quantity?: number;
  weight?: number;
  ncm?: string | null;
  ipi_percent?: number;
  has_st?: number | boolean;
  invoice_origin?: string | null;
  price?: number;
  average_practiced_price?: number;
  total_sold_quantity?: number;
  total_sales_revenue?: number;
};

type Kind = "companies" | "products";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const numberPt = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value || 0);

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-[#0767b4]/10";

const emptyForm = {
  name: "",
  legal_name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  tax_regime: "",
  address: "",
  address_number: "",
  address_complement: "",
  district: "",
  city: "",
  state: "",
  postal_code: "",
  phone: "",
  email: "",
  website: "",
  lead_time_days: "0",
  company_id: "",
  code: "",
  product_group: "",
  subgroup: "",
  unit: "UN",
  brand: "",
  minimum_sale_quantity: "0",
  weight: "0",
  ncm: "",
  ipi_percent: "0",
  has_st: false,
  invoice_origin: "",
  price: "0",
  active: true,
};

export function CatalogEditor({ kind }: { kind: Kind }) {
  const [records, setRecords] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<Item[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<Item | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
        `Excluir o produto "${item.name}"? Produtos que já possuem histórico de pedidos não podem ser excluídos; nesse caso, inative o cadastro.`,
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
    setEditingRecord(null);
    setModalOpen(false);
    setForm(emptyForm);
  }

  function openNew() {
    setEditing(null);
    setEditingRecord(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function edit(item: Item) {
    setEditing(item.id);
    setEditingRecord(item);
    setModalOpen(true);
    setError("");
    setNotice("");
    setForm({
      name: item.name,
      legal_name: item.legal_name || "",
      trade_name: item.trade_name || "",
      cnpj: item.cnpj || "",
      state_registration: item.state_registration || "",
      tax_regime: item.tax_regime || "",
      address: item.address || "",
      address_number: item.address_number || "",
      address_complement: item.address_complement || "",
      district: item.district || "",
      city: item.city || "",
      state: item.state || "",
      postal_code: item.postal_code || "",
      phone: item.phone || "",
      email: item.email || "",
      website: item.website || "",
      lead_time_days: String(item.lead_time_days ?? 0),
      company_id: String(item.company_id ?? ""),
      code: item.code || "",
      product_group: item.product_group || "",
      subgroup: item.subgroup || "",
      unit: item.unit || "UN",
      brand: item.brand || "",
      minimum_sale_quantity: String(item.minimum_sale_quantity ?? 0),
      weight: String(item.weight ?? 0),
      ncm: item.ncm || "",
      ipi_percent: String(item.ipi_percent ?? 0),
      has_st: item.has_st === true || item.has_st === 1,
      invoice_origin: item.invoice_origin || "",
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
          ? { name: form.name, legal_name: form.legal_name, trade_name: form.trade_name, cnpj: form.cnpj, state_registration: form.state_registration, tax_regime: form.tax_regime, address: form.address, address_number: form.address_number, address_complement: form.address_complement, district: form.district, city: form.city, state: form.state, postal_code: form.postal_code, phone: form.phone, email: form.email, website: form.website, lead_time_days: Number(form.lead_time_days || 0), active: form.active }
          : {
              name: form.name,
              company_id: Number(form.company_id),
              code: form.code,
              product_group: form.product_group || null,
              subgroup: form.subgroup || null,
              unit: form.unit,
              brand: form.brand || null,
              minimum_sale_quantity: Number(form.minimum_sale_quantity || 0),
              weight: Number(form.weight || 0),
              ncm: form.ncm || null,
              ipi_percent: Number(form.ipi_percent || 0),
              has_st: form.has_st,
              invoice_origin: form.invoice_origin || null,
              price: Number(form.price || 0),
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

  const filtered = records.filter((item) => {
    const searchable = [
      item.name,
      item.legal_name,
      item.code,
      item.product_group,
      item.subgroup,
      item.brand,
      item.ncm,
      item.id,
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    const active = item.active === true || item.active === 1;
    return (
      searchable.includes(query.trim().toLocaleLowerCase("pt-BR")) &&
      (stateFilter === "all" || (stateFilter === "active" ? active : !active)) &&
      (kind !== "products" || !companyFilter || String(item.company_id) === companyFilter)
    );
  });

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const historicalAverage = Number(editingRecord?.average_practiced_price || 0);
  const historicalQuantity = Number(editingRecord?.total_sold_quantity || 0);
  const historicalRevenue = Number(editingRecord?.total_sales_revenue || 0);

  return (
    <section className="min-w-0 space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">
          {kind === "companies" ? "Empresas" : "Produtos"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {kind === "products"
            ? "Cadastro comercial completo dos produtos. Inclusão, alteração e exclusão são restritas à administração."
            : "Gerencie o catálogo, consulte registros e filtre por situação."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">Catálogo</p>
          <p className="text-sm text-slate-500">{records.length} registros cadastrados</p>
        </div>
        {kind === "companies" ? <Link href="/app/empresas/nova" className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white">+ Nova empresa</Link> : <button type="button" className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white" onClick={openNew}>+ Novo produto</button>}

      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) reset();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={kind === "products" ? "Cadastro de produto" : "Cadastro de empresa"}
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {editing !== null ? "Editar" : "Cadastrar"}{" "}
                  {kind === "products" ? "produto" : "empresa"}
                </h3>
                <p className="text-sm text-slate-500">
                  {kind === "products"
                    ? "Preencha os dados comerciais, fiscais e logísticos do produto."
                    : "Preencha os dados do cadastro."}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[78dvh] overflow-y-auto p-5">
              <form onSubmit={submit} className="space-y-6">
                {kind === "companies" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Nome
                      <input
                        className={fieldClass}
                        required
                        value={form.name}
                        onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Razão social
                      <input
                        className={fieldClass}
                        value={form.legal_name}
                        onChange={(e) => setForm((x) => ({ ...x, legal_name: e.target.value }))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Nome fantasia
                      <input className={fieldClass} value={form.trade_name} onChange={e=>setForm(x=>({...x,trade_name:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      CNPJ
                      <input className={fieldClass} value={form.cnpj} onChange={e=>setForm(x=>({...x,cnpj:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Inscrição estadual
                      <input className={fieldClass} value={form.state_registration} onChange={e=>setForm(x=>({...x,state_registration:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Regime fiscal
                      <input className={fieldClass} value={form.tax_regime} onChange={e=>setForm(x=>({...x,tax_regime:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Endereço
                      <input className={fieldClass} value={form.address} onChange={e=>setForm(x=>({...x,address:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Número
                      <input className={fieldClass} value={form.address_number} onChange={e=>setForm(x=>({...x,address_number:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Complemento
                      <input className={fieldClass} value={form.address_complement} onChange={e=>setForm(x=>({...x,address_complement:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Bairro
                      <input className={fieldClass} value={form.district} onChange={e=>setForm(x=>({...x,district:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Município
                      <input className={fieldClass} value={form.city} onChange={e=>setForm(x=>({...x,city:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      UF
                      <input className={fieldClass} value={form.state} onChange={e=>setForm(x=>({...x,state:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      CEP
                      <input className={fieldClass} value={form.postal_code} onChange={e=>setForm(x=>({...x,postal_code:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Telefone
                      <input className={fieldClass} value={form.phone} onChange={e=>setForm(x=>({...x,phone:e.target.value}))} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      E-mail
                      <input className={fieldClass} value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))} type="email"/>
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Site
                      <input className={fieldClass} value={form.website} onChange={e=>setForm(x=>({...x,website:e.target.value}))} type="text"/>
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                      Lead time (dias)
                      <input type="number" min={0} max={3650} step={1} className={fieldClass} value={form.lead_time_days} onChange={e=>setForm(x=>({...x,lead_time_days:e.target.value}))}/>
                    </label>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Identificação
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600 xl:col-span-2">
                          Empresa
                          <select
                            className={fieldClass}
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
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Código
                          <input
                            className={fieldClass}
                            required
                            value={form.code}
                            onChange={(e) => setForm((x) => ({ ...x, code: e.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Status do produto
                          <select
                            className={fieldClass}
                            value={form.active ? "1" : "0"}
                            onChange={(e) =>
                              setForm((x) => ({ ...x, active: e.target.value === "1" }))
                            }
                          >
                            <option value="1">Ativo</option>
                            <option value="0">Inativo</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Grupo
                          <input
                            className={fieldClass}
                            value={form.product_group}
                            onChange={(e) =>
                              setForm((x) => ({ ...x, product_group: e.target.value }))
                            }
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Subgrupo
                          <input
                            className={fieldClass}
                            value={form.subgroup}
                            onChange={(e) => setForm((x) => ({ ...x, subgroup: e.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600 md:col-span-2">
                          Descrição do produto
                          <input
                            className={fieldClass}
                            required
                            value={form.name}
                            onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Comercial e logística
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Unidade de medida
                          <input
                            className={fieldClass}
                            value={form.unit}
                            onChange={(e) => setForm((x) => ({ ...x, unit: e.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Marca
                          <input
                            className={fieldClass}
                            value={form.brand}
                            onChange={(e) => setForm((x) => ({ ...x, brand: e.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Qtd. mínima de venda
                          <input
                            className={fieldClass}
                            type="number"
                            min="0"
                            step="0.0001"
                            value={form.minimum_sale_quantity}
                            onChange={(e) =>
                              setForm((x) => ({ ...x, minimum_sale_quantity: e.target.value }))
                            }
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Peso do produto
                          <input
                            className={fieldClass}
                            type="number"
                            min="0"
                            step="0.0001"
                            value={form.weight}
                            onChange={(e) => setForm((x) => ({ ...x, weight: e.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Preço sugerido
                          <input
                            className={fieldClass}
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.price}
                            onChange={(e) => setForm((x) => ({ ...x, price: e.target.value }))}
                          />
                          <span className="font-normal text-slate-400">
                            Valor inicial sugerido ao criar um pedido.
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Fiscal
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          NCM
                          <input
                            className={fieldClass}
                            value={form.ncm}
                            onChange={(e) => setForm((x) => ({ ...x, ncm: e.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          IPI (%)
                          <input
                            className={fieldClass}
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.ipi_percent}
                            onChange={(e) =>
                              setForm((x) => ({ ...x, ipi_percent: e.target.value }))
                            }
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Tem ST?
                          <select
                            className={fieldClass}
                            value={form.has_st ? "1" : "0"}
                            onChange={(e) =>
                              setForm((x) => ({ ...x, has_st: e.target.value === "1" }))
                            }
                          >
                            <option value="0">Não</option>
                            <option value="1">Sim</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                          Origem NF
                          <input
                            className={fieldClass}
                            value={form.invoice_origin}
                            onChange={(e) =>
                              setForm((x) => ({ ...x, invoice_origin: e.target.value }))
                            }
                            placeholder="Ex.: MG"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#d9e8f4] bg-[#f6fbff] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-wider text-[#0767b4]">
                            Preço médio praticado
                          </p>
                          <p className="mt-1 text-2xl font-extrabold text-slate-900">
                            {editingRecord
                              ? money(historicalAverage)
                              : "Será calculado pelo histórico"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Calculado automaticamente: faturamento histórico do produto ÷ quantidade
                            histórica vendida.
                          </p>
                          {editingRecord && historicalQuantity > 0 && (
                            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                              {money(historicalRevenue)} ÷ {numberPt(historicalQuantity)} ={" "}
                              {money(historicalAverage)}
                            </p>
                          )}
                        </div>
                        {editingRecord && (
                          <div className="grid grid-cols-2 gap-3 text-right text-xs">
                            <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                              <span className="block text-slate-400">Qtd. histórica</span>
                              <strong className="text-slate-800">
                                {numberPt(historicalQuantity)}
                              </strong>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                              <span className="block text-slate-400">Faturamento</span>
                              <strong className="text-slate-800">{money(historicalRevenue)}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {kind === "companies" && (
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((x) => ({ ...x, active: e.target.checked }))}
                    />
                    Ativo
                  </label>
                )}

                {error && (
                  <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    onClick={reset}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Salvando…" : editing !== null ? "Salvar alterações" : "Cadastrar"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {error && !modalOpen && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}

      <div className="grid min-w-0 gap-3 rounded-2xl border border-[#e4ebf0] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
          Buscar
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={
              kind === "companies"
                ? "Nome ou razão social"
                : "Descrição, código, grupo, marca ou NCM"
            }
            className="w-full min-w-0 rounded-lg border border-slate-200 p-2.5 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Situação
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
        {kind === "products" && (
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Empresa
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
            >
              <option value="">Todas as empresas</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Por página
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap rounded-2xl border border-[#e4ebf0] bg-white p-3 shadow-sm">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{kind === "products" ? "Produto" : "Nome"}</th>
              {kind === "products" && (
                <>
                  <th>Código</th>
                  <th>Grupo</th>
                  <th>Unidade</th>
                  <th>Preço médio</th>
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
                <td>
                  <span className="font-semibold text-slate-900">{x.name}</span>
                  {kind === "products" && (
                    <span className="block text-xs text-slate-500">
                      {x.company_name || companies.find((c) => c.id === x.company_id)?.name || ""}
                      {x.brand ? ` · ${x.brand}` : ""}
                    </span>
                  )}
                </td>
                {kind === "products" && (
                  <>
                    <td>{x.code}</td>
                    <td>
                      {x.product_group || "—"}
                      {x.subgroup && (
                        <span className="block text-xs text-slate-400">{x.subgroup}</span>
                      )}
                    </td>
                    <td>{x.unit || "UN"}</td>
                    <td>
                      <span className="font-semibold text-slate-900">
                        {money(Number(x.average_practiced_price || 0))}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {numberPt(Number(x.total_sold_quantity || 0))} vendidos
                      </span>
                    </td>
                  </>
                )}
                <td>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      x.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {x.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {kind==="companies" ? <Link href={`/app/empresas/${x.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Editar</Link> : <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={()=>edit(x)}>Editar</button>}

                    {kind === "companies" && (
                      <button type="button" className="rounded-lg border border-[#0767b4] px-3 py-1.5 text-xs font-semibold text-[#0767b4]" onClick={()=>void downloadApiFile(`/api/admin/companies/${x.id}/pdf`,`ficha-empresa-${x.id}.pdf`).catch(e=>setError(e instanceof Error?e.message:"Não foi possível gerar a ficha."))}>
                        Ficha PDF
                      </button>
                    )}
                    {kind === "products" && (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        onClick={() => void removeProduct(x)}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td
                  colSpan={kind === "products" ? 8 : 4}
                  className="p-8 text-center text-sm text-slate-500"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {filtered.length} registro(s) · Página {currentPage} de {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
