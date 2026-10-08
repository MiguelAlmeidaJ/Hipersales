import {
  renderOutboxTable,
  renderProductsTable,
  submitAdminCustomer,
  submitCompany,
  submitProduct,
  updateRequestStatus,
  wireCustomerAutofill,
} from "./catalog.js";

import {
  pendingRequestCount,
  pendingRequests,
  renderUsersTable,
  wireUsers,
} from "./modals.js";

import {
  renderAdmin,
  renderSettingsModalShell,
} from "./settings.js";

import {
  api,
  setFlash,
} from "../core/api.js";

import {
  render,
} from "../core/shell.js";

import {
  paginateItems,
  state,
} from "../core/state.js";

import {
  buildOptions,
  companyOptions,
  customerOptions,
  date,
  isAdmin,
  isBonusOrderType,
  metricCard,
  money,
  parseCurrencyValue,
  parsePercentValue,
  paymentTermsOptions,
  proposalStatusBadge,
  renderPagination,
  requestStatusBadge,
  safe,
  searchActionField,
  sectionBand,
  softStatusColor,
  statusInfo,
  statusOptions,
  syncCurrencyInput,
  taxOperatorOptions,
  uiIcons,
  wireSearchSubmit,
} from "../core/ui.js";

import {
  customerFields,
} from "../features/customer-requests.js";

import {
  addProposalItem,
  drawProposalItemsTable,
  getProposalById,
  loadProposalProducts,
  proposalNumber,
  proposalTotal,
  submitAdminOrder,
  wireProposalOrderControls,
} from "../features/proposals.js";

