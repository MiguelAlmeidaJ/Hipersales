"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

const reportTypes = [
  ["vendas", "Vendas"],
  ["pedidos", "Acompanhamento de pedidos"],
  ["bonificacoes", "Bonificações"],
  ["produtos_vendidos", "Produtos vendidos"],
  ["prazo_pagamento", "Prazo de pagamento"],
  ["fechamento_mensal", "Fechamento mensal"],
] as const;
export default function ReportsView() {
  const [kind, setKind] = useState("vendas"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [seller, setSeller] = useState(""),
    [company, setCompany] = useState(""),
    [customer, setCustomer] = useState(""),
    [status, setStatus] = useState("");
  const [url, setUrl] = useState("");
  const [sellers, setSellers] = useState<{ id: number; name: string; role: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: number; legal_name: string }[]>([]);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ users: { id: number; name: string; role: string }[] }>("/api/admin/users"),
      api<{ companies: { id: number; name: string }[] }>("/api/admin/companies"),
      api<{ customers: { id: number; legal_name: string }[] }>("/api/admin/customers"),
    ])
      .then(([u, co, cu]) => {
        if (mounted) {
          setSellers((u.users || []).filter((x) => x.role === "seller"));
          setCompanies(co.companies || []);
          setCustomers(cu.customers || []);
        }
      })
      .catch((e) => {
        if (mounted)
          setLoadError(e instanceof Error ? e.message : "Erro ao carregar opções de filtro");
      });
    return () => {
      mounted = false;
    };
  }, []);
  function exportPdf(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ type: kind });
    if (start) q.set("date_from", start);
    if (end) q.set("date_to", end);
    if (seller) q.set("seller_id", seller);
    if (company) q.set("company_id", company);
    if (customer) q.set("customer_id", customer);
    if (status) q.set("status", status);
    setUrl(`/api/admin/reports/pdf?${q.toString()}`);
  }
  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-xl font-semibold">Relatórios</h2>
      <p className="mb-5 text-sm text-slate-500">
        Os arquivos são gerados pela API atual, preservando a lógica de cálculo do backend.
      </p>
      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={exportPdf}>
        <label className="grid gap-1 text-sm">
          Relatório
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            {reportTypes.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Data inicial
          <input
            className={field}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Data final
          <input
            className={field}
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Representante
          <select className={field} value={seller} onChange={(e) => setSeller(e.target.value)}>
            <option value="">Todos</option>
            {sellers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Empresa
          <select className={field} value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">Todas</option>
            {companies.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Cliente
          <select className={field} value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Todos</option>
            {customers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.legal_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {(
              [
                ["em_analise", "Em análise"],
                ["pedido_aprovado", "Pedido aprovado"],
                ["recusado", "Recusado"],
                ["em_producao", "Em produção"],
                ["faturado", "Faturado"],
                ["entregue", "Entregue"],
              ] as const
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">
            Preparar PDF
          </button>
        </div>
      </form>
      {loadError && (
        <p role="alert" className="mt-3 text-red-700">
          {loadError}
        </p>
      )}
      {url && (
        <p className="mt-5 rounded-lg bg-slate-50 p-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand"
          >
            Abrir relatório em PDF
          </a>
        </p>
      )}
    </section>
  );
}
