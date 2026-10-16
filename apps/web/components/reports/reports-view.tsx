"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, downloadApiFile } from "@/lib/api";

type ReportColumn = { key: string; label: string; align?: "left" | "right" };
type Report = {
  type: string;
  title: string;
  section: string;
  metrics: Array<{ label: string; value: string }>;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
};

const reportTypes = [
  {
    key: "vendas",
    name: "Vendas",
    description: "Somente vendas aprovadas ou concluídas, sem bonificações.",
  },
  {
    key: "pedidos",
    name: "Pedidos",
    description: "Visão completa do fluxo, incluindo pedidos em análise e recusados.",
  },
  {
    key: "bonificacoes",
    name: "Bonificações",
    description: "Pedidos classificados como bonificação e seus valores.",
  },
  {
    key: "produtos_vendidos",
    name: "Produtos vendidos",
    description: "Quantidade, preço médio e faturamento por produto.",
  },
  {
    key: "prazo_pagamento",
    name: "Prazo de pagamento",
    description: "Desempenho agrupado por condição de pagamento.",
  },
  {
    key: "fechamento_mensal",
    name: "Fechamento mensal",
    description: "Consolidado de pedidos, ticket e faturamento por mês.",
  },
] as const;

function valueOf(value: unknown) {
  return String(value ?? "—");
}

export default function ReportsView() {
  const [kind, setKind] = useState("vendas");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [seller, setSeller] = useState("");
  const [company, setCompany] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [error, setError] = useState("");
  const [sellers, setSellers] = useState<{ id: number; name: string; role: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: number; legal_name: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ users: { id: number; name: string; role: string }[] }>("/api/admin/users"),
      api<{ companies: { id: number; name: string }[] }>("/api/admin/companies"),
      api<{ customers: { id: number; legal_name: string }[] }>("/api/admin/customers"),
    ])
      .then(([userData, companyData, customerData]) => {
        if (!mounted) return;
        setSellers((userData.users || []).filter((item) => item.role === "seller"));
        setCompanies(companyData.companies || []);
        setCustomers(customerData.customers || []);
      })
      .catch((cause: unknown) => {
        if (mounted)
          setError(cause instanceof Error ? cause.message : "Erro ao carregar os filtros.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ type: kind });
    if (start) params.set("date_from", start);
    if (end) params.set("date_to", end);
    if (seller) params.set("seller_id", seller);
    if (company) params.set("company_id", company);
    if (customer) params.set("customer_id", customer);
    if (status && (kind === "pedidos" || kind === "bonificacoes")) params.set("status", status);
    return params.toString();
  }, [company, customer, end, kind, seller, start, status]);

  async function preview(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setReport(await api<Report>(`/api/admin/reports/preview?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o relatório.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setDownloadBusy(true);
    setError("");
    try {
      await downloadApiFile(`/api/admin/reports/pdf?${query}`, `relatorio-${kind}.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível baixar o PDF.");
    } finally {
      setDownloadBusy(false);
    }
  }

  function clearFilters() {
    setStart("");
    setEnd("");
    setSeller("");
    setCompany("");
    setCustomer("");
    setStatus("");
    setReport(null);
  }

  const field =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100";
  const showStatus = kind === "pedidos" || kind === "bonificacoes";

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl bg-gradient-to-r from-[#073f7d] to-[#0879c9] p-6 text-white shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-100">
          Inteligência comercial
        </p>
        <h2 className="mt-2 text-2xl font-black">Relatórios</h2>
        <p className="mt-1 max-w-3xl text-sm text-blue-100">
          Escolha uma análise, refine os filtros e confira os dados na tela antes de gerar o PDF.
        </p>
      </header>

      <section aria-label="Tipos de relatório" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reportTypes.map((item) => {
          const selected = kind === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setKind(item.key);
                setReport(null);
              }}
              className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#0767b4] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300"}`}
            >
              <strong className={selected ? "text-[#0767b4]" : "text-slate-800"}>
                {item.name}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {item.description}
              </span>
            </button>
          );
        })}
      </section>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={preview}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">Filtros</h3>
            <p className="text-xs text-slate-500">Todos são opcionais.</p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-[#0767b4]"
          >
            Limpar filtros
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Data inicial
            <input
              className={field}
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Data final
            <input
              className={field}
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Representante
            <select
              className={field}
              value={seller}
              onChange={(event) => setSeller(event.target.value)}
            >
              <option value="">Todos</option>
              {sellers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Empresa
            <select
              className={field}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            >
              <option value="">Todas</option>
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Cliente
            <select
              className={field}
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
            >
              <option value="">Todos</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.legal_name}
                </option>
              ))}
            </select>
          </label>
          {showStatus ? (
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Status
              <select
                className={field}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="em_analise">Em análise</option>
                <option value="pedido_aprovado">Pedido aprovado</option>
                <option value="recusado">Recusado</option>
                <option value="em_producao">Em produção</option>
                <option value="faturado">Faturado</option>
                <option value="entregue">Entregue</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Gerando prévia…" : "Gerar prévia"}
          </button>
          {report ? (
            <button
              type="button"
              disabled={downloadBusy}
              onClick={() => void download()}
              className="rounded-xl border border-[#0767b4] px-5 py-3 text-sm font-bold text-[#0767b4] disabled:opacity-50"
            >
              {downloadBusy ? "Gerando PDF…" : "Baixar PDF"}
            </button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </form>

      {report ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0767b4]">
              Prévia do relatório
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-900">{report.title}</h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {report.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl bg-slate-50 p-4">
                <span className="text-xs font-bold uppercase text-slate-500">{metric.label}</span>
                <strong className="mt-1 block text-xl text-[#0b2a63]">{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="px-5 pb-2">
            <h4 className="font-bold text-slate-800">{report.section}</h4>
            <p className="text-xs text-slate-500">
              {report.rows.length.toLocaleString("pt-BR")} linha(s) encontradas.
            </p>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#e8f0f7] text-xs uppercase text-slate-600">
                <tr>
                  {report.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`whitespace-nowrap px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(0, 200).map((row, index) => (
                  <tr
                    key={`${report.type}-${index}`}
                    className="border-t border-slate-100 even:bg-slate-50/60"
                  >
                    {report.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap px-4 py-3 text-slate-700 ${column.align === "right" ? "text-right font-semibold" : ""}`}
                      >
                        {valueOf(row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {!report.rows.length ? (
                  <tr>
                    <td colSpan={report.columns.length} className="p-10 text-center text-slate-500">
                      Nenhum resultado para os filtros selecionados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {report.rows.length > 200 ? (
            <p className="border-t border-slate-100 p-4 text-center text-xs text-slate-500">
              A prévia mostra as primeiras 200 linhas. O PDF inclui todos os registros.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
