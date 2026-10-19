"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, downloadApiFile } from "@/lib/api";

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
  status?: string;
  seller_ids?: number[];
  seller_names?: string | null;
  form_payload?: Record<string, unknown>;
};
type Seller = { id: number; name: string; email: string; role: string; active: boolean };
type Form = {
  status: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  state_registration: string;
  municipal_registration: string;
  tax_regime: string;
  business_sector: string;
  network: string;
  economic_group: string;
  tax_benefit: string;
  tax_benefit_description: string;
  address: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  service_region: string;
  delivery_address: string;
  delivery_warnings: string;
  buyer_contact: string;
  buyer_phone_1: string;
  buyer_phone_2: string;
  buyer_email: string;
  finance_contact: string;
  finance_phone_1: string;
  finance_phone_2: string;
  finance_email: string;
  logistics_contact: string;
  logistics_phone: string;
  scheduling_phone: string;
  xml_email: string;
  additional_notes: string;
  seller_ids: number[];
};
const empty: Form = {
  status: "ativo",
  legal_name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  municipal_registration: "",
  tax_regime: "",
  business_sector: "",
  network: "nao",
  economic_group: "",
  tax_benefit: "nao",
  tax_benefit_description: "",
  address: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  service_region: "",
  delivery_address: "",
  delivery_warnings: "",
  buyer_contact: "",
  buyer_phone_1: "",
  buyer_phone_2: "",
  buyer_email: "",
  finance_contact: "",
  finance_phone_1: "",
  finance_phone_2: "",
  finance_email: "",
  logistics_contact: "",
  logistics_phone: "",
  scheduling_phone: "",
  xml_email: "",
  additional_notes: "",
  seller_ids: [],
};
const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-[#0767b4]/10";
const value = (payload: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const result = String(payload[key] ?? "").trim();
    if (result) return result;
  }
  return "";
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-xs font-extrabold uppercase tracking-wider text-[#0767b4]">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </fieldset>
  );
}
function Field({
  label,
  name,
  form,
  setForm,
  required = false,
  type = "text",
  wide = false,
}: {
  label: string;
  name: keyof Form;
  form: Form;
  setForm: (updater: (current: Form) => Form) => void;
  required?: boolean;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label
      className={`grid gap-1.5 text-xs font-semibold text-slate-600 ${wide ? "md:col-span-2 xl:col-span-4" : ""}`}
    >
      {label}
      <input
        className={fieldClass}
        required={required}
        type={type}
        value={String(form[name])}
        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
}
function SelectField({
  label,
  name,
  form,
  setForm,
  children,
}: {
  label: string;
  name: keyof Form;
  form: Form;
  setForm: (updater: (current: Form) => Form) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      <select
        className={fieldClass}
        value={String(form[name])}
        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
      >
        {children}
      </select>
    </label>
  );
}

export default function CustomerEditor({ standalone = false, customerId }: { standalone?: boolean; customerId?: number }) {
  const router=useRouter();
  const [rows, setRows] = useState<Customer[]>([]),
    [sellers, setSellers] = useState<Seller[]>([]),
    [form, setForm] = useState<Form>({ ...empty }),
    [editing, setEditing] = useState<number | null>(null),
    [modalOpen, setModalOpen] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(20),
    [busy, setBusy] = useState(false),
    [lookupBusy, setLookupBusy] = useState(false),
    [downloadBusy, setDownloadBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    const [customers, users] = await Promise.all([
      api<{ customers: Customer[] }>("/api/admin/customers"),
      api<{ users: Seller[] }>("/api/admin/users"),
    ]);
    setRows(customers.customers || []);
    setSellers((users.users || []).filter((user) => user.role === "seller" && user.active));
  }
  useEffect(() => {
    let active = true;
    void Promise.all([
      api<{ customers: Customer[] }>("/api/admin/customers"),
      api<{ users: Seller[] }>("/api/admin/users"),
    ])
      .then(([customers, users]) => {
        if (active) {
          setRows(customers.customers || []);
          setSellers((users.users || []).filter((user) => user.role === "seller" && user.active));
          if(standalone){
            const existing=customers.customers.find(item=>item.id===customerId);
            if(customerId && !existing){setError("Cliente não encontrado.");return;}
            if(existing)edit(existing);
            else openNew();
          }
        }
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Falha ao carregar clientes.");
      });
    return () => {
      active = false;
    };
  }, [standalone,customerId]);
  const visible = useMemo(
    () =>
      rows.filter((customer) => {
        const search = [
          customer.id,
          customer.legal_name,
          customer.trade_name,
          customer.cnpj,
          customer.seller_names,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        const status = customer.status || (customer.active ? "ativo" : "inativo");
        return (
          search.includes(query.trim().toLocaleLowerCase("pt-BR")) &&
          (filter === "all" || status === filter)
        );
      }),
    [rows, query, filter],
  );
  const pages = Math.max(1, Math.ceil(visible.length / pageSize)),
    currentPage = Math.min(page, pages),
    paged = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    editingCustomer = editing ? rows.find((customer) => customer.id === editing) : undefined;
  function reset() {
    setEditing(null);
    setForm({ ...empty, seller_ids: [] });
    setModalOpen(false);
    setError("");
    if(standalone)router.push("/app/clientes");
  }
  function openNew() {
    reset();
    setNotice("");
    setModalOpen(true);
  }
  function edit(customer: Customer) {
    const payload = customer.form_payload || {};
    setEditing(customer.id);
    setError("");
    setNotice("");
    setForm({
      status: customer.status || (customer.active ? "ativo" : "inativo"),
      legal_name: customer.legal_name || "",
      trade_name: customer.trade_name || "",
      cnpj: customer.cnpj || "",
      state_registration: customer.state_registration || "",
      municipal_registration: value(payload, "municipal_registration"),
      tax_regime: value(payload, "tax_regime"),
      business_sector: value(payload, "business_sector", "main_activity"),
      network: value(payload, "network") || "nao",
      economic_group: value(payload, "economic_group"),
      tax_benefit: value(payload, "tax_benefit") || "nao",
      tax_benefit_description: value(payload, "tax_benefit_description"),
      address: value(payload, "address", "street") || customer.address || "",
      address_number: value(payload, "address_number", "number"),
      complement: value(payload, "complement"),
      neighborhood: value(payload, "neighborhood"),
      city: value(payload, "city"),
      state: value(payload, "state"),
      zip_code: value(payload, "zip_code"),
      service_region: value(payload, "service_region"),
      delivery_address: value(payload, "delivery_address"),
      delivery_warnings: value(payload, "delivery_warnings"),
      buyer_contact: value(payload, "buyer_contact", "contact_person"),
      buyer_phone_1: value(payload, "buyer_phone_1", "phone_1") || customer.phone || "",
      buyer_phone_2: value(payload, "buyer_phone_2", "phone_2"),
      buyer_email: value(payload, "buyer_email", "purchase_email") || customer.email || "",
      finance_contact: value(payload, "finance_contact"),
      finance_phone_1: value(payload, "finance_phone_1"),
      finance_phone_2: value(payload, "finance_phone_2"),
      finance_email: value(payload, "finance_email", "billing_email"),
      logistics_contact: value(payload, "logistics_contact"),
      logistics_phone: value(payload, "logistics_phone"),
      scheduling_phone: value(payload, "scheduling_phone"),
      xml_email: value(payload, "xml_email"),
      additional_notes: value(payload, "additional_notes", "notes"),
      seller_ids: customer.seller_ids || [],
    });
    setModalOpen(true);
  }
  async function lookupCnpj() {
    setLookupBusy(true);
    setError("");
    try {
      const suffix = editing ? `&exclude_customer_id=${editing}` : "";
      const data = await api<Record<string, unknown>>(
        `/api/integrations/cnpj?cnpj=${encodeURIComponent(form.cnpj)}${suffix}` as `/api/${string}`,
      );
      setForm((current) => ({
        ...current,
        cnpj: String(data.cnpj || current.cnpj),
        legal_name: String(data.legal_name || current.legal_name),
        trade_name: String(data.trade_name || current.trade_name),
        state_registration: String(data.state_registration || current.state_registration),
        address: String(data.street || data.address_line || current.address),
        address_number: String(data.number || current.address_number),
        neighborhood: String(data.neighborhood || current.neighborhood),
        city: String(data.city || current.city),
        state: String(data.state || current.state),
        zip_code: String(data.zip_code || current.zip_code),
        business_sector: String(data.main_activity || current.business_sector),
        tax_regime: String(data.simples || "")
          .toLowerCase()
          .includes("sim")
          ? "Simples Nacional"
          : current.tax_regime,
        buyer_phone_1: String(data.phone || current.buyer_phone_1),
        buyer_email: String(data.email || current.buyer_email),
      }));
      setNotice("CNPJ consultado e dados preenchidos.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar CNPJ.");
    } finally {
      setLookupBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const path = editing === null ? "/api/admin/customers" : `/api/admin/customers/${editing}`;
      const result = await api<{ message?: string }>(path as `/api/${string}`, {
        method: editing === null ? "POST" : "PATCH",
        body: JSON.stringify({
          ...form,
          active: form.status === "ativo",
          phone: form.buyer_phone_1,
          email: form.buyer_email,
        }),
      });
      await load();
      reset();
      setNotice(result.message || "Cliente salvo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o cliente.");
    } finally {
      setBusy(false);
    }
  }
  async function pdf(customer: Customer, kind: "registration" | "performance") {
    const key = `${kind}-${customer.id}`;
    setDownloadBusy(key);
    setError("");
    try {
      const path =
        kind === "registration"
          ? `/api/admin/customers/${customer.id}/registration/pdf`
          : `/api/admin/customers/${customer.id}/performance/pdf`;
      await downloadApiFile(path as `/api/${string}`, `${kind}-${customer.id}.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o PDF.");
    } finally {
      setDownloadBusy("");
    }
  }
  function toggleSeller(id: number) {
    setForm((current) => ({
      ...current,
      seller_ids: current.seller_ids.includes(id)
        ? current.seller_ids.filter((item) => item !== id)
        : [...current.seller_ids, id],
    }));
  }
  return (
    <section className="min-w-0 space-y-5">
      {!standalone && <><div>
        <h2 className="text-xl font-extrabold text-slate-900">Cadastro de clientes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cadastro fiscal, comercial, logístico e vínculo com representantes.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">
            Base comercial
          </p>
          <p className="text-sm text-slate-500">{rows.length} clientes cadastrados</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white hover:bg-[#073c96]"
        >
          + Novo cliente
        </button>
      </div>
      </>}
      {modalOpen ? (
        <div
          className={standalone?"w-full":"fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px]"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) reset();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Cadastro de cliente"
            className={standalone?"mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm":"flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">
                  Cadastro completo
                </p>
                <h3 className="text-xl font-extrabold">
                  {editing ? `Editar cliente #${editing}` : "Novo cliente"}
                </h3>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                aria-label="Fechar"
                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold"
              >
                ×
              </button>
            </div>
            <form onSubmit={submit} className={standalone?"p-5 sm:p-8":"overflow-y-auto p-5 sm:p-7"}>
              <div className="space-y-5">
                <Section title="Identificação e situação">
                  <SelectField
                    label="Status do cliente"
                    name="status"
                    form={form}
                    setForm={setForm}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="bloqueado">Bloqueado</option>
                  </SelectField>
                  <Field
                    label="Razão social"
                    name="legal_name"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <Field label="Nome fantasia" name="trade_name" form={form} setForm={setForm} />
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                    CNPJ
                    <div className="flex gap-2">
                      <input
                        className={fieldClass}
                        required
                        value={form.cnpj}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, cnpj: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        disabled={lookupBusy}
                        onClick={() => void lookupCnpj()}
                        className="whitespace-nowrap rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {lookupBusy ? "Consultando…" : "Consultar"}
                      </button>
                    </div>
                  </label>
                  <Field
                    label="Inscrição estadual"
                    name="state_registration"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Inscrição municipal"
                    name="municipal_registration"
                    form={form}
                    setForm={setForm}
                  />
                  <Field label="Regime fiscal" name="tax_regime" form={form} setForm={setForm} />
                  <Field
                    label="Ramo de atividade"
                    name="business_sector"
                    form={form}
                    setForm={setForm}
                  />
                  <SelectField label="Rede" name="network" form={form} setForm={setForm}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </SelectField>
                  <Field
                    label="Grupo econômico"
                    name="economic_group"
                    form={form}
                    setForm={setForm}
                  />
                  <SelectField
                    label="Benefício fiscal"
                    name="tax_benefit"
                    form={form}
                    setForm={setForm}
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </SelectField>
                  <Field
                    label="Qual benefício possui"
                    name="tax_benefit_description"
                    form={form}
                    setForm={setForm}
                  />
                </Section>
                <Section title="Endereço e atendimento">
                  <Field label="Logradouro" name="address" form={form} setForm={setForm} />
                  <Field label="Número" name="address_number" form={form} setForm={setForm} />
                  <Field label="Complemento" name="complement" form={form} setForm={setForm} />
                  <Field label="Bairro" name="neighborhood" form={form} setForm={setForm} />
                  <Field label="Cidade" name="city" form={form} setForm={setForm} />
                  <Field label="UF" name="state" form={form} setForm={setForm} />
                  <Field label="CEP" name="zip_code" form={form} setForm={setForm} />
                  <Field
                    label="Região de atendimento"
                    name="service_region"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Endereço de entrega"
                    name="delivery_address"
                    form={form}
                    setForm={setForm}
                    wide
                  />
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-600 md:col-span-2 xl:col-span-4">
                    Advertências de recebimento
                    <textarea
                      className={`${fieldClass} min-h-24 resize-y`}
                      value={form.delivery_warnings}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          delivery_warnings: event.target.value,
                        }))
                      }
                    />
                  </label>
                </Section>
                <Section title="Contato de compras">
                  <Field
                    label="Responsável compras"
                    name="buyer_contact"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Telefone compras 1"
                    name="buyer_phone_1"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Telefone compras 2"
                    name="buyer_phone_2"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="E-mail compras"
                    name="buyer_email"
                    type="email"
                    form={form}
                    setForm={setForm}
                  />
                </Section>
                <Section title="Contato financeiro">
                  <Field
                    label="Responsável financeiro"
                    name="finance_contact"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Telefone financeiro 1"
                    name="finance_phone_1"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Telefone financeiro 2"
                    name="finance_phone_2"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="E-mail financeiro"
                    name="finance_email"
                    type="email"
                    form={form}
                    setForm={setForm}
                  />
                </Section>
                <Section title="Contato logístico">
                  <Field
                    label="Responsável logística"
                    name="logistics_contact"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Telefone logística"
                    name="logistics_phone"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Telefone agendamento"
                    name="scheduling_phone"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="E-mail envio XML"
                    name="xml_email"
                    type="email"
                    form={form}
                    setForm={setForm}
                  />
                </Section>
                <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <legend className="px-2 text-xs font-extrabold uppercase tracking-wider text-[#0767b4]">
                    Representantes vinculados
                  </legend>
                  <p className="mb-3 text-xs text-slate-500">
                    Selecione um ou mais representantes. O cliente aparecerá na carteira de todos os
                    selecionados.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sellers.map((seller) => (
                      <label
                        key={seller.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${form.seller_ids.includes(seller.id) ? "border-[#0767b4] bg-blue-50" : "border-slate-200"}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.seller_ids.includes(seller.id)}
                          onChange={() => toggleSeller(seller.id)}
                        />
                        <span>
                          <strong className="block text-slate-800">{seller.name}</strong>
                          <span className="text-xs text-slate-500">{seller.email}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                  Observações adicionais
                  <textarea
                    className={`${fieldClass} min-h-28 resize-y`}
                    value={form.additional_notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, additional_notes: event.target.value }))
                    }
                  />
                </label>
                {error ? (
                  <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}
                <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-white py-4">
                  {editingCustomer ? (
                    <>
                      <button
                        type="button"
                        disabled={Boolean(downloadBusy)}
                        onClick={() => void pdf(editingCustomer, "registration")}
                        className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-50"
                      >
                        {downloadBusy === `registration-${editingCustomer.id}`
                          ? "Gerando…"
                          : "Ficha cadastral PDF"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(downloadBusy)}
                        onClick={() => void pdf(editingCustomer, "performance")}
                        className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 disabled:opacity-50"
                      >
                        {downloadBusy === `performance-${editingCustomer.id}`
                          ? "Gerando…"
                          : "Análise do cliente PDF"}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={busy}
                    className="rounded-xl bg-[#0767b4] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Salvando…" : "Salvar cliente"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {!standalone && <>
      {error && !modalOpen ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-3 rounded-2xl border border-[#e4ebf0] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_180px_130px]">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Buscar cliente
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Código, nome, CNPJ ou representante"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Situação
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="bloqueado">Bloqueados</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Por página
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((size) => (
              <option value={size} key={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap rounded-2xl border border-[#e4ebf0] bg-white p-3 shadow-sm">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>CNPJ</th>
              <th>Representantes</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((customer) => {
              const status = customer.status || (customer.active ? "ativo" : "inativo");
              return (
                <tr key={customer.id}>
                  <td>#{customer.id}</td>
                  <td>
                    <strong>{customer.legal_name}</strong>
                    {customer.trade_name ? (
                      <span className="block text-xs text-slate-500">{customer.trade_name}</span>
                    ) : null}
                  </td>
                  <td>{customer.cnpj}</td>
                  <td>{customer.seller_names || "—"}</td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "ativo" ? "bg-emerald-50 text-emerald-700" : status === "bloqueado" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => edit(customer)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(downloadBusy)}
                        onClick={() => void pdf(customer, "registration")}
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                      >
                        {downloadBusy === `registration-${customer.id}` ? "Gerando…" : "Ficha PDF"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(downloadBusy)}
                        onClick={() => void pdf(customer, "performance")}
                        className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        {downloadBusy === `performance-${customer.id}` ? "Gerando…" : "Análise PDF"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!paged.length ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {visible.length} cliente(s) · Página {currentPage} de {pages}
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
      </>}
    </section>
  );
}
