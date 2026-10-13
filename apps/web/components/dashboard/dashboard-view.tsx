"use client";
import { useEffect, useState, type FormEvent } from "react";
import { FiActivity, FiArrowUpRight, FiBriefcase, FiClock, FiDollarSign, FiFilter, FiRefreshCw, FiSearch, FiShoppingBag, FiUsers, FiX } from "react-icons/fi";
import { api, type SessionUser } from "@/lib/api";
type Rank = { name: string; orders: number; total: number };
type Product = { name: string; company: string; quantity: number; total: number };
type Order = {
  id: number;
  order_number?: number;
  customer_name: string;
  company_name: string;
  status: string;
  created_at: string;
  total: number;
};
type Executive = {
  summary: {
    orders: number;
    revenue: number;
    average_ticket: number;
    customers: number;
    products: number;
    companies: number;
    sellers: number;
    pending_requests: number;
  };
  statuses: { status: string; total: number }[];
  company_ranking: Rank[];
  seller_ranking: Rank[];
  top_products: Product[];
  recent_orders: Order[];
};
type SellerOverview = { summary?: Record<string, number>; status_counts?: Record<string, number> };
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const number = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v || 0);
const names: Record<string, string> = {
  em_analise: "Em análise",
  pedido_aprovado: "Pedido aprovado",
  recusado: "Proposta recusada",
  em_producao: "Em produção",
  faturado: "Faturado",
  entregue: "Pedido entregue",
};
const colors: Record<string, string> = {
  em_analise: "#eab52b",
  pedido_aprovado: "#07a970",
  recusado: "#f43f5e",
  em_producao: "#009ad6",
  faturado: "#073c96",
  entregue: "#76bd3d",
};
const card =
  "rounded-2xl border border-[#e4ebf0] bg-white p-5 shadow-[0_6px_24px_rgba(16,50,83,.035)]";
