import {
  wireCustomers,
} from "../admin/catalog.js";

import {
  pendingRequestCount,
} from "../admin/modals.js";

import {
  goToCustomersApprovals,
  openProposalForCustomer,
} from "../core/api.js";

import {
  paginateItems,
  resetPage,
  state,
} from "../core/state.js";

import {
  isAdmin,
  renderPagination,
  safe,
  searchActionField,
  sectionBand,
  sellerIcons,
  uiIcons,
  wirePagination,
  wireSearchSubmit,
} from "../core/ui.js";

export function renderCustomersTable(customers) {
  if (!customers.length) {
    return `<p class="empty-state compact">Nenhum cliente para o filtro escolhido.</p>`;
  }

  return `
    <div class="entity-card-list">
      ${customers
        .map(
          (customer) => `
            <article class="entity-card ${customer.active ? "" : "is-disabled"}">
              <header class="entity-card-head">
                <div class="entity-card-title">
                  <span class="entity-avatar">${safe((customer.legal_name || "?").slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${safe(customer.legal_name)}</strong>
                    <small>${safe(customer.trade_name || "Sem nome fantasia")}</small>
                  </div>
                </div>
                ${customer.active ? '<span class="badge ok">Ativo</span>' : '<span class="badge danger">Inativo</span>'}
              </header>
              <div class="entity-card-grid">
                <div><span>CNPJ</span><strong>${safe(customer.cnpj)}</strong></div>
                <div><span>Telefone</span><strong>${safe(customer.phone || "Nao informado")}</strong></div>
                <div><span>Representante comercial</span><strong>${safe(customer.seller_names || customer.seller_name || "Sem vinculo")}</strong></div>
                <div><span>Vinculos</span><strong>${safe(customer.seller_count || 0)} ${Number(customer.seller_count || 0) === 1 ? "representante" : "representantes"}</strong></div>
              </div>
              <footer class="entity-card-actions">
                <label class="labeled-switch ${customer.active ? "is-active" : "is-inactive"}" title="${safe(customer.active ? "Cliente ativo" : "Cliente inativo")}">
                  <input type="checkbox" data-customer-active-toggle data-customer-id="${safe(customer.id)}" ${customer.active ? "checked" : ""} />
                  <span class="switch-track"></span>
                  <span>${customer.active ? "Cliente ativo" : "Cliente inativo"}</span>
                </label>
                <button type="button" class="secondary icon-text-btn" data-customer-view="${safe(customer.id)}">${uiIcons.eye}<span>Visualizar</span></button>
                <button type="button" class="secondary icon-text-btn" data-customer-edit="${safe(customer.id)}">${uiIcons.edit}<span>Editar</span></button>
                <button type="button" class="danger ghost icon-text-btn" data-customer-delete="${safe(customer.id)}">${uiIcons.trash}<span>Excluir</span></button>
              </footer>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderCustomers(view) {
  if (isAdmin()) {
    const search = String(state.admin.customerSearch || "").trim().toLowerCase();
    const filteredCustomers = state.admin.customers.filter((customer) => {
      if (state.admin.customerActiveFilter === "active" && !customer.active) return false;
      if (state.admin.customerActiveFilter === "inactive" && customer.active) return false;
      if (!search) return true;
      return [customer.legal_name, customer.trade_name, customer.cnpj, customer.phone, customer.address]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
    const customersPagination = paginateItems("adminCustomers", filteredCustomers);

    view.innerHTML = `
      <div class="admin-grid">
        ${sectionBand({
          id: "customerPanel",
          span: "span-12",
          eyebrow: "Clientes",
          title: "Lista de clientes",
        action: `
            <div class="section-action-group">
              <button type="button" class="secondary icon-text-btn" data-open-customer-modal="create">${uiIcons.plus}<span>Novo cliente</span></button>
              ${pendingRequestCount() > 0 ? `<button type="button" class="secondary icon-text-btn ${pendingRequestCount() === 1 ? "blink-badge" : ""}" data-go-customers-approvals>${uiIcons.check}<span>Aprovações (${safe(pendingRequestCount())})</span></button>` : ""}
            </div>
          `,
          body: `
            <div class="products-toolbar">
              <div class="products-toolbar-copy">
                <p class="lead">Cadastro por modal com busca por CNPJ, lista compacta e status visivel.</p>
              </div>
              <div class="products-toolbar-filters">
                <label>
                  Buscar
                  ${searchActionField(`<input type="search" placeholder="Razao social, fantasia ou CNPJ" value="${safe(state.admin.customerSearch || "")}" data-customer-search />`)}
                </label>
                <label>
                  Status
                  <select data-customer-active-filter>
                    <option value="all" ${state.admin.customerActiveFilter === "all" ? "selected" : ""}>Todos</option>
                    <option value="active" ${state.admin.customerActiveFilter === "active" ? "selected" : ""}>Ativos</option>
                    <option value="inactive" ${state.admin.customerActiveFilter === "inactive" ? "selected" : ""}>Inativos</option>
                  </select>
                </label>
              </div>
            </div>
            <div class="entity-card-shell products-list-shell customers-table-shell">
              ${renderCustomersTable(customersPagination.items)}
            </div>
            ${renderPagination("adminCustomers", customersPagination)}
          `,
        })}
      </div>
    `;

    wireCustomers(view);
    const goApprovals = view.querySelector("[data-go-customers-approvals]");
    if (goApprovals) {
      goApprovals.addEventListener("click", goToCustomersApprovals);
    }
    return;
  }

  view.innerHTML = `
    <section class="section-band span-12">
      <header class="section-head">
        <div>
          <p class="eyebrow">CLIENTES</p>
          <h2>Minha Carteira de Clientes</h2>
        </div>
        <div class="section-action">
          ${searchActionField(`<input id="customerSearch" type="search" placeholder="Digite cliente ou CNPJ" value="${safe(state.sellerCustomerSearch || "")}" />`)}
        </div>
      </header>
      <div class="section-body">
        <p class="lead">Aqui aparecem apenas os clientes atrelados ao seu cadastro. Clique em Fazer pedido para abrir a proposta já com os dados dele.</p>
        <div class="entity-card-shell customers-table-shell" id="customersTable"></div>
      </div>
    </section>
  `;

  wireSearchSubmit(view, "#customerSearch", (value) => {
    state.sellerCustomerSearch = value;
    resetPage("sellerCustomers");
    drawCustomersTable();
  });

  drawCustomersTable();
  const customersTable = document.querySelector("#customersTable");
  customersTable?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-proposal-customer]");
    if (!button) {
      return;
    }
    openProposalForCustomer(button.dataset.openProposalCustomer);
  });
}

export function drawCustomersTable() {
  const target = document.querySelector("#customersTable");
  if (!target) return;
  const search = String(state.sellerCustomerSearch || "").trim().toLowerCase();
  const customers = state.common.customers.filter((customer) => {
    if (!search) return true;
    return [customer.legal_name, customer.trade_name, customer.cnpj, customer.state_registration, customer.address, customer.phone]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  const customersPagination = paginateItems("sellerCustomers", customers);

  target.innerHTML = `
    <div class="entity-card-list">
      ${customersPagination.items
        .map(
          (customer) => `
            <article class="entity-card">
              <header class="entity-card-head">
                <div class="entity-card-title">
                  <span class="entity-avatar">${safe((customer.legal_name || "?").slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${safe(customer.legal_name)}</strong>
                    <small>${safe(customer.trade_name || "Sem nome fantasia")}</small>
                  </div>
                </div>
                <span class="badge ok">Vinculado</span>
              </header>
              <div class="entity-card-grid">
                <div><span>CNPJ</span><strong>${safe(customer.cnpj)}</strong></div>
                <div><span>IE</span><strong>${safe(customer.state_registration || "Nao informada")}</strong></div>
                <div><span>Telefone</span><strong>${safe(customer.phone || "Nao informado")}</strong></div>
                <div><span>Endereco</span><strong>${safe(customer.address || "Nao informado")}</strong></div>
              </div>
              <footer class="entity-card-actions">
                <button type="button" class="icon-text-btn" data-open-proposal-customer="${safe(customer.id)}">${sellerIcons.orders}<span>Fazer pedido</span></button>
              </footer>
            </article>
          `
        )
        .join("")}
    </div>
    ${customers.length ? "" : `<p class="empty-state compact">Nenhum cliente para o filtro escolhido.</p>`}
    ${renderPagination("sellerCustomers", customersPagination)}
  `;
  wirePagination(target, drawCustomersTable);
}
