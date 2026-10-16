"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiEye,
  FiFilter,
  FiPackage,
  FiFileText,
  FiClock,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiPlus,
  FiSearch,
  FiUser,
} from "react-icons/fi";

import { api, apiPath, type SessionUser } from "@/lib/api";
import OrderAdmin from "./order-admin";
import ProposalForm from "./proposal-form";

type Item = {
  id: number;
  product_id: number;
  name: string;
  code: string;
  quantity: number;
  negotiated_price: number;
};

type Timeline = {
  id: number;
  title: string;
  notes?: string;
  status: string;
  created_at: string;
  created_by_name?: string;
};

type Order = {
  id: number;
  company_id: number;
  order_number?: number;
  status: string;
  company_name: string;
  customer_name: string;
  seller_name: string;
  order_type: string;
  created_at: string;
  updated_at: string;
  items: Item[];
  timeline: Timeline[];
  payment_terms?: string;
  freight_type?: string;
  delivery_type?: string;
  admin_notes?: string;
  delivery_forecast?: string;
  industry_order_number?: string;
  invoice_number?: string;
  notes?: string;
  purchase_order?: string;
  commission_percent?: number;
  discount_percent?: number;
  discount_on?: string;
  invoice_type?: string;
  tax_operator_invoice?: number | boolean;
  scheduled_delivery_date?: string;
};

const cash = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const orderNumber = (order: Pick<Order, "id" | "order_number" | "order_type">) =>
  `${order.order_number || order.id}/${/bonific/i.test(order.order_type) ? "B" : "V"}`;

const orderTotal = (order: Order) =>
  (order.items || []).reduce(
    (total, item) => total + Number(item.quantity || 0) * Number(item.negotiated_price || 0),
    0,
  );

const statusLabel = (value: string) => {
  const labels: Record<string, string> = {
    em_analise: "Em análise",
    em_producao: "Em produção",
    pedido_entregue: "Pedido entregue",
    entregue: "Entregue",
    faturado: "Faturado",
    cancelado: "Cancelado",
    aprovado: "Aprovado",
    pedido_aprovado: "Pedido aprovado",
    recusado: "Recusado",
    pendente: "Pendente",
    rascunho: "Rascunho",
  };
  return labels[value] || value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
};