function Heading({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#073c96]">
        {kicker}
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-[#111111]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
function Ranking({ items }: { items: Rank[] }) {
  return (
    <div className="space-y-2">
      {items.length ? (
        items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[#e4ebf0] bg-white px-3 py-3 transition-colors hover:bg-[#f8fbfe]"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf5fc] text-sm font-extrabold text-[#073c96]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#111111]">{item.name}</p>
              <p className="text-xs text-slate-500">{number(item.orders)} pedido(s)</p>
            </div>
            <strong className="shrink-0 text-right text-sm font-extrabold tabular-nums text-[#111111]">{money(item.total)}</strong>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-500">Nenhum pedido no período.</p>
      )}
    </div>
  );
}
export default function DashboardView({ user }: { user: SessionUser }) {
  const admin = user.role === "admin";
  const [overview, setOverview] = useState<SellerOverview | null>(null),
    [data, setData] = useState<Executive | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "", date_from: "", date_to: "" });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const url: `/api/${string}` = admin
      ? `/api/admin/executive-dashboard${params.size ? "?" + params.toString() : ""}`
      : "/api/dashboard";
    if (admin) {
      api<Executive>(url)
        .then((v) => {
          if (active) { setData(v); setLastUpdated(new Date()); }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Falha ao carregar painel");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      api<SellerOverview>("/api/dashboard")
        .then((v) => {
          if (active) { setOverview(v); setLastUpdated(new Date()); }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Falha ao carregar indicadores");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [admin, filters, revision]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (from && to && from > to) {
      setError("A data inicial não pode superar a data final.");
      return;
    }
    setFilters({ q: search, status, date_from: from, date_to: to });
  }
  function clear() {
    setSearch("");
    setStatus("");
    setFrom("");
    setTo("");
    setFilters({ q: "", status: "", date_from: "", date_to: "" });
    setError("");
  }
  const metrics = data
    ? [
        [
          "Valor bruto dos pedidos",
          money(data.summary.revenue),
          `${number(data.summary.orders)} pedidos no recorte`,
        ],
        ["Ticket médio", money(data.summary.average_ticket), "Média dos pedidos filtrados"],
        ["Clientes ativos", number(data.summary.customers), "Clientes na base"],
        ["Produtos ativos", number(data.summary.products), "Itens no catálogo"],
        ["Pendências", number(data.summary.pending_requests), "Cadastros em análise"],
      ]
    : [];
  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#e4ebf0] pb-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#073c96]">
            Dashboard
          </p>
          <h2 className="mt-1 text-[clamp(1.65rem,2.3vw,2.15rem)] font-black tracking-tight text-[#111111]">
            Painel executivo
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Visão consolidada de pedidos, carteira, catálogo e operação comercial.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-xl border border-[#d9e7f2] bg-white px-3 py-2.5 text-xs font-semibold text-[#073c96]"><FiBriefcase size={15}/> HiperMix Representações</span><span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><FiClock size={14}/>{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando atualização"}</span></div>
      </header>
      {admin && (
        <form onSubmit={submit} className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#111111]"><FiFilter size={17} className="text-[#0767b4]"/> Filtros da operação</h2>
              <p className="text-sm text-slate-500">
                Encontre pedidos e analise os indicadores do período.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRevision((x) => x + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#cde4f4] bg-white px-3 py-2.5 text-xs font-bold text-[#073c96] transition hover:bg-[#edf5fc] disabled:opacity-50"
              disabled={loading}
            >
              <FiRefreshCw size={14} className={loading ? "animate-spin" : ""}/> Atualizar
            </button>
          </div>
          <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.2fr_1fr_1fr_auto]">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Buscar
              <input
                className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-sm font-normal"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, pedido, empresa, produto..."
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Status
              <select
                className="rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(names).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              De
              <input
                className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-sm"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Até
              <input
                className="min-w-0 rounded-lg border border-slate-300 p-2.5 text-sm"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <FiX size={14}/> Limpar
              </button>
              <button
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0767b4] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#073c96] disabled:opacity-50"
              >
                <FiSearch size={15}/> Filtrar
              </button>
            </div>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          {error}
        </p>
      )}
      {loading && (
        <div role="status" className="rounded-2xl border bg-white p-8 text-slate-500">
          Carregando indicadores da HiperMix…
        </div>
      )}
      {!admin && !loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(overview?.summary || {}).map(([key, value]) => (
            <div key={key} className={card}>
              <p className="text-sm font-semibold text-slate-500">{key.replaceAll("_", " ")}</p>
              <p className="mt-3 text-3xl font-extrabold">{number(value)}</p>
            </div>
          ))}
        </div>
      )}
      {admin && data && (
        <div className={loading ? "pointer-events-none space-y-5 opacity-60" : "space-y-5"}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map(([label, value, help], i) => (
              <article
                className={`${card} relative overflow-hidden border-t-[3px] transition-shadow hover:shadow-[0_10px_30px_rgba(16,50,83,.09)]`}
                style={{
                  borderTopColor: ["#0767b4", "#009ad6", "#07a970", "#76bd3d", "#eab52b"][i],
                }}
                key={label}
              >
                <div className="mb-3 flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#edf5fc] text-[#0767b4]">{[<FiDollarSign key="revenue"/>,<FiActivity key="ticket"/>,<FiUsers key="customers"/>,<FiShoppingBag key="products"/>,<FiClock key="pending"/>][i]}</span><FiArrowUpRight size={15} className="text-slate-300"/></div>
                <p className="text-[11px] font-bold tracking-[.02em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 break-words text-[clamp(1.15rem,1.7vw,1.6rem)] font-black tracking-tight tabular-nums text-[#111111]">
                  {value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{help}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className={card}>
              <Heading kicker="Pedidos" title="Status do funil" />
              <div className="space-y-4">
                {data.statuses.map((row) => (
                  <div key={row.status}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-[#111111]">
                        {names[row.status] || row.status}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {number(row.total)} pedidos ·{" "}
                        {data.summary.orders
                          ? Math.round((row.total * 100) / data.summary.orders)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${data.summary.orders ? (row.total / data.summary.orders) * 100 : 0}%`,
                          backgroundColor: colors[row.status] || "#7c3aed",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!data.statuses.length && (
                  <p className="text-sm text-slate-500">Nenhum pedido encontrado.</p>
                )}
              </div>
            </section>
            <section className={card}>
              <Heading kicker="Empresas" title="Ranking de empresas" />
              <Ranking items={data.company_ranking} />
            </section>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className={card}>
              <Heading kicker="Representantes" title="Ranking do time comercial" />
              <Ranking items={data.seller_ranking} />
            </section>
            <section className={card}>
              <Heading kicker="Últimos pedidos" title="Atividade recente" />
              <div className="space-y-2">
                {data.recent_orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 rounded-xl border border-[#e4ebf0] px-3 py-3 transition hover:bg-[#f8fbfe]"
                  >
                    <span className="shrink-0 rounded-lg bg-[#edf5fc] px-2.5 py-2 text-xs font-bold text-[#0767b4]">
                      #{order.order_number || order.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#111111]">
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.company_name} · {names[order.status] || order.status}
                      </p>
                    </div>
                    <strong className="shrink-0 text-xs text-[#111111]">
                      {money(order.total)}
                    </strong>
                  </div>
                ))}
                {!data.recent_orders.length && (
                  <p className="text-sm text-slate-500">Nenhum pedido no recorte.</p>
                )}
              </div>
            </section>
          </div>
          <section className={card}>
            <Heading kicker="Produtos" title="Produtos mais vendidos" />
            <div className="space-y-2">
              {data.top_products.map((product, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e4ebf0] bg-[#fafcff] p-4 transition hover:bg-[#edf5fc]"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[#e4f3fc] text-sm font-bold text-[#073c96]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[#111111]">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.company} · {number(product.quantity)} unidades
                    </p>
                  </div>
                  <strong className="text-sm text-[#111111]">{money(product.total)}</strong>
                </div>
              ))}
              {!data.top_products.length && (
                <p className="text-sm text-slate-500">Nenhuma venda no recorte.</p>
              )}
            </div>
          </section>
          <section className={card}>
            <Heading kicker="Pedidos" title="Últimos pedidos" />
            <div className="overflow-x-auto rounded-xl border border-[#e4ebf0]">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="sticky top-0 bg-[#f5f9fc] text-xs text-slate-600">
                  <tr>
                    {["Pedido", "Cliente / Empresa", "Status", "Valor", "Data"].map((x) => (
                      <th className="px-4 py-3" key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 transition hover:bg-[#f8fbfe]">
                      <td className="px-4 py-3 font-bold">#{row.order_number || row.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold">{row.customer_name}</p>
                        <p className="text-xs text-slate-500">{row.company_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#edf5fc] px-2 py-1 text-xs font-bold text-[#0767b4]">
                          {names[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{money(row.total)}</td>
                      <td className="px-4 py-3">
                        {new Date(row.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