export function legacyRenderAdmin(view) {
  view.innerHTML = `
    <section class="section-band span-12">
      <header class="section-head">
        <div>
          <p class="eyebrow">Configuracoes</p>
          <h2>Painel de parametros gerais</h2>
        </div>
      </header>
      <div class="section-body">
        <p class="lead">
          As operacoes principais ficam na lateral. Aqui vamos manter apenas ajustes gerais e futuras configuracoes do sistema.
        </p>
        <div class="admin-notes">
          <div class="admin-note">
            <strong>Fluxo</strong>
            <span>Pedidos, clientes e produtos ficam na lateral.</span>
          </div>
          <div class="admin-note">
            <strong>Usuarios</strong>
            <span>Cadastro de representante comercial ou administrador.</span>
          </div>
          <div class="admin-note">
            <strong>Base</strong>
            <span>Banco central para clientes, produtos e status.</span>
          </div>
        </div>
      </div>
    </section>
  `;
  return;

  const overview = state.admin.overview?.summary || {};
  const statusCounts = state.admin.overview?.status_counts || {};
  const filteredProducts = state.admin.productFilterCompanyId
    ? state.admin.products.filter((product) => String(product.company_id) === String(state.admin.productFilterCompanyId))
    : state.admin.products;

  const statusOrder = ["em_analise", "pedido_aprovado", "recusado", "em_producao", "faturado", "entregue"];
  const statusStrip = statusOrder
    .filter((status) => statusCounts[status] !== undefined)
    .map(
      (status) => {
        const meta = statusInfo(status);
        return `
        <span class="mini-stat status-mini-stat" style="--status-color:${safe(meta.color)};--status-soft:${safe(softStatusColor(meta.color))};">
          <strong>${safe(statusCounts[status])}</strong>
          <small>${safe(meta.name)}</small>
        </span>
      `;
      }
    )
    .join("");

  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "heroPanel",
        span: "span-12",
        eyebrow: "Painel administrador",
        title: "Cadastro de base, pedidos e status em um unico lugar",
        action: `
          <button type="button" class="secondary jump-btn" data-jump="customerPanel">Clientes</button>
          <button type="button" class="secondary jump-btn" data-jump="catalogPanel">Catalogo</button>
          <button type="button" class="secondary jump-btn" data-jump="requestPanel">Solicitacoes</button>
          <button type="button" class="secondary jump-btn" data-jump="proposalPanel">Pedidos</button>
          <button type="button" class="secondary" data-route="users">Usuarios</button>
        `,
        body: `
          <div class="hero-admin">
            <div class="hero-brand">
              <img class="hero-logo" src="/assets/logoweb.png" alt="Hipersales Web" />
              <p class="lead">
                Thalles e Bruna controlam a retaguarda. Tudo que entra no painel volta para o banco:
                clientes, empresas, produtos, usuários, associacoes e status.
              </p>
            </div>
            <div class="status-strip">
              ${statusStrip || `<span class="mini-stat"><strong>0</strong><small>Sem propostas ainda</small></span>`}
            </div>
          </div>
        `,
      })}

      <section class="kpi-grid span-12">
        ${metricCard("Usuarios", overview.users || 0, `${overview.admins || 0} admin + ${overview.sellers || 0} representantes comerciais`, "blue")}
        ${metricCard("Empresas", overview.companies || 0, "Industriais ativas", "teal")}
        ${metricCard("Produtos", overview.products || 0, "Catalogo vinculado a empresa", "green")}
        ${metricCard("Clientes", overview.customers || 0, "Base liberada para venda", "gold")}
        ${metricCard("Associacoes", overview.associations || 0, "Representante comercial x cliente", "blue")}
        ${metricCard("Propostas", overview.proposals || 0, "Em fluxo de aprovacao", "teal")}
        ${metricCard("Pedidos aprovados", overview.approved_orders || 0, "Viraram pedido", "green")}
        ${metricCard("Pendencias", overview.pending_requests || 0, "Solicitacoes aguardando validacao", "gold")}
      </section>

      ${sectionBand({
        id: "customerPanel",
        span: "span-6",
        eyebrow: "Clientes",
        title: "Cadastro e associacao",
        body: `
          <div class="stack">
            <form class="form-grid two" id="adminCustomerForm">
              ${customerFields()}
              <label class="span-2">
                Observacoes
                <textarea name="notes"></textarea>
              </label>
              <div class="form-actions span-2">
                <button type="submit">Cadastrar cliente</button>
              </div>
            </form>
            <div class="table-shell compact">
              <table>
                <thead>
                  <tr>
                    <th>Razao social</th>
                    <th>Fantasia</th>
                    <th>CNPJ</th>
                    <th>Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.common.customers
                    .map(
                      (customer) => `
                        <tr>
                          <td>${safe(customer.legal_name)}</td>
                          <td>${safe(customer.trade_name || "")}</td>
                          <td>${safe(customer.cnpj)}</td>
                          <td>${safe(customer.phone || "")}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            <p class="lead">A associacao representante comercial x cliente fica na area de Usuarios.</p>
          </div>
        `,
      })}

      ${sectionBand({
        id: "catalogPanel",
        span: "span-6",
        eyebrow: "Catalogo",
        title: "Empresas e produtos",
        body: `
          <div class="stack">
            <form class="form-grid two" id="companyForm">
              <label>
                Nome da empresa
                <input name="name" required />
              </label>
              <label>
                Razao social
                <input name="legal_name" />
              </label>
              <div class="form-actions span-2">
                <button type="submit">Cadastrar empresa</button>
              </div>
            </form>
            <div class="table-shell compact">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Razao social</th>
                    <th>Produtos</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.admin.companies
                    .map(
                      (company) => `
                        <tr>
                          <td>${safe(company.name)}</td>
                          <td>${safe(company.legal_name || "")}</td>
                          <td>${safe(company.product_count || 0)}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            <form class="form-grid two" id="productForm">
              <label>
                Empresa
                <select name="company_id" required>
                  <option value="">Selecione</option>
                  ${companyOptions()}
                </select>
              </label>
              <label>
                Codigo
                <input name="code" required />
              </label>
              <label>
                Nome do produto
                <input name="name" required />
              </label>
              <label>
                Unidade
                <input name="unit" value="UN" />
              </label>
              <label>
                Preco base
                <input name="price" type="number" min="0" step="0.01" value="0" />
              </label>
              <div class="form-actions span-2">
                <button type="submit">Cadastrar produto</button>
              </div>
            </form>
            <div class="form-grid two">
              <label>
                Filtrar produtos por empresa
                <select id="productFilter">
                  <option value="">Todas</option>
                  ${companyOptions(state.admin.productFilterCompanyId)}
                </select>
              </label>
            </div>
            <div class="table-shell compact">
              ${renderProductsTable(filteredProducts)}
            </div>
          </div>
        `,
      })}

      ${sectionBand({
        id: "requestPanel",
        span: "span-8",
        eyebrow: "Solicitacoes",
        title: "Cadastro de cliente vindo do representante comercial",
        action: `${pendingRequestCount() > 0 ? `<button type="button" class="secondary" data-go-customers-approvals>Clientes pendentes (${safe(pendingRequestCount())})</button>` : ""}`,
        body: `
          <div class="products-summary">
            <span class="badge brand">${safe(pendingRequestCount())} pendentes</span>
            <span class="badge ${pendingRequestCount() ? "danger" : "ok"}">${safe(state.admin.requests.length)} total</span>
          </div>
          <div class="request-panel-shell">
            ${pendingRequestCount() ? renderRequestsTable(pendingRequests(), false) : `<p class="empty-state">Nenhum cliente aguardando aprovacao.</p>`}
          </div>
        `,
      })}

      ${sectionBand({
        id: "proposalPanel",
        span: "span-12",
        eyebrow: "Pedidos",
        title: "Propostas enviadas e aprovacao de status",
        body: `
          <div class="table-shell">
            ${renderProposalsTable(state.admin.proposals, true)}
          </div>
        `,
      })}

      ${sectionBand({
        id: "outboxPanel",
        span: "span-12",
        eyebrow: "Logs",
        title: "Copias de e-mail geradas pelo sistema",
        body: `
          <div class="table-shell">
            ${renderOutboxTable(state.admin.outbox)}
          </div>
        `,
      })}
    </div>
  `;

  document.querySelectorAll(".jump-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.jump);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const companyForm = document.querySelector("#companyForm");
  if (companyForm) {
    companyForm.addEventListener("submit", submitCompany);
  }

  const productForm = document.querySelector("#productForm");
  if (productForm) {
    productForm.addEventListener("submit", submitProduct);
  }

  const customerForm = document.querySelector("#adminCustomerForm");
  if (customerForm) {
    customerForm.addEventListener("submit", submitAdminCustomer);
    wireCustomerAutofill(customerForm);
  }

  const filter = document.querySelector("#productFilter");
  if (filter) {
    filter.addEventListener("change", () => {
      state.admin.productFilterCompanyId = filter.value;
      renderAdmin(view);
    });
  }

  document.querySelectorAll("[data-request-status]").forEach((button) => {
    button.addEventListener("click", () => updateRequestStatus(button.dataset.requestId, button.dataset.requestStatus));
  });

  wireProposalOrderControls(document);
}

export function orderAdminPayload(root, proposalId) {
  const escapedId = CSS.escape(String(proposalId));
  const statusField = root.querySelector(`[data-proposal-id="${escapedId}"][data-proposal-status]`);
  const originalStatus = statusField?.closest("[data-original-status]")?.dataset.originalStatus || "";
  const payload = {};
  if (statusField) {
    const currentStatus = statusField.value || "em_analise";
    if (!originalStatus || currentStatus !== originalStatus) {
      payload.status = currentStatus;
    }
  }
  const deliveryForecast = root.querySelector(`[data-delivery-forecast="${escapedId}"]`);
  const industryOrderNumber = root.querySelector(`[data-industry-order-number="${escapedId}"]`);
  const invoiceNumber = root.querySelector(`[data-invoice-number="${escapedId}"]`);
  const invoiceType = root.querySelector(`[data-invoice-type="${escapedId}"]`);
  const taxOperatorInvoice = root.querySelector(`[data-proposal-tax-operator-invoice="${escapedId}"]`);
  const orderType = root.querySelector(`[data-proposal-order-type="${escapedId}"]`);
  const freightType = root.querySelector(`[data-proposal-freight-type="${escapedId}"]`);
  const deliveryType = root.querySelector(`[data-proposal-delivery-type="${escapedId}"]`);
  const scheduledDeliveryDate = root.querySelector(`[data-proposal-scheduled-delivery-date="${escapedId}"]`);
  const purchaseOrder = root.querySelector(`[data-proposal-purchase-order="${escapedId}"]`);
  const paymentTerms = root.querySelector(`[data-proposal-payment-terms="${escapedId}"]`);
  const discountPercent = root.querySelector(`[data-proposal-discount-percent="${escapedId}"]`);
  const discountOn = root.querySelector(`[data-proposal-discount-on="${escapedId}"]`);
  const commissionPercent = root.querySelector(`[data-proposal-commission-percent="${escapedId}"]`);
  const notes = root.querySelector(`[data-proposal-notes="${escapedId}"]`);
  if (deliveryForecast) payload.delivery_forecast = deliveryForecast.value || "";
  if (industryOrderNumber) payload.industry_order_number = industryOrderNumber.value?.trim() || "";
  if (invoiceNumber) payload.invoice_number = invoiceNumber.value?.trim() || "";
  if (invoiceType) payload.invoice_type = invoiceType.value || "";
  if (taxOperatorInvoice) payload.tax_operator_invoice = taxOperatorInvoice.value || "0";
  if (orderType) payload.order_type = orderType.value || "";
  if (freightType) payload.freight_type = freightType.value || "";
  if (deliveryType) payload.delivery_type = deliveryType.value || "";
  if (scheduledDeliveryDate && !scheduledDeliveryDate.disabled) payload.scheduled_delivery_date = scheduledDeliveryDate.value || "";
  if (purchaseOrder) payload.purchase_order = purchaseOrder.value?.trim() || "";
  const existingProposal = getProposalById(proposalId);
  const effectiveOrderType = payload.order_type || existingProposal?.order_type || "";
  if (paymentTerms) payload.payment_terms = isBonusOrderType(effectiveOrderType) ? "" : (paymentTerms.value || "");
  if (discountPercent) payload.discount_percent = parsePercentValue(discountPercent.value);
  if (discountOn) payload.discount_on = discountOn.value || "";
  if (commissionPercent) payload.commission_percent = parsePercentValue(commissionPercent.value);
  if (isBonusOrderType(effectiveOrderType)) {
    payload.payment_terms = "";
    payload.discount_percent = 0;
    payload.discount_on = "Sem descontos";
    payload.commission_percent = 0;
  }
  if (notes) payload.notes = notes.value || "";
  if (root.querySelector("[data-admin-add-product]")) {
    payload.items = state.admin.proposalEditItems.map((item) => ({
      product_id: Number(item.product_id || item.id),
      quantity: Number(item.quantity),
      negotiated_price: Number(item.negotiated_price),
    }));
  }
  return payload;
}

export function preserveProposalAdminDraft(root, proposalId) {
  const proposal = getProposalById(proposalId);
  if (!proposal) return;
  const payload = orderAdminPayload(root, proposalId);
  delete payload.items;
  Object.assign(proposal, payload);
}

export function syncProposalViewDeliveryDate(root) {
  root.querySelectorAll("[data-proposal-delivery-type]").forEach((select) => {
    const proposalId = select.dataset.proposalDeliveryType;
    if (!proposalId) return;
    const escapedId = CSS.escape(String(proposalId));
    const scheduledDate = root.querySelector(`[data-proposal-scheduled-delivery-date="${escapedId}"]`);
    if (!scheduledDate) return;
    const enabled = select.value === "Entrega Programada";
    scheduledDate.disabled = !enabled;
  });
}

export function syncProposalViewPaymentTerms(root) {
  root.querySelectorAll("[data-proposal-order-type]").forEach((select) => {
    const proposalId = select.dataset.proposalOrderType;
    if (!proposalId) return;
    const escapedId = CSS.escape(String(proposalId));
    const paymentTerms = root.querySelector(`[data-proposal-payment-terms="${escapedId}"]`);
    const discountPercent = root.querySelector(`[data-proposal-discount-percent="${escapedId}"]`);
    const discountOn = root.querySelector(`[data-proposal-discount-on="${escapedId}"]`);
    const commissionPercent = root.querySelector(`[data-proposal-commission-percent="${escapedId}"]`);
    if (!paymentTerms) return;
    const isBonus = isBonusOrderType(select.value);
    paymentTerms.disabled = isBonus;
    paymentTerms.required = !isBonus;
    if (discountPercent) discountPercent.disabled = isBonus;
    if (discountOn) discountOn.disabled = isBonus;
    if (commissionPercent) commissionPercent.disabled = isBonus;
    if (isBonus) {
      paymentTerms.value = "";
      if (discountPercent) discountPercent.value = "0,00%";
      if (discountOn) discountOn.value = "Sem descontos";
      if (commissionPercent) commissionPercent.value = "0,00%";
    } else if (!paymentTerms.value) {
      paymentTerms.value = "Pagamento Antecipado";
    }
  });
}

export function syncPaymentTermsForOrderType(root, orderSelector = "[name='order_type']", paymentSelector = "[name='payment_terms']") {
  const orderType = root.querySelector(orderSelector);
  const paymentTerms = root.querySelector(paymentSelector);
  if (!orderType || !paymentTerms) return;
  const discountPercent = root.querySelector("[name='discount_percent']");
  const discountOn = root.querySelector("[name='discount_on']");
  const commissionPercent = root.querySelector("[name='commission_percent']");
  const isBonus = isBonusOrderType(orderType.value);
  paymentTerms.disabled = isBonus;
  paymentTerms.required = !isBonus;
  if (discountPercent) discountPercent.disabled = isBonus;
  if (discountOn) discountOn.disabled = isBonus;
  if (commissionPercent) commissionPercent.disabled = isBonus;
  if (isBonus) {
    paymentTerms.value = "";
    if (discountPercent) discountPercent.value = "0,00%";
    if (discountOn) discountOn.value = "Sem descontos";
    if (commissionPercent) commissionPercent.value = "0,00%";
    state.proposalDraft.paymentTerms = "";
    state.proposalDraft.discountPercent = "0,00%";
    state.proposalDraft.discountOn = "Sem descontos";
    state.proposalDraft.commissionPercent = "0,00%";
  } else if (!paymentTerms.value) {
    paymentTerms.value = "Pagamento Antecipado";
    state.proposalDraft.paymentTerms = paymentTerms.value;
  }
}

export function renderUsers(view) {
  const search = String(state.admin.userSearch || "").trim().toLowerCase();
  const users = state.admin.users.filter((user) => {
    if (!search) return true;
    return [user.name, user.email, user.communication_email, user.whatsapp_phone, user.role, user.active ? "ativo" : "inativo"]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  const usersPagination = paginateItems("adminUsers", users);
  const sellers = state.admin.users.filter((user) => user.role === "seller");
  const selectedSellerId = String(state.admin.customerAssignmentSellerId || sellers[0]?.id || "");
  const selectedSeller = sellers.find((user) => String(user.id) === selectedSellerId) || null;
  const assignments = state.admin.customerAssignments || [];
  const companyAssignments = state.admin.companyAssignments || [];

  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "usersPanel",
        span: "span-12",
        eyebrow: "Usuarios",
        title: "Cadastro leve e controle de acesso",
        action: `
          <button type="button" data-open-user-modal="create">Novo usuario</button>
        `,
        body: `
          <div class="users-toolbar">
            <p class="lead">
              Acessos internos com busca rapida, edicao, ativacao e senha temporaria.
            </p>
            <label class="users-search">
              Buscar usuario
              ${searchActionField(`<input name="user_search" type="search" value="${safe(state.admin.userSearch || "")}" placeholder="Nome, usuario ou perfil" data-user-search />`)}
            </label>
          </div>
          <div class="users-list-shell">
            ${renderUsersTable(usersPagination.items)}
          </div>
          ${renderPagination("adminUsers", usersPagination)}
        `,
      })}

      ${sectionBand({
        id: "sellerCustomerPanel",
        span: "span-12",
        eyebrow: "Carteira",
        title: "Clientes do representante comercial",
        body: `
          ${sellers.length
            ? `
              <div class="assignment-overview">
                <div class="users-toolbar assignment-toolbar">
                  <p class="lead">
                    A carteira agora fica resumida. Abra o modal para buscar e vincular clientes sem ocupar a tela toda.
                  </p>
                  <div class="assignment-toolbar-controls compact">
                    <label>
                      Representante comercial
                      <select data-customer-assignment-seller>
                        ${buildOptions(sellers, selectedSellerId, (user) => user.id, (user) => `${user.name} (${user.email})`)}
                      </select>
                    </label>
                    <div class="assignment-toolbar-actions">
                      <button type="button" class="secondary" data-open-assignment-modal>Gerenciar carteira</button>
                    </div>
                  </div>
                </div>
                <div class="products-summary">
                  <span class="badge brand">${safe(assignments.length)} na base</span>
                  <span class="badge ok">${safe(assignments.filter((customer) => customer.assigned).length)} vinculados</span>
                  <span class="badge danger">${safe(assignments.filter((customer) => !customer.assigned).length)} disponiveis</span>
                  ${selectedSeller ? `<span class="badge">${safe(selectedSeller.name)}</span>` : ""}
                </div>
                <div class="assignment-preview">
                  ${
                    assignments
                      .filter((customer) => customer.assigned)
                      .slice(0, 6)
                      .map(
                        (customer) => `
                          <span class="assignment-chip ${customer.active ? "" : "muted"}">${safe(customer.legal_name)}</span>
                        `
                      )
                      .join("") || `<p class="empty-state compact">Nenhum cliente vinculado ainda.</p>`
                  }
                  ${
                    assignments.filter((customer) => customer.assigned).length > 6
                      ? `<span class="assignment-chip count">+${safe(assignments.filter((customer) => customer.assigned).length - 6)} clientes</span>`
                      : ""
                  }
                </div>
              </div>
            `
            : `<p class="empty-state">Cadastre ao menos um representante comercial para montar a carteira de clientes.</p>`}
        `,
      })}

      ${sectionBand({
        id: "sellerCompanyPanel",
        span: "span-12",
        eyebrow: "Empresas",
        title: "Empresas do representante comercial",
        body: `
          ${sellers.length
            ? `
              <div class="assignment-overview">
                <div class="users-toolbar assignment-toolbar">
                  <p class="lead">
                    Defina quais empresas e respectivos produtos ficam disponíveis para cada representante comercial.
                  </p>
                  <div class="assignment-toolbar-controls compact">
                    <label>
                      Representante comercial
                      <select data-company-assignment-seller>
                        ${buildOptions(sellers, selectedSellerId, (user) => user.id, (user) => `${user.name} (${user.email})`)}
                      </select>
                    </label>
                    <div class="assignment-toolbar-actions">
                      <button type="button" class="secondary" data-open-company-assignment-modal>Gerenciar empresas</button>
                    </div>
                  </div>
                </div>
                <div class="products-summary">
                  <span class="badge brand">${safe(companyAssignments.length)} na base</span>
                  <span class="badge ok">${safe(companyAssignments.filter((company) => company.assigned).length)} vinculadas</span>
                  <span class="badge danger">${safe(companyAssignments.filter((company) => !company.assigned).length)} disponíveis</span>
                  ${selectedSeller ? `<span class="badge">${safe(selectedSeller.name)}</span>` : ""}
                </div>
                <div class="assignment-preview">
                  ${
                    companyAssignments
                      .filter((company) => company.assigned)
                      .slice(0, 6)
                      .map((company) => `<span class="assignment-chip ${company.active ? "" : "muted"}">${safe(company.name)}</span>`)
                      .join("") || `<p class="empty-state compact">Nenhuma empresa vinculada ainda.</p>`
                  }
                  ${companyAssignments.filter((company) => company.assigned).length > 6
                    ? `<span class="assignment-chip count">+${safe(companyAssignments.filter((company) => company.assigned).length - 6)} empresas</span>`
                    : ""}
                </div>
              </div>
            `
            : `<p class="empty-state">Cadastre ao menos um representante comercial para associar empresas.</p>`}
        `,
      })}
    </div>
  `;
  wireUsers(view);
}