const statusTone = (value: string) => {
  if (/recus|cancel/i.test(value)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (/fatur/i.test(value)) return "border-violet-200 bg-violet-50 text-violet-700";
  if (/entreg/i.test(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/produc/i.test(value)) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (/aprov/i.test(value)) return "border-blue-200 bg-blue-50 text-blue-700";
  if (/anal|pendent/i.test(value)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const statusAccent = (value: string) => {
  if (/recus|cancel/i.test(value)) return "border-l-rose-500";
  if (/fatur/i.test(value)) return "border-l-violet-500";
  if (/entreg/i.test(value)) return "border-l-emerald-500";
  if (/produc/i.test(value)) return "border-l-cyan-500";
  if (/aprov/i.test(value)) return "border-l-blue-500";
  if (/anal|pendent/i.test(value)) return "border-l-amber-500";
  return "border-l-slate-300";
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function OrdersView({ user }: { user: SessionUser }) {
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);

    api<{ proposals: Order[] }>("/api/proposals")
      .then((response) => {
        if (active) setOrders(response.proposals || []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar pedidos");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refresh]);

  const statuses = useMemo(
    () => Array.from(new Set(orders.map((order) => order.status))).sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const matchesQuery =
        !normalizedQuery ||
        [
          order.order_number,
          order.customer_name,
          order.company_name,
          order.seller_name,
          order.id,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [orders, query, status]);

  const current = orders.find((order) => order.id === selected);
  const timelineOrder = orders.find((order) => order.id === timelineOpen);
  const totalFiltered = useMemo(
    () => filtered.reduce((total, order) => total + orderTotal(order), 0),
    [filtered],
  );

  const statusCounts = useMemo(
    () => ({
      analysis: orders.filter((order) => /anal|pendent/i.test(order.status)).length,
      production: orders.filter((order) => /produc/i.test(order.status)).length,
      delivered: orders.filter((order) => /entreg/i.test(order.status)).length,
      invoiced: orders.filter((order) => /fatur/i.test(order.status)).length,
    }),
    [orders],
  );

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" role="status">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-50" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0767b4]">
            Gestão de pedidos
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#111111]">
            Pedidos e propostas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe o andamento comercial e encontre pedidos com mais rapidez.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0767b4] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#073c96]"
        >
          <FiPlus size={18} />
          {showForm ? "Fechar formulário" : "Nova proposta"}
        </button>
      </div>

      {showForm && (
        <ProposalForm
          user={user}
          onCreated={() => {
            setRefresh((value) => value + 1);
            setShowForm(false);
          }}
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#111111]">Filtros de trabalho</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Busque por pedido, cliente, empresa ou representante.
            </p>
          </div>
          <FiFilter className="text-slate-400" size={18} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,.7fr)]">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
            Busca geral
            <span className="relative block">
              <FiSearch
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-[#fcfcfc] py-2.5 pl-10 pr-3 text-sm font-medium text-[#111111] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#76bd3d] focus:ring-2 focus:ring-[#76bd3d]/10"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Número, cliente, empresa ou representante"
              />
            </span>
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
            Status
            <select
              className="rounded-xl border border-slate-200 bg-[#fcfcfc] px-3 py-2.5 text-sm font-semibold text-[#111111] outline-none transition focus:border-[#76bd3d] focus:ring-2 focus:ring-[#76bd3d]/10"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Todos os status</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">
            <strong className="text-[#111111]">{filtered.length}</strong> pedido(s) encontrado(s)
          </p>
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total filtrado
            </span>
            <strong className="text-lg font-extrabold text-[#073c96]">{cash(totalFiltered)}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: "Pedidos", value: orders.length },
          { label: "Em análise", value: statusCounts.analysis },
          { label: "Em produção", value: statusCounts.production },
          { label: "Entregues", value: statusCounts.delivered },
          { label: "Faturados", value: statusCounts.invoiced },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <strong className="block text-xl font-extrabold text-[#111111]">{item.value}</strong>
            <span className="text-xs font-medium text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((order) => (
          <article
            key={order.id}
            className={`group rounded-2xl border border-slate-200 border-l-4 ${statusAccent(order.status)} bg-white p-4 shadow-sm transition hover:border-[#a8cde8] hover:shadow-md sm:p-5`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#edf5fc] px-2.5 py-1 text-sm font-extrabold text-[#073c96]">
                      #{orderNumber(order)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-base font-extrabold text-[#111111]">
                    {order.customer_name || "Cliente não informado"}
                  </h3>
                </div>

                <div className="text-left sm:text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total
                  </span>
                  <strong className="text-lg font-extrabold text-[#111111]">
                    {cash(orderTotal(order))}
                  </strong>
                </div>
              </div>

              <div className="grid gap-3 border-y border-slate-100 py-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
                    <FiUser size={15} />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Representante
                    </span>
                    <strong className="block truncate text-xs text-slate-700">
                      {order.seller_name || "—"}
                    </strong>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
                    <FiBriefcase size={15} />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Empresa
                    </span>
                    <strong className="block truncate text-xs text-slate-700">
                      {order.company_name || "—"}
                    </strong>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
                    <FiCalendar size={15} />
                  </span>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Data
                    </span>
                    <strong className="block text-xs text-slate-700">{formatDate(order.created_at)}</strong>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
                    <FiPackage size={15} />
                  </span>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Itens
                    </span>
                    <strong className="block text-xs text-slate-700">
                      {(order.items || []).length}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cde4f4] bg-[#f7fbff] px-3.5 text-xs font-bold text-[#0767b4] transition hover:border-[#76bd3d] hover:bg-white"
                  onClick={() => setSelected(order.id)}
                >
                  <FiEye size={16} />
                  Visualizar
                  <FiChevronRight size={15} />
                </button>
                <button
                  type="button"
                  aria-expanded={timelineOpen === order.id}
                  aria-controls={`timeline-${order.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                  onClick={() => setTimelineOpen((previous) => previous === order.id ? null : order.id)}
                >
                  <FiClock size={16} />
                  Linha do tempo
                </button>
                <a
                  href={apiPath(`/api/proposals/${order.id}/pdf`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  <FiFileText size={16} />
                  Abrir PDF
                </a>
              </div>

            </div>
          </article>
        ))}

        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <FiSearch className="mx-auto text-slate-300" size={28} />
            <h3 className="mt-3 text-sm font-bold text-slate-700">Nenhum pedido encontrado</h3>
            <p className="mt-1 text-xs text-slate-500">Ajuste a busca ou o filtro de status.</p>
          </div>
        )}
      </div>

      {timelineOrder && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[3px] sm:p-6"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setTimelineOpen(null); }}
        >
          <section role="dialog" aria-modal="true" aria-label={`Linha do tempo do pedido #${orderNumber(timelineOrder)}`}
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#0767b4]">Linha do tempo</p>
                <h2 className="mt-1 text-xl font-extrabold text-[#111111]">Pedido #{orderNumber(timelineOrder)}</h2>
              </div>
              <button type="button" aria-label="Fechar linha do tempo" onClick={() => setTimelineOpen(null)}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-100"><FiX size={19} /></button>
            </header>
            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <div className="mb-7 rounded-xl border border-slate-200 bg-[#f8fafc] p-4">
                <h3 className="font-bold text-slate-900">{timelineOrder.customer_name}</h3>
                <p className="mt-1 text-xs text-slate-500">{timelineOrder.company_name} · {timelineOrder.seller_name}</p>
                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(timelineOrder.status)}`}>{statusLabel(timelineOrder.status)}</span>
              </div>
              {(timelineOrder.timeline || []).length ? (
                <ol className="space-y-0">
                  {[...timelineOrder.timeline].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((entry, index, events) => (
                    <li key={entry.id || index} className="grid grid-cols-[75px_28px_minmax(0,1fr)] gap-3 sm:grid-cols-[100px_36px_minmax(0,1fr)] sm:gap-4">
                      <div className="pt-1 text-right text-xs text-slate-500">
                        <strong className="block font-bold">{formatDate(entry.created_at)}</strong>
                        <span>{!Number.isNaN(new Date(entry.created_at).getTime()) ? new Intl.DateTimeFormat("pt-BR", {hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date(entry.created_at)) : ""}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className={`z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 bg-white ${statusTone(entry.status)}`}>
                          {/fatur|entreg|aprov/i.test(entry.status) ? <FiCheckCircle size={15}/> : /recus|cancel/i.test(entry.status) ? <FiAlertCircle size={15}/> : <FiClock size={15}/>}
                        </span>
                        {index < events.length - 1 && <span className="min-h-14 w-px flex-1 border-l-2 border-dashed border-slate-200" />}
                      </div>
                      <div className="min-w-0 pb-7">
                        <h4 className="font-bold text-slate-800">{entry.title || statusLabel(entry.status)}</h4>
                        {entry.notes && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{entry.notes}</p>}
                        {entry.created_by_name && <p className="mt-2 text-xs text-slate-500">Responsável: {entry.created_by_name}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="py-8 text-center text-sm text-slate-500">Nenhum evento registrado neste pedido.</p>}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
              <button type="button" onClick={() => setTimelineOpen(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <FiX size={16}/> Fechar
              </button>
              <a href={apiPath(`/api/proposals/${timelineOrder.id}/pdf`)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0767b4] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#073c96]">
                <FiFileText size={16}/> Abrir PDF
              </a>
            </footer>
          </section>
        </div>
      )}
      {current && (
        <div role="presentation" className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-label={`Visualizar pedido #${orderNumber(current)}`} className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-5 flex flex-wrap justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[#111111]">Pedido #{orderNumber(current)}</h2>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(current.status)}`}
                >
                  {statusLabel(current.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {current.customer_name} · {current.company_name}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                className="rounded-xl bg-[#0767b4] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#073c96]"
                target="_blank"
                rel="noreferrer"
                href={apiPath(`/api/proposals/${current.id}/pdf`)}
              >
                Gerar PDF
              </a>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setSelected(null)}
              >
                Fechar
              </button>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold text-slate-500">Representante</dt>
              <dd className="mt-1 font-semibold text-slate-800">{current.seller_name}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold text-slate-500">Condição de pagamento</dt>
              <dd className="mt-1 font-semibold text-slate-800">{current.payment_terms || "—"}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold text-slate-500">Frete</dt>
              <dd className="mt-1 font-semibold text-slate-800">{current.freight_type || "—"}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-semibold text-slate-500">Entrega</dt>
              <dd className="mt-1 font-semibold text-slate-800">{current.delivery_type || "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 flex items-end justify-between gap-3">
            <h3 className="font-bold text-[#111111]">Itens do pedido</h3>
            <strong className="text-sm text-[#073c96]">{cash(orderTotal(current))}</strong>
          </div>

          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Produto", "Código", "Quantidade", "Unitário", "Total"].map((item) => (
                    <th className="border-b border-slate-200 p-3 text-xs font-bold text-slate-600" key={item}>
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(current.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-slate-100 p-3 font-medium">{item.name}</td>
                    <td className="border-b border-slate-100 p-3">{item.code}</td>
                    <td className="border-b border-slate-100 p-3">{item.quantity}</td>
                    <td className="border-b border-slate-100 p-3">{cash(item.negotiated_price)}</td>
                    <td className="border-b border-slate-100 p-3 font-bold">
                      {cash(item.quantity * item.negotiated_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(user.role === "admin" || user.role === "dev") && (
            <OrderAdmin key={current.id} order={current} onSaved={() => setRefresh((value) => value + 1)} />
          )}

          <h3 className="mt-6 font-bold text-[#111111]">Histórico</h3>
          <ol className="mt-3 space-y-3">
            {(current.timeline || []).map((item, index) => (
              <li className="border-l-2 border-[#a8cde8] pl-4 text-sm" key={item.id || index}>
                <strong>{item.title}</strong>
                <p className="text-slate-500">
                  {formatDate(item.created_at)} {item.created_by_name || ""}
                </p>
                {item.notes && <p>{item.notes}</p>}
              </li>
            ))}
          </ol>
        </section>
        </div>
      )}
    </section>
  );
}
