import {
  pendingRequestCount,
} from "../admin/modals.js";

import {
  api,
  loadAdminGoals,
  setFlash,
} from "../core/api.js";

import {
  render,
} from "../core/shell.js";

import {
  state,
} from "../core/state.js";

import {
  companyOptions,
  customerOptions,
  date,
  isAdmin,
  metricCard,
  money,
  readableTextColor,
  safe,
  searchActionField,
  sectionBand,
  sellerOptions,
  softStatusColor,
  statusInfo,
  statusMeta,
  uiIcons,
  wireSearchSubmit,
} from "../core/ui.js";

import {
  activityMonthOptions,
  activityYearOptions,
  orderStatusCounts,
  proposalTotal,
  toDateInputValue,
} from "./proposals.js";

export async function renderDashboard(view) {
  if (!isAdmin()) {
    return;
  }
  const summary = state.dashboard || {};
  const search = String(state.admin.dashboardSearch || "").trim().toLowerCase();
  const statusFilter = String(state.admin.dashboardStatusFilter || "all");
  const dateFrom = String(state.admin.dashboardDateFrom || "");
  const dateTo = String(state.admin.dashboardDateTo || "");
  const orders = (state.orders || []).filter((order) => {
    const total = proposalTotal(order);
    const createdDate = toDateInputValue(order.created_at);
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (dateFrom && createdDate && createdDate < dateFrom) return false;
    if (dateTo && createdDate && createdDate > dateTo) return false;
    if (search) {
      const itemText = (order.items || []).map((item) => `${item.code} ${item.name}`).join(" ");
      const haystack = [
        order.id,
        order.company_name,
        order.customer_name,
        order.seller_name,
        order.purchase_order,
        order.payment_terms,
        itemText,
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  const totalOrdersValue = orders.reduce((sum, order) => sum + proposalTotal(order), 0);
  const averageTicket = orders.length ? totalOrdersValue / orders.length : 0;
  const activeCustomers = state.admin.customers.filter((customer) => customer.active).length;
  const activeProducts = state.admin.products.filter((product) => product.active).length;
  const pendingRequests = pendingRequestCount();
  const statusCounts = orderStatusCounts(orders);
  const maxStatusCount = Math.max(1, ...Object.values(statusCounts));
  const companyTotals = Object.values(
    orders.reduce((acc, order) => {
      const key = String(order.company_id || order.company_name || "0");
      acc[key] ||= { name: order.company_name || "Sem empresa", total: 0, count: 0 };
      acc[key].total += proposalTotal(order);
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total || b.count - a.count).slice(0, 5);
  const sellerTotals = Object.values(
    orders.reduce((acc, order) => {
      const key = String(order.seller_id || order.seller_name || "0");
      acc[key] ||= { name: order.seller_name || "Sem representante", total: 0, count: 0 };
      acc[key].total += proposalTotal(order);
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total || b.count - a.count).slice(0, 5);
  const productTotals = Object.values(
    orders.reduce((acc, order) => {
      (order.items || []).forEach((item) => {
        const key = `${String(item.product_id || item.code || item.name || "")}|${String(order.company_id || order.company_name || "")}`;
        const quantity = Number(item.quantity || 0);
        const total = quantity * Number(item.negotiated_price || 0);
        acc[key] ||= {
          name: item.name || item.code || "Produto",
          company_name: order.company_name || "Sem empresa",
          quantity: 0,
          total: 0,
        };
        acc[key].quantity += quantity;
        acc[key].total += total;
      });
      return acc;
    }, {})
  ).sort((a, b) => b.quantity - a.quantity || b.total - a.total);
  const topProduct = productTotals[0] || null;
  const topProducts = productTotals.slice(0, 5);
  const recentOrders = orders.slice(0, 5);

  view.innerHTML = `
    <div class="admin-grid dashboard-grid">
      ${sectionBand({
        id: "dashboardHero",
        span: "span-12",
        eyebrow: "Dashboard",
        title: "Painel executivo",
        body: `
          <div class="dashboard-hero">
            <div>
              <p class="lead">Visão consolidada de pedidos, carteira, catálogo e operação comercial.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button type="button" class="secondary icon-text-btn" data-route="orders">${uiIcons.timeline}<span>Pedidos</span></button>
              <button type="button" class="secondary icon-text-btn" data-route="customers">${uiIcons.eye}<span>Clientes</span></button>
              <button type="button" class="secondary icon-text-btn" data-route="products">${uiIcons.box}<span>Produtos</span></button>
            </div>
          </div>
          <div class="dashboard-filter-panel">
            <label class="span-2">
              Buscar
              ${searchActionField(`<input type="search" data-dashboard-search value="${safe(state.admin.dashboardSearch)}" placeholder="Cliente, pedido, produto, empresa ou representante" />`)}
            </label>
            <label>
              Status
              <select data-dashboard-status>
                <option value="all" ${statusFilter === "all" ? "selected" : ""}>Todos</option>
                ${Object.entries(statusMeta).map(([value]) => {
                  const meta = statusInfo(value);
                  return `<option value="${safe(value)}" ${statusFilter === value ? "selected" : ""}>${safe(meta.name)}</option>`;
                }).join("")}
              </select>
            </label>
            <label>
              De
              <input type="date" data-dashboard-date-from value="${safe(dateFrom)}" />
            </label>
            <label>
              Até
              <input type="date" data-dashboard-date-to value="${safe(dateTo)}" />
            </label>
            <div class="dashboard-filter-actions">
              <button type="button" class="secondary icon-text-btn" data-dashboard-reset>${uiIcons.close}<span>Limpar</span></button>
              <button type="button" class="icon-text-btn" data-dashboard-apply>${uiIcons.search}<span>Aplicar filtros</span></button>
            </div>
          </div>
        `,
      })}

      <div class="span-12 dashboard-kpis">
        ${metricCard("Faturamento filtrado", money(totalOrdersValue), `${safe(orders.length)} pedido(s) no recorte`, "blue")}
        ${metricCard("Ticket médio", money(averageTicket), "Média dos pedidos filtrados", "teal")}
        ${metricCard("Clientes ativos", activeCustomers, `${safe(state.admin.customers.length)} cliente(s) na base`, "green")}
        ${metricCard("Produtos ativos", activeProducts, `${safe(state.admin.products.length)} produto(s) cadastrados`, "gold")}
        ${metricCard("Pendências", pendingRequests, "Solicitações aguardando análise", "red")}
      </div>

      ${sectionBand({
        id: "dashboardStatus",
        span: "span-6",
        eyebrow: "Pedidos",
        title: "Status do funil",
        body: `
          <div class="dashboard-bars">
            ${Object.entries(statusMeta).map(([status]) => {
              const meta = statusInfo(status);
              const count = statusCounts[status] || 0;
              const width = Math.max(5, Math.round((count / maxStatusCount) * 100));
              return `
                <div class="dashboard-bar-row" style="--status-color:${safe(meta.color)};--bar-width:${safe(width)}%;">
                  <div><strong>${safe(meta.name)}</strong><span>${safe(count)} pedido(s)</span></div>
                  <i></i>
                </div>
              `;
            }).join("")}
          </div>
        `,
      })}

      ${sectionBand({
        id: "dashboardSuppliers",
        span: "span-6",
        eyebrow: "Empresas",
        title: "Ranking de Empresas",
        body: `
          <div class="dashboard-ranking">
            ${companyTotals.length ? `
              <div class="dashboard-ranking-head">
                <span>#</span>
                <strong>Empresa</strong>
                <small>Qtd/pedidos</small>
                <b>Vlr total pedidos</b>
              </div>
              ${companyTotals.map((item, index) => `
                <div class="ranking-row">
                  <span>${safe(index + 1)}</span>
                  <strong>${safe(item.name)}</strong>
                  <small>${safe(item.count)} pedido(s)</small>
                  <b>${safe(money(item.total))}</b>
                </div>
              `).join("")}
            ` : `<p class="empty-state compact">Nenhum pedido no filtro atual.</p>`}
          </div>
        `,
      })}

      ${sectionBand({
        id: "dashboardSellers",
        span: "span-6",
        eyebrow: "Representantes",
        title: "Ranking Time Comercial",
        body: `
          <div class="dashboard-ranking">
            ${sellerTotals.length ? `
              <div class="dashboard-ranking-head">
                <span>#</span>
                <strong>Representante</strong>
                <small>Qtd/pedidos</small>
                <b>Vlr total pedidos</b>
              </div>
              ${sellerTotals.map((item, index) => `
                <div class="ranking-row">
                  <span>${safe(index + 1)}</span>
                  <strong>${safe(item.name)}</strong>
                  <small>${safe(item.count)} pedido(s)</small>
                  <b>${safe(money(item.total))}</b>
                </div>
              `).join("")}
            ` : `<p class="empty-state compact">Nenhum representante no filtro atual.</p>`}
          </div>
        `,
      })}

      ${sectionBand({
        id: "dashboardProducts",
        span: "span-12",
        eyebrow: "Produtos",
        title: "Produtos mais vendidos",
        body: `
          ${
            topProduct
              ? `
                <article class="dashboard-featured-product">
                  <div>
                    <span>Qual produto mais vendido</span>
                    <strong>${safe(topProduct.name)}</strong>
                    <p>${safe(topProduct.company_name)} • ${safe(topProduct.quantity)} unidade(s) vendidas</p>
                  </div>
                  <b>${safe(money(topProduct.total))}</b>
                </article>
              `
              : `<p class="empty-state compact">Nenhum item no filtro atual.</p>`
          }
          <div class="dashboard-ranking">
            ${topProducts.length ? `
              <div class="dashboard-ranking-head">
                <span>#</span>
                <strong>Produto</strong>
                <small>Empresa • Qtde vendida</small>
                <b>Valor total</b>
              </div>
              ${topProducts.map((item, index) => `
                <div class="ranking-row">
                  <span>${safe(index + 1)}</span>
                  <strong>${safe(item.name)}</strong>
                  <small>${safe(item.company_name)} • ${safe(item.quantity)} un.</small>
                  <b>${safe(money(item.total))}</b>
                </div>
              `).join("")}
            ` : ``}
          </div>
        `,
      })}

      ${sectionBand({
        id: "dashboardRecent",
        span: "span-6",
        eyebrow: "Últimos pedidos",
        title: "Atividade recente",
        body: `
          <div class="dashboard-recent">
            ${recentOrders.length ? recentOrders.map((order) => {
              const meta = statusInfo(order.status);
              return `
                <article>
                  <div>
                    <strong>#${safe(order.id)} ${safe(order.customer_name)}</strong>
                    <span>${safe(order.company_name)} • ${safe(date(order.created_at))}</span>
                  </div>
                  <span class="badge status-badge" style="--status-color:${safe(meta.color)};--status-soft:${safe(softStatusColor(meta.color))};--status-text:${safe(readableTextColor(meta.color))};">${safe(meta.name)}</span>
                  <b>${safe(money(proposalTotal(order)))}</b>
                </article>
              `;
            }).join("") : `<p class="empty-state compact">Nenhuma atividade no filtro atual.</p>`}
          </div>
        `,
      })}
    </div>
  `;
  wireDashboard(view);
}

export function wireDashboard(view) {
  const apply = () => {
    state.admin.dashboardSearch = view.querySelector("[data-dashboard-search]")?.value || "";
    state.admin.dashboardStatusFilter = view.querySelector("[data-dashboard-status]")?.value || "all";
    state.admin.dashboardDateFrom = view.querySelector("[data-dashboard-date-from]")?.value || "";
    state.admin.dashboardDateTo = view.querySelector("[data-dashboard-date-to]")?.value || "";
    render();
  };
  wireSearchSubmit(view, "[data-dashboard-search]", () => apply());
  view.querySelector("[data-dashboard-apply]")?.addEventListener("click", apply);
  view.querySelector("[data-dashboard-reset]")?.addEventListener("click", () => {
    state.admin.dashboardSearch = "";
    state.admin.dashboardStatusFilter = "all";
    state.admin.dashboardDateFrom = "";
    state.admin.dashboardDateTo = "";
    render();
  });
}

export function renderReports(view) {
  const reportTypes = [
    { value: "vendas", label: "Relatorio de vendas", note: "Propostas enviadas e aprovadas no periodo." },
    { value: "acompanhamento", label: "Acompanhamento de pedidos", note: "Pedidos, status, entrega prevista, industria e nota fiscal." },
    { value: "bonificacoes", label: "Bonificacoes", note: "Pedidos com natureza da operacao bonificacao." },
    { value: "produtos", label: "Produtos vendidos", note: "Produtos com venda/saida, quantidade, preco medio e total." },
    { value: "prazo_pagamento", label: "Prazo de pagamento", note: "Prazo medio negociado por condicao comercial." },
    { value: "fechamento_representante", label: "Fechamento por representante", note: "Resumo mensal/comercial por representante." },
  ];
  const current = reportTypes.find((item) => item.value === state.admin.reportType) || reportTypes[0];
  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "reportsPanel",
        span: "span-12",
        eyebrow: "Relatorios",
        title: "Central de relatorios em PDF",
        body: `
          <form class="dashboard-filter-panel reports-filter-panel" id="reportsForm">
            <label class="span-2">
              Tipo de relatorio
              <select name="type" data-report-field="reportType">
                ${reportTypes.map((item) => `<option value="${safe(item.value)}" ${state.admin.reportType === item.value ? "selected" : ""}>${safe(item.label)}</option>`).join("")}
              </select>
            </label>
            <label>
              De
              <input type="date" name="date_from" data-report-field="reportDateFrom" value="${safe(state.admin.reportDateFrom || "")}" />
            </label>
            <label>
              Ate
              <input type="date" name="date_to" data-report-field="reportDateTo" value="${safe(state.admin.reportDateTo || "")}" />
            </label>
            <label>
              Representante
              <select name="seller_id" data-report-field="reportSellerId">
                <option value="">Todos</option>
                ${sellerOptions(state.admin.reportSellerId)}
              </select>
            </label>
            <label>
              Empresa
              <select name="company_id" data-report-field="reportCompanyId">
                <option value="">Todas</option>
                ${companyOptions(state.admin.reportCompanyId)}
              </select>
            </label>
            <label>
              Cliente
              <select name="customer_id" data-report-field="reportCustomerId">
                <option value="">Todos</option>
                ${customerOptions(state.admin.reportCustomerId)}
              </select>
            </label>
            <label>
              Status
              <select name="status" data-report-field="reportStatus">
                <option value="">Todos</option>
                ${Object.entries(statusMeta).map(([value]) => {
                  const meta = statusInfo(value);
                  return `<option value="${safe(value)}" ${state.admin.reportStatus === value ? "selected" : ""}>${safe(meta.name)}</option>`;
                }).join("")}
              </select>
            </label>
            <div class="dashboard-filter-actions reports-actions">
              <button type="button" class="secondary icon-text-btn" data-report-reset>${uiIcons.close}<span>Limpar</span></button>
              <button type="submit" class="icon-text-btn">${uiIcons.pdf}<span>Gerar PDF</span></button>
            </div>
          </form>
          <div class="reports-info-card">
            <span>${safe(current.label)}</span>
            <strong>${safe(current.note)}</strong>
            <p>O PDF abre em uma nova aba para visualizacao, impressao ou compartilhamento.</p>
          </div>
          <div class="reports-grid">
            ${reportTypes.map((item) => `
              <button type="button" class="report-type-card ${item.value === state.admin.reportType ? "active" : ""}" data-report-type="${safe(item.value)}">
                <span>${uiIcons.file}</span>
                <strong>${safe(item.label)}</strong>
                <small>${safe(item.note)}</small>
              </button>
            `).join("")}
          </div>
        `,
      })}
    </div>
  `;
  wireReports(view);
}

export function wireReports(view) {
  const syncStateFromForm = () => {
    view.querySelectorAll("[data-report-field]").forEach((field) => {
      state.admin[field.dataset.reportField] = field.value || "";
    });
  };
  view.querySelectorAll("[data-report-field]").forEach((field) => {
    field.addEventListener("change", () => {
      syncStateFromForm();
      render();
    });
  });
  view.querySelectorAll("[data-report-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.admin.reportType = button.dataset.reportType;
      render();
    });
  });
  view.querySelector("[data-report-reset]")?.addEventListener("click", () => {
    state.admin.reportDateFrom = "";
    state.admin.reportDateTo = "";
    state.admin.reportSellerId = "";
    state.admin.reportCompanyId = "";
    state.admin.reportCustomerId = "";
    state.admin.reportStatus = "";
    render();
  });
  view.querySelector("#reportsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    syncStateFromForm();
    const params = new URLSearchParams();
    params.set("type", state.admin.reportType || "vendas");
    [
      ["date_from", state.admin.reportDateFrom],
      ["date_to", state.admin.reportDateTo],
      ["seller_id", state.admin.reportSellerId],
      ["company_id", state.admin.reportCompanyId],
      ["customer_id", state.admin.reportCustomerId],
      ["status", state.admin.reportStatus],
    ].forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    window.open(`/api/admin/reports/pdf?${params.toString()}`, "_blank", "noopener");
  });
}

export function goalNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value || 0);
  return number.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function renderGoalProgress(goal, type = "money") {
  if (!goal?.enabled) return `<span class="badge">Sem meta</span>`;
  const missingText = type === "money"
    ? money(goal.missing)
    : type === "percent"
      ? `${goalNumber(goal.missing)}%`
      : String(Math.max(0, Math.round(Number(goal.missing || 0))));
  return `<span class="badge ${Number(goal.missing || 0) <= 0 ? "ok" : "warn"}">${safe(Math.round(Number(goal.percent || 0)))}% feito | falta ${safe(missingText)}</span>`;
}

export function renderGoals(view) {
  const data = state.admin.goals || { rows: [] };
  const rows = data.rows || [];
  const month = String(data.month || state.admin.goalsMonth || "").padStart(2, "0");
  const year = String(data.year || state.admin.goalsYear || "");
  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "goalsPanel",
        span: "span-12",
        eyebrow: "Metas",
        title: "Metas comerciais",
        body: `
          <form class="settings-form goals-form" id="goalsForm">
            <div class="dashboard-filter-panel goals-filter-panel">
              <label>
                Mês
                <select name="month" data-goals-month>
                  ${activityMonthOptions(month)}
                </select>
              </label>
              <label>
                Ano
                <select name="year" data-goals-year>
                  ${activityYearOptions(state.orders || [], year)}
                </select>
              </label>
              <div class="dashboard-filter-actions">
                <button type="button" class="secondary icon-text-btn" data-goals-load>${uiIcons.search}<span>Consultar</span></button>
                <button type="submit" class="icon-text-btn">${uiIcons.check}<span>Salvar metas</span></button>
              </div>
            </div>
            <p class="lead">Deixe um campo vazio para indicar que o representante não terá meta naquele indicador no mês selecionado.</p>
            <div class="table-shell goals-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Representante</th>
                    <th>Em propostas (R$)</th>
                    <th>Novos clientes</th>
                    <th>Positivação clientes (%)</th>
                    <th>Andamento</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(({ seller, goals }) => `
                    <tr>
                      <td>
                        <strong>${safe(seller.name)}</strong>
                        <small>${safe(seller.communication_email || seller.email || "")}</small>
                      </td>
                      <td><input name="sales_goal_${safe(seller.id)}" inputmode="decimal" placeholder="150.000,00" value="${safe(goalNumber(goals.sales.goal))}" /></td>
                      <td><input name="new_customers_goal_${safe(seller.id)}" inputmode="numeric" placeholder="0" value="${goals.new_customers.enabled ? safe(Math.round(Number(goals.new_customers.goal || 0))) : ""}" /></td>
                      <td><input name="customer_positivation_goal_${safe(seller.id)}" inputmode="decimal" placeholder="50,00" value="${goals.customer_positivation.enabled ? safe(goalNumber(goals.customer_positivation.goal)) : ""}" /></td>
                      <td>
                        <div class="goals-progress-stack">
                          ${renderGoalProgress(goals.sales, "money")}
                          ${renderGoalProgress(goals.new_customers, "count")}
                          ${renderGoalProgress(goals.customer_positivation, "percent")}
                        </div>
                      </td>
                    </tr>
                  `).join("") || `<tr><td colspan="5">Nenhum representante comercial encontrado.</td></tr>`}
                </tbody>
              </table>
            </div>
            <p class="field-help">Cobranças automáticas: dias ${(data.reminder_days || []).join(", ")} de cada mês, somente para representantes com meta cadastrada.</p>
          </form>
        `,
      })}
    </div>
  `;
  wireGoals(view);
}

export function wireGoals(view) {
  const load = async () => {
    state.admin.goalsMonth = view.querySelector("[data-goals-month]")?.value || state.admin.goalsMonth;
    state.admin.goalsYear = view.querySelector("[data-goals-year]")?.value || state.admin.goalsYear;
    await loadAdminGoals();
    render();
  };
  view.querySelector("[data-goals-load]")?.addEventListener("click", load);
  view.querySelector("#goalsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const month = form.querySelector("[data-goals-month]")?.value || state.admin.goalsMonth;
    const year = form.querySelector("[data-goals-year]")?.value || state.admin.goalsYear;
    const goals = (state.admin.goals?.rows || []).map(({ seller }) => ({
      seller_id: seller.id,
      sales_goal: form.querySelector(`[name="sales_goal_${CSS.escape(String(seller.id))}"]`)?.value || "",
      new_customers_goal: form.querySelector(`[name="new_customers_goal_${CSS.escape(String(seller.id))}"]`)?.value || "",
      customer_positivation_goal: form.querySelector(`[name="customer_positivation_goal_${CSS.escape(String(seller.id))}"]`)?.value || "",
    }));
    try {
      const result = await api("/api/admin/goals", {
        method: "POST",
        body: JSON.stringify({ year, month, goals }),
      });
      state.admin.goalsMonth = month;
      state.admin.goalsYear = year;
      await loadAdminGoals();
      setFlash(result.message);
    } catch (error) {
      setFlash("", error.message);
    }
  });
}