export function renderRequestsTable(requests, allowOpen = true) {
  if (!requests.length) {
    return `<p class="empty-state">Nenhuma solicitacao cadastrada.</p>`;
  }

  return `
    <div class="request-list">
      ${requests
        .map(
          (request) => `
            <${allowOpen ? "button" : "div"} ${allowOpen ? `type="button" data-open-request-modal="${safe(request.id)}"` : ""} class="request-card ${request.status === "pendente" ? "pending" : ""}">
              <div class="request-card-main">
                <div class="request-card-head">
                  <strong>${safe(request.legal_name)}</strong>
                  ${request.status === "pendente" ? '<span class="badge danger">Pendente</span>' : requestStatusBadge(request.status)}
                </div>
                <div class="request-card-meta">
                  <span>${safe(request.trade_name || "")}</span>
                  <span>${safe(request.cnpj)}</span>
                  <span>${safe(request.seller_name)}</span>
                  <span>${safe(date(request.created_at))}</span>
                </div>
              </div>
              <span class="request-info-chip" aria-hidden="true">i</span>
            </${allowOpen ? "button" : "div"}>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderOrderCreateModal() {
  if (!state.admin.activeOrderModal) {
    return "";
  }
  const sellers = state.admin.users.filter((user) => user.role === "seller" && user.active);
  return renderSettingsModalShell({
    modalKey: "orderCreateModal",
    eyebrow: "Pedidos",
    title: "Criar pedido pelo admin",
    wide: true,
    panelClass: "order-modal-panel",
    body: `
      <form class="settings-modal-form admin-order-form" id="adminOrderForm">
        <section class="seller-order-card">
          <div class="seller-order-card-head">
            <span class="step-badge">1</span>
            <h3>Cliente, representante comercial e empresa</h3>
          </div>
          <div class="seller-order-grid">
            <label>
              Representante comercial
              <select name="seller_id" id="adminOrderSellerSelect" required>
                <option value="">Selecione</option>
                ${buildOptions(sellers, "", (seller) => seller.id, (seller) => `${seller.name} (${seller.email})`)}
              </select>
            </label>
            <label>
              Empresa
              <select name="company_id" id="companySelect" required disabled>
                <option value="">Selecione</option>
              </select>
            </label>
            <label class="span-2">
              Cliente
              <select name="customer_id" required>
                <option value="">Selecione</option>
                ${customerOptions()}
              </select>
            </label>
            <label class="span-2">
              Nota Fiscal via Operador Fiscal?
              <select name="tax_operator_invoice" required>
                ${taxOperatorOptions.map((option) => `<option value="${safe(option.value)}">${safe(option.label)}</option>`).join("")}
              </select>
              <span class="field-help">Se for faturar a Nota Fiscal através de um Operador Fiscal, informe no campo de observações qual será o operador desta venda.</span>
            </label>
            <label>
              Tipo
              <select name="order_type" required>
                <option value="Venda de Mercadoria">Venda de Mercadoria</option>
                <option value="Bonificacao">Bonificacao</option>
              </select>
            </label>
            <label>
              Pagamento
              <select name="payment_terms">
                <option value="">Sem pagamento</option>
                ${paymentTermsOptions.map((option) => `<option value="${safe(option)}">${safe(option)}</option>`).join("")}
              </select>
            </label>
          </div>
        </section>

        <section class="seller-order-card">
          <div class="seller-order-card-head">
            <span class="step-badge">2</span>
            <h3>Adicionar produto</h3>
          </div>
          <div class="seller-product-entry">
            <label class="product-picker product-picker-large">
              Produto
              ${searchActionField(`<input id="productSearch" type="text" autocomplete="off" placeholder="Digite o nome ou codigo" />`)}
              <input id="productSelect" type="hidden" value="" />
              <div class="product-suggestions" id="productSuggestions" hidden></div>
            </label>
            <label>
              Quantidade
              <input id="itemQty" type="number" min="0.01" step="0.01" inputmode="decimal" />
            </label>
            <label>
              Preco
              <input id="itemPrice" type="text" inputmode="numeric" autocomplete="off" value="0,00" data-currency-input />
            </label>
            <button type="button" id="addItemBtn">Adicionar</button>
          </div>
        </section>

        <section class="seller-order-card">
          <div class="seller-order-card-head">
            <span class="step-badge">3</span>
            <h3>Itens do pedido</h3>
          </div>
          <div class="proposal-items-shell" id="proposalItemsTable"></div>
        </section>

        <details class="seller-order-advanced">
          <summary>Mais detalhes do pedido</summary>
          <div class="seller-order-grid">
            <label>
              Ordem de compra
              <input name="purchase_order" />
            </label>
            <label>
              Comissao %
              <input name="commission_percent" type="text" inputmode="decimal" autocomplete="off" value="0,00%" data-percent-input />
            </label>
            <label>
              Nota fiscal
              <select name="invoice_type">
                <option value="Com nota cheia">Com nota cheia</option>
                <option value="Meia nota">Meia nota</option>
                <option value="Nota parcial">Nota parcial</option>
                <option value="Nota baixa">Nota baixa</option>
                <option value="Sem nota">Sem nota</option>
              </select>
            </label>
            <label>
              Frete
              <select name="freight_type">
                <option value="CIF pago pela industria">CIF pago pela industria</option>
                <option value="FOB pago pelo cliente">FOB pago pelo cliente</option>
              </select>
            </label>
            <label>
              Entrega
              <select name="delivery_type">
                <option value="Entrega imediata">Entrega imediata</option>
                <option value="Entrega programada">Entrega programada</option>
              </select>
            </label>
            <label>
              Data programada
              <input name="scheduled_delivery_date" type="date" />
            </label>
            <label>
              Desconto %
              <input name="discount_percent" type="text" inputmode="decimal" autocomplete="off" value="0,00%" data-percent-input />
            </label>
            <label>
              Desconto em
              <select name="discount_on">
                <option value="Sem descontos" selected>Sem descontos</option>
                <option value="Boleto Bancario">Boleto Bancario</option>
                <option value="Nota Fiscal">Nota Fiscal</option>
              </select>
            </label>
            <label class="span-2">
              Observacoes
              <textarea name="notes"></textarea>
            </label>
          </div>
        </details>

        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-order-modal>Cancelar</button>
          <button type="submit">Criar pedido</button>
        </div>
      </form>
    `,
  });
}

export function openOrderModal() {
  state.admin.activeOrderModal = { mode: "create" };
  state.admin.activeUserModal = null;
  state.admin.activeRequestModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeCompanyModal = null;
  state.admin.activeAssignmentModal = null;
  state.admin.activeProposalViewModal = null;
  state.proposalItems = [];
  state.proposalProducts = [];
  state.proposalSelectedProductId = "";
  render();
}

export function closeOrderModal() {
  state.admin.activeOrderModal = null;
  state.proposalItems = [];
  state.proposalProducts = [];
  state.proposalSelectedProductId = "";
  render();
}

export function openProposalViewModal(proposalId) {
  const proposal = getProposalById(proposalId);
  state.admin.activeProposalViewModal = String(proposalId);
  state.admin.proposalEditItems = (proposal?.items || []).map((item) => ({ ...item }));
  state.admin.activeOrderModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeRequestModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeCompanyModal = null;
  state.admin.activeAssignmentModal = null;
  render();
}

export function closeProposalViewModal() {
  state.admin.activeProposalViewModal = null;
  state.admin.proposalEditItems = [];
  render();
}

export function wireAdminOrderModal(modalRoot) {
  const form = modalRoot.querySelector("#adminOrderForm");
  if (!form) return;
  const sellerSelect = modalRoot.querySelector("#adminOrderSellerSelect");
  const companySelect = modalRoot.querySelector("#companySelect");
  const productSearch = modalRoot.querySelector("#productSearch");
  const productSelect = modalRoot.querySelector("#productSelect");
  const productSuggestions = modalRoot.querySelector("#productSuggestions");
  const itemPrice = modalRoot.querySelector("#itemPrice");

  const renderProductSuggestions = (term = "") => {
    if (!productSuggestions || !productSearch) return;
    const query = String(term || productSearch.value || "").trim().toLowerCase();
    const selectedId = String(state.proposalSelectedProductId || "");
    if (!state.proposalProducts.length || !companySelect.value) {
      productSuggestions.innerHTML = `<div class="product-suggestions-empty">Selecione uma empresa para liberar os produtos.</div>`;
      productSuggestions.hidden = false;
      return;
    }
    const ranked = state.proposalProducts
      .map((product) => {
        const haystack = `${product.code || ""} ${product.name || ""} ${product.unit || ""}`.toLowerCase();
        const code = String(product.code || "").toLowerCase();
        const name = String(product.name || "").toLowerCase();
        let score = 0;
        if (!query) score = 1;
        else if (code === query) score = 120;
        else if (code.startsWith(query)) score = 100;
        else if (name.startsWith(query)) score = 95;
        else if (name.includes(query)) score = 80;
        else if (haystack.includes(query)) score = 55;
        return { product, score };
      })
      .filter((entry) => (query ? entry.score > 0 : true))
      .sort((a, b) => b.score - a.score || String(a.product.name).localeCompare(String(b.product.name)))
      .slice(0, 8)
      .map((entry) => entry.product);
    productSuggestions.innerHTML = ranked.length
      ? ranked
          .map((product) => {
            const active = String(product.id) === selectedId ? "is-selected" : "";
            return `
              <button type="button" class="product-suggestion ${active}" data-product-id="${safe(product.id)}">
                <strong>${safe(product.code)} - ${safe(product.name)}</strong>
                <span>${safe(product.unit || "UN")} • ${safe(money(product.price))}</span>
              </button>
            `;
          })
          .join("")
      : `<div class="product-suggestions-empty">Nenhum produto encontrado.</div>`;
    productSuggestions.hidden = false;
  };

  const chooseProduct = (productId) => {
    const product = state.proposalProducts.find((entry) => String(entry.id) === String(productId));
    if (!product) return;
    state.proposalSelectedProductId = String(product.id);
    productSelect.value = String(product.id);
    productSearch.value = `${product.code} - ${product.name}`;
    itemPrice.dataset.currencyRaw = String(Math.max(0, Math.round(parseCurrencyValue(product.price) * 100)));
    syncCurrencyInput(itemPrice);
    productSuggestions.hidden = true;
    productSuggestions.innerHTML = "";
    productSearch.blur();
  };

  const resetAdminProductPick = () => {
    state.proposalProducts = [];
    state.proposalSelectedProductId = "";
    if (productSelect) productSelect.value = "";
    if (productSearch) productSearch.value = "";
    if (productSuggestions) {
      productSuggestions.hidden = true;
      productSuggestions.innerHTML = "";
    }
    if (itemPrice) {
      delete itemPrice.dataset.currencyRaw;
      itemPrice.value = "0,00";
    }
  };

  sellerSelect?.addEventListener("change", async () => {
    resetAdminProductPick();
    if (!companySelect) return;
    companySelect.innerHTML = '<option value="">Carregando empresas...</option>';
    companySelect.disabled = true;
    if (!sellerSelect.value) {
      companySelect.innerHTML = '<option value="">Selecione</option>';
      return;
    }
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(sellerSelect.value)}/companies`);
      const companies = (result.companies || []).filter((company) => company.active && company.assigned);
      companySelect.innerHTML = '<option value="">Selecione</option>' + buildOptions(companies, "", (company) => company.id, (company) => company.name);
      companySelect.disabled = companies.length === 0;
      if (!companies.length) {
        setFlash("", "Esse representante comercial ainda nao tem empresas vinculadas.");
      }
    } catch (error) {
      companySelect.innerHTML = '<option value="">Selecione</option>';
      setFlash("", error.message);
    }
  });

  companySelect?.addEventListener("change", async () => {
    resetAdminProductPick();
    await loadProposalProducts(companySelect.value);
  });
  syncPaymentTermsForOrderType(form);
  form.querySelector("[name='order_type']")?.addEventListener("change", () => syncPaymentTermsForOrderType(form));
  wireSearchSubmit(modalRoot, "#productSearch", () => {
    state.proposalSelectedProductId = "";
    productSelect.value = "";
    delete itemPrice.dataset.currencyRaw;
    itemPrice.value = "0,00";
    renderProductSuggestions(productSearch.value);
  });
  productSearch?.addEventListener("change", () => {
    const selected = state.proposalProducts.find((entry) => String(entry.id) === String(productSelect.value));
    if (!selected || productSearch.value !== `${selected.code} - ${selected.name}`) {
      state.proposalSelectedProductId = "";
      productSelect.value = "";
      delete itemPrice.dataset.currencyRaw;
      itemPrice.value = "0,00";
    }
  });
  productSuggestions?.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-product-id]");
    if (!button) return;
    event.preventDefault();
    chooseProduct(button.dataset.productId);
  });
  modalRoot.querySelector("#addItemBtn")?.addEventListener("click", addProposalItem);
  form.addEventListener("submit", submitAdminOrder);
  drawProposalItemsTable();
}

export function renderProposalsTable(proposals, editable) {
  if (!proposals.length) {
    return `<p class="empty-state">Nenhuma proposta encontrada.</p>`;
  }
  const canEdit = editable && isAdmin();

  if (canEdit) {
    return `
      <div class="orders-card-list">
        ${proposals
          .map((proposal) => {
            const total = proposalTotal(proposal);
            const status = statusInfo(proposal.status);
            return `
              <article class="order-card" data-original-status="${safe(proposal.status)}">
                <header class="order-card-head">
                  <div class="order-card-title">
                    <span class="order-number">#${safe(proposalNumber(proposal))}</span>
                    <div>
                      <strong>${safe(proposal.customer_name)}</strong>
                      <small>${safe(proposal.company_name)} • ${safe(date(proposal.created_at))}</small>
                    </div>
                  </div>
                  <div class="order-card-total">
                    <span>Total</span>
                    <strong>${safe(money(total))}</strong>
                  </div>
                </header>

                <div class="order-card-body">
                  <div class="order-card-info">
                    <span>Representante comercial</span>
                    <strong>${safe(proposal.seller_name)}</strong>
                  </div>
                  <label class="order-card-field">
                    <span>Status</span>
                    <select class="status-select" data-proposal-id="${safe(proposal.id)}" data-proposal-status style="--status-color:${safe(status.color)};--status-soft:${safe(softStatusColor(status.color))};">
                      ${statusOptions(proposal.status)}
                    </select>
                  </label>
                  <label class="order-card-field">
                    <span>Entrega prevista</span>
                    <input type="date" value="${safe(proposal.delivery_forecast || "")}" data-delivery-forecast="${safe(proposal.id)}" title="Entrega prevista" />
                  </label>
                  <label class="order-card-field">
                    <span>Pedido na indústria</span>
                    <input type="text" value="${safe(proposal.industry_order_number || "")}" data-industry-order-number="${safe(proposal.id)}" placeholder="Nº pedido indústria" autocomplete="off" />
                  </label>
                  <label class="order-card-field">
                    <span>Nota fiscal</span>
                    <input type="text" value="${safe(proposal.invoice_number || "")}" data-invoice-number="${safe(proposal.id)}" placeholder="Nº nota fiscal" autocomplete="off" />
                  </label>
                </div>

                <footer class="order-card-footer">
                  <div class="order-consult-actions order-consult-actions-secondary">
                    <button type="button" class="secondary order-consult-btn view" data-proposal-view="${safe(proposal.id)}" title="Visualizar pedido" aria-label="Visualizar pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.eye}
                      <span>Visualizar</span>
                    </button>
                    <button type="button" class="secondary order-consult-btn timeline" data-proposal-timeline="${safe(proposal.id)}" title="Linha do tempo" aria-label="Abrir linha do tempo do pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.timeline}
                      <span>Linha do tempo</span>
                    </button>
                    <button type="button" class="secondary order-consult-btn pdf" data-proposal-pdf="${safe(proposal.id)}" title="Gerar PDF" aria-label="Gerar PDF do pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.pdf}
                      <span>Abrir PDF</span>
                    </button>
                  </div>
                  <div class="order-consult-actions order-consult-actions-primary">
                    <button type="button" class="order-consult-btn save" data-proposal-save="${safe(proposal.id)}" title="Salvar alterações" aria-label="Salvar alterações do pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.edit}
                      <span>Salvar</span>
                    </button>
                    <button type="button" class="secondary order-consult-btn delete" data-proposal-delete="${safe(proposal.id)}" title="Excluir pedido" aria-label="Excluir pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.trash}
                      <span>Excluir</span>
                    </button>
                  </div>
                </footer>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Data</th>
          <th>Empresa</th>
          <th>Cliente</th>
          <th>Representante comercial</th>
          <th>Status</th>
          <th>Entrega Prevista</th>
          <th>Total</th>
          <th>Pedido indústria</th>
          <th>Nota fiscal</th>
          <th>Consultas</th>
        </tr>
      </thead>
      <tbody>
        ${proposals
          .map((proposal) => {
            const total = proposal.items.reduce((sum, item) => sum + item.quantity * item.negotiated_price, 0);
            return `
              <tr data-original-status="${safe(proposal.status)}">
                <td>${safe(proposalNumber(proposal))}</td>
                <td>${safe(date(proposal.created_at))}</td>
                <td>${safe(proposal.company_name)}</td>
                <td>${safe(proposal.customer_name)}</td>
                <td>${safe(proposal.seller_name)}</td>
                <td>
                  ${
                    editable
                      ? `<select class="status-select" data-proposal-id="${proposal.id}" data-proposal-status style="--status-color:${safe(statusInfo(proposal.status).color)};--status-soft:${safe(softStatusColor(statusInfo(proposal.status).color))};">
                          ${statusOptions(proposal.status)}
                        </select>`
                      : proposalStatusBadge(proposal.status)
                  }
                </td>
                <td>
                  ${
                    editable
                      ? `<input type="date" value="${safe(proposal.delivery_forecast || "")}" data-delivery-forecast="${safe(proposal.id)}" title="Entrega prevista" />`
                      : safe(date(proposal.delivery_forecast))
                  }
                </td>
                <td>${safe(money(total))}</td>
                <td>${safe(proposal.industry_order_number || "-")}</td>
                <td>${safe(proposal.invoice_number || "-")}</td>
                <td class="row-actions" data-label="Consultas">
                  <div class="order-consult-actions order-consult-actions-secondary">
                    <button type="button" class="secondary order-consult-btn view" data-proposal-view="${safe(proposal.id)}" title="Visualizar pedido" aria-label="Visualizar pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.eye}
                      <span>Visualizar</span>
                    </button>
                    <button type="button" class="secondary order-consult-btn timeline" data-proposal-timeline="${safe(proposal.id)}" title="Linha do tempo" aria-label="Abrir linha do tempo do pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.timeline}
                      <span>Linha do tempo</span>
                    </button>
                    <button type="button" class="secondary order-consult-btn pdf" data-proposal-pdf="${safe(proposal.id)}" title="Gerar PDF" aria-label="Gerar PDF do pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.pdf}
                      <span>Abrir PDF</span>
                    </button>
                    <button type="button" class="secondary order-consult-btn share" data-proposal-share="${safe(proposal.id)}" title="Compartilhar PDF" aria-label="Compartilhar PDF do pedido ${safe(proposalNumber(proposal))}">
                      ${uiIcons.share}
                      <span>Compartilhar</span>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}
