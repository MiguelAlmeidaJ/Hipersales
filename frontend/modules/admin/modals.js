import {
  closeCompanyAssignmentModal,
  closeCompanyModal,
  closeCustomerAssignmentModal,
  closeCustomerModal,
  closeCustomerViewModal,
  closeProductModal,
  closeRequestModal,
  getAdminRequest,
  openCompanyAssignmentModal,
  openCustomerAssignmentModal,
  openCustomerModal,
  renderCompanyModal,
  renderCustomerModal,
  renderCustomerViewModal,
  renderProductEditorModal,
  renderProductImportModal,
  submitCompanyModal,
  submitCustomerModal,
  submitProductImportModal,
  submitProductModal,
  submitRequestModal,
  submitRequestModalAction,
  toggleCompanyAssignment,
  toggleCustomerAssignment,
  wireCustomerAutofill,
} from "./catalog.js";

import {
  closeOrderModal,
  closeProposalViewModal,
  orderAdminPayload,
  preserveProposalAdminDraft,
  renderOrderCreateModal,
  syncProposalViewDeliveryDate,
  syncProposalViewPaymentTerms,
  wireAdminOrderModal,
} from "./orders.js";

import {
  closeSettingsModal,
  readFormValues,
  renderSettingsModalShell,
} from "./settings.js";

import {
  api,
  loadCompanyAssignments,
  loadCustomerAssignments,
  loadRouteData,
  setFlash,
} from "../core/api.js";

import {
  render,
} from "../core/shell.js";

import {
  paginateItems,
  resetPage,
  state,
} from "../core/state.js";

import {
  date,
  formatCurrencyValue,
  hydrateResponsiveTables,
  parseCurrencyValue,
  renderPagination,
  safe,
  searchActionField,
  wirePagination,
  wireSearchSubmit,
} from "../core/ui.js";

import {
  registrationFormFields,
  requestFormSnapshot,
} from "../features/customer-requests.js";

import {
  closeOccurrenceTimelineModal,
  openOccurrencePdf,
} from "../features/occurrences.js";

import {
  closeProposalItemModal,
  closeTimelineModal,
  getProposalById,
  openCustomerPerformancePdf,
  openProposalPdf,
  renderOccurrenceTimelineModal,
  renderProposalViewModal,
  renderTimelineModal,
  saveProposalItemFromModal,
  shareProposalPdf,
} from "../features/proposals.js";

export function renderUsersTable(users) {
  if (!users.length) {
    return `<p class="empty-state">Nenhum usuario cadastrado.</p>`;
  }

  return users
    .map(
      (user) => `
        <div class="user-row ${user.active ? "" : "is-disabled"}" data-user-card data-user-id="${safe(user.id)}">
          <div class="user-row-main">
            <div class="user-row-title">
              <strong>${safe(user.name)}</strong>
              <span>Usuário: ${safe(user.email)}</span>
              <span>Comunicados: ${safe(user.communication_email || "Nao informado")}</span>
              <span>WhatsApp: ${safe(user.whatsapp_phone || "Nao informado")}</span>
            </div>
            <div class="user-row-meta">
              <span class="badge brand">${safe(user.role === "admin" ? "Administrador" : "Representante comercial")}</span>
              ${user.must_change_password ? `<span class="badge warn">Senha temporaria</span>` : ""}
            </div>
          </div>
          <div class="user-row-actions">
            <label class="switch" title="${safe(user.active ? "Desabilitar usuario" : "Habilitar usuario")}">
              <input type="checkbox" data-user-active-toggle data-user-id="${safe(user.id)}" ${user.active ? "checked" : ""} />
              <span class="switch-track"></span>
            </label>
            <button type="button" class="secondary" data-user-edit="${safe(user.id)}">Editar</button>
            <button type="button" class="ghost" data-user-temp-password="${safe(user.id)}">Senha temporaria</button>
          </div>
        </div>
      `
    )
    .join("");
}

export function pendingRequestCount() {
  return pendingRequests().length;
}

export function pendingRequests() {
  return state.admin.requests.filter((request) => request.status === "pendente");
}

export function requestModalSizeClass(total) {
  if (total <= 1) return "request-modal-sm";
  if (total === 2) return "request-modal-md";
  return "request-modal-lg";
}

export function getAdminUser(userId) {
  return state.admin.users.find((user) => String(user.id) === String(userId)) || null;
}

export function openUserModal(mode, userId = null) {
  state.admin.activeUserModal = { mode, userId: userId ? String(userId) : null };
  state.admin.activeProductModal = null;
  state.admin.activeAssignmentModal = null;
  render();
}

export function closeUserModal() {
  state.admin.activeUserModal = null;
  render();
}

export function renderUserEditorModal() {
  const modal = state.admin.activeUserModal;
  if (!modal || !["create", "edit"].includes(modal.mode)) {
    return "";
  }
  const user = modal.mode === "edit" ? getAdminUser(modal.userId) : null;
  if (modal.mode === "edit" && !user) {
    return "";
  }
  return renderSettingsModalShell({
    modalKey: "userEditorModal",
    eyebrow: modal.mode === "create" ? "Usuarios" : "Usuarios",
    title: modal.mode === "create" ? "Novo usuario" : `Editar usuario`,
    closable: false,
    body: `
      <form class="settings-modal-form user-modal-form" id="userModalForm" data-user-mode="${safe(modal.mode)}" data-user-id="${safe(user?.id || "")}">
        <div class="form-grid two">
          <label class="span-2">
            Nome
            <input name="name" value="${safe(user?.name || "")}" required />
          </label>
          <label class="span-2">
            Usuario
            <input name="email" type="text" value="${safe(user?.email || "")}" autocomplete="username" autocapitalize="none" spellcheck="false" required />
          </label>
          <label>
            E-mail para comunicados
            <input name="communication_email" type="email" value="${safe(user?.communication_email || "")}" placeholder="exemplo@email.com" />
          </label>
          <label>
            WhatsApp / celular
            <input name="whatsapp_phone" type="tel" value="${safe(user?.whatsapp_phone || "")}" placeholder="Ex: 5532999141230" inputmode="tel" />
          </label>
          <label>
            Perfil
            <select name="role" required>
              <option value="seller" ${!user || user.role === "seller" ? "selected" : ""}>Representante comercial</option>
              <option value="admin" ${user?.role === "admin" ? "selected" : ""}>Administrador</option>
            </select>
          </label>
          <label class="check-field user-toggle-field">
            <input name="active" type="checkbox" ${user?.active !== false ? "checked" : ""} />
            Usuario ativo
          </label>
          <div class="span-2">
            <label>
              Senha
              <input name="password" type="password" placeholder="${modal.mode === "edit" ? "Deixe em branco para manter" : "Defina a senha"}" />
            </label>
          </div>
          <div class="span-2">
            <label>
              Senha temporaria
              <input name="temporary_password" type="password" placeholder="Use para obrigar a troca no primeiro login" />
            </label>
          </div>
          <div class="span-2 helper-note">
            <p class="lead">
              Preencha apenas uma das senhas. Se a temporaria for usada, o usuario tera que criar outra no primeiro login.
            </p>
          </div>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-user-modal>Cancelar</button>
          <button type="submit">${modal.mode === "create" ? "Cadastrar usuario" : "Salvar alteracoes"}</button>
        </div>
      </form>
    `,
  });
}

export function renderRequestApprovalModal() {
  const requestId = state.admin.activeRequestModal;
  if (!requestId) {
    return "";
  }
  const request = getAdminRequest(requestId);
  if (!request) {
    return "";
  }
  const pendingCount = pendingRequestCount();
  const sizeClass = requestModalSizeClass(pendingCount);
  const snapshot = requestFormSnapshot(request);
  return renderSettingsModalShell({
    modalKey: "requestApprovalModal",
    eyebrow: "Solicitacoes",
    title: "Aprovacao de cliente",
    wide: true,
    panelClass: `${sizeClass} request-modal-landscape`,
    closable: false,
    body: `
      <form class="settings-modal-form request-modal-form ${sizeClass}" id="requestModalForm" data-request-id="${safe(request.id)}">
        <div class="request-modal-hero">
          <div class="request-modal-hero-copy">
            <p class="eyebrow">Solicitacao #${safe(request.id)}</p>
            <h3>${safe(request.legal_name)}</h3>
            <p class="request-modal-subtitle">${safe(request.trade_name || "Sem nome fantasia")} | ${safe(request.cnpj)}</p>
          </div>
          <div class="request-modal-hero-badges">
            <span class="badge danger">Pendente</span>
            <span class="badge">${safe(date(request.created_at))}</span>
          </div>
        </div>

        <div class="request-modal-summary-grid">
          <article class="request-modal-summary-card accent">
            <span>Representante comercial solicitante</span>
            <strong>${safe(request.seller_name)}</strong>
            <small>${safe(request.seller_email || "")}</small>
          </article>
          <article class="request-modal-summary-card">
            <span>Cliente e localização</span>
            <strong>${safe(snapshot.legal_name || "Nao informado")}</strong>
            <small>${safe([snapshot.city, snapshot.state, snapshot.zip_code].filter(Boolean).join(" / ") || snapshot.address || "Sem endereco informado")}</small>
          </article>
          <article class="request-modal-summary-card">
            <span>Contato principal</span>
            <strong>${safe(snapshot.contact_person || "Nao informado")}</strong>
            <small>${safe(snapshot.phone_1 || request.phone || "Sem telefone principal")}</small>
          </article>
          <article class="request-modal-summary-card">
            <span>Entrega</span>
            <strong>${safe(snapshot.delivery_scheduled || "Nao informado")}</strong>
            <small>${safe(snapshot.schedule_method || snapshot.delivery_warnings || "Sem observacoes de entrega")}</small>
          </article>
        </div>

        ${registrationFormFields(snapshot)}

        <div class="modal-footer split request-modal-footer">
          <button type="button" class="secondary" data-request-action="close">Fechar</button>
          <div class="modal-actions-group">
            <button type="button" class="ghost danger" data-request-action="deny">Negar</button>
            <button type="submit" class="secondary" data-request-action="save">Salvar</button>
            <button type="button" data-request-action="approve">Aprovar</button>
          </div>
        </div>
      </form>
    `,
  });
}

export function renderTempPasswordModal() {
  const modal = state.admin.activeUserModal;
  if (!modal || modal.mode !== "temp") {
    return "";
  }
  const user = modal.userId ? getAdminUser(modal.userId) : null;
  return renderSettingsModalShell({
    modalKey: "tempPasswordModal",
    eyebrow: "Usuarios",
    title: "Definir senha temporaria",
    closable: false,
    body: `
      <form class="settings-modal-form" id="userTempModalForm" data-user-mode="temp" data-user-id="${safe(user?.id || "")}">
        <p class="lead">
          Escreva a senha temporaria que o usuario vai usar no primeiro login. Depois ele sera obrigado a trocar.
        </p>
        <div class="form-grid two">
          <label class="span-2">
            Usuario
            <input value="${safe(user ? `${user.name} - ${user.email}` : "")}" disabled />
          </label>
          <label class="span-2">
            Senha temporaria
            <input name="temporary_password" type="password" required minlength="6" autocomplete="new-password" />
          </label>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-user-modal>Cancelar</button>
          <button type="submit">Salvar senha temporaria</button>
        </div>
      </form>
    `,
  });
}

export function renderForcePasswordModal() {
  if (!state.mustChangePassword) {
    return "";
  }
  return renderSettingsModalShell({
    modalKey: "forcePasswordModal",
    eyebrow: "Acesso",
    title: "Defina sua senha agora",
    closable: false,
    body: `
      <form class="settings-modal-form force-password-form" id="forcePasswordForm">
        <p class="lead">
          Esta foi uma senha temporaria. Antes de continuar, escolha uma senha pessoal para o seu acesso.
        </p>
        <div class="form-grid two">
          <label class="span-2">
            Nova senha
            <input name="new_password" type="password" required minlength="8" autocomplete="new-password" />
          </label>
          <label class="span-2">
            Confirmar nova senha
            <input name="confirm_password" type="password" required minlength="8" autocomplete="new-password" />
          </label>
        </div>
        <div class="modal-footer">
          <button type="submit">Salvar senha</button>
        </div>
      </form>
    `,
  });
}

export function renderProposalItemModal() {
  const item = state.proposalActiveItemModal;
  if (!item) return "";
  return renderSettingsModalShell({
    modalKey: "proposalItemModal",
    eyebrow: "Itens",
    title: item.index === null ? "Adicionar produto" : "Editar produto",
    closable: false,
    body: `
      <form class="settings-modal-form" id="proposalItemForm">
        <div class="proposal-item-product">
          <p class="eyebrow">Produto selecionado</p>
          <h3>${safe(item.code)} - ${safe(item.name)}</h3>
          <span>Unidade Venda: ${safe(item.unit || "UN")}</span>
        </div>
        <div class="form-grid two">
          <label>
            Quantidade
            <input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" value="${safe(item.quantity || "")}" required />
          </label>
          <label>
            Preco Negociado
            <input name="negotiated_price" type="text" inputmode="numeric" autocomplete="off" value="${safe(formatCurrencyValue(item.negotiated_price || 0))}" data-currency-input required />
          </label>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-proposal-item-modal>Cancelar</button>
          <button type="submit">${item.index === null ? "Adicionar item" : "Salvar item"}</button>
        </div>
      </form>
    `,
  });
}

export function renderCustomerAssignmentModal() {
  const modal = state.admin.activeAssignmentModal;
  if (!modal) {
    return "";
  }

  const sellerId = String(modal.sellerId || state.admin.customerAssignmentSellerId || "");
  const sellers = state.admin.users.filter((user) => user.role === "seller");
  const selectedSeller = sellers.find((user) => String(user.id) === sellerId) || null;
  const assignments = state.admin.customerAssignments || [];
  const search = String(state.admin.customerAssignmentSearch || "").trim().toLowerCase();
  const assignmentFilter = String(state.admin.customerAssignmentFilter || "all");
  const filteredAssignments = assignments.filter((customer) => {
    if (assignmentFilter === "linked" && !customer.assigned) return false;
    if (assignmentFilter === "free" && customer.assigned) return false;
    if (!search) return true;
    return [customer.legal_name, customer.trade_name, customer.cnpj, customer.phone, customer.address]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  const assignmentsPagination = paginateItems("assignmentCustomers", filteredAssignments);
  const linkedCount = assignments.filter((customer) => customer.assigned).length;
  const freeCount = assignments.filter((customer) => !customer.assigned).length;

  return renderSettingsModalShell({
    modalKey: "assignmentModal",
    eyebrow: "Carteira do representante comercial",
    title: selectedSeller ? selectedSeller.name : "Gerenciar carteira",
    wide: true,
    panelClass: "assignment-modal-panel",
    body: `
      <div class="assignment-modal-shell">
        <div class="assignment-modal-meta">
          <div class="assignment-modal-headline">
            <p class="eyebrow">Representante comercial</p>
            <h3>${safe(selectedSeller ? selectedSeller.name : "Nenhum representante comercial selecionado")}</h3>
            <p class="lead">${safe(selectedSeller ? `Usuario: ${selectedSeller.email}` : "Selecione um representante comercial para carregar sua carteira.")}</p>
          </div>
          <div class="products-summary">
            <span class="badge brand">${safe(assignments.length)} na base</span>
            <span class="badge ok">${safe(linkedCount)} vinculados</span>
            <span class="badge danger">${safe(freeCount)} livres</span>
          </div>
        </div>

        <div class="assignment-modal-controls">
          <label>
            Buscar cliente
            ${searchActionField(`<input type="search" value="${safe(state.admin.customerAssignmentSearch || "")}" placeholder="Razao social, fantasia ou CNPJ" data-customer-assignment-search />`)}
          </label>
          <label>
            Filtro
            <select data-customer-assignment-filter>
              <option value="all" ${assignmentFilter === "all" ? "selected" : ""}>Todos</option>
              <option value="linked" ${assignmentFilter === "linked" ? "selected" : ""}>Vinculados</option>
              <option value="free" ${assignmentFilter === "free" ? "selected" : ""}>Sem vinculo</option>
            </select>
          </label>
        </div>

        <div class="assignment-modal-list">
          ${
            filteredAssignments.length
              ? assignmentsPagination.items
                  .map(
                    (customer) => `
                      <div class="assignment-row ${customer.assigned ? "is-linked" : "is-free"} ${customer.active ? "" : "is-disabled"}">
                        <div class="assignment-row-main">
                          <div class="assignment-row-title">
                            <strong>${safe(customer.legal_name)}</strong>
                            <span>${safe(customer.trade_name || customer.cnpj)}</span>
                          </div>
                          <div class="assignment-row-meta">
                            <span class="badge ${customer.assigned ? "ok" : "warn"}">${customer.assigned ? "Vinculado" : "Livre"}</span>
                            ${customer.active ? '<span class="badge brand">Ativo</span>' : '<span class="badge danger">Inativo</span>'}
                          </div>
                        </div>
                        <label class="switch assignment-switch" title="${safe(customer.assigned ? "Desvincular cliente" : "Vincular cliente")}">
                          <input type="checkbox" data-customer-assignment-toggle data-customer-id="${safe(customer.id)}" ${customer.assigned ? "checked" : ""} />
                          <span class="switch-track"></span>
                        </label>
                      </div>
                    `
                  )
                  .join("")
              : `<p class="empty-state">Nenhum cliente encontrado para esse filtro.</p>`
          }
        </div>
        ${renderPagination("assignmentCustomers", assignmentsPagination)}

        <div class="request-modal-note">
          Use a busca para encontrar clientes rapidamente. Os vínculos feitos aqui valem na carteira do representante comercial selecionado.
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-assignment-modal>Fechar</button>
          <span class="lead">A aprovacao de cadastro continua vinculando automaticamente ao representante comercial que solicitou.</span>
        </div>
      </div>
    `,
  });
}

export function renderCompanyAssignmentModal() {
  const modal = state.admin.activeCompanyAssignmentModal;
  if (!modal) return "";
  const sellerId = String(modal.sellerId || state.admin.customerAssignmentSellerId || "");
  const sellers = state.admin.users.filter((user) => user.role === "seller");
  const selectedSeller = sellers.find((user) => String(user.id) === sellerId) || null;
  const assignments = state.admin.companyAssignments || [];
  const search = String(state.admin.companyAssignmentSearch || "").trim().toLowerCase();
  const assignmentFilter = String(state.admin.companyAssignmentFilter || "all");
  const filteredAssignments = assignments.filter((company) => {
    if (assignmentFilter === "linked" && !company.assigned) return false;
    if (assignmentFilter === "free" && company.assigned) return false;
    if (!search) return true;
    return [company.name, company.legal_name].join(" ").toLowerCase().includes(search);
  });
  const pagination = paginateItems("assignmentCompanies", filteredAssignments);
  const linkedCount = assignments.filter((company) => company.assigned).length;

  return renderSettingsModalShell({
    modalKey: "companyAssignmentModal",
    eyebrow: "Empresas do representante comercial",
    title: selectedSeller ? selectedSeller.name : "Gerenciar empresas",
    wide: true,
    panelClass: "assignment-modal-panel",
    body: `
      <div class="assignment-modal-shell">
        <div class="assignment-modal-meta">
          <div class="assignment-modal-headline">
            <p class="eyebrow">Representante comercial</p>
            <h3>${safe(selectedSeller?.name || "Nenhum representante comercial selecionado")}</h3>
            <p class="lead">${safe(selectedSeller ? `Usuario: ${selectedSeller.email}` : "Selecione um representante comercial.")}</p>
          </div>
          <div class="products-summary">
            <span class="badge brand">${safe(assignments.length)} na base</span>
            <span class="badge ok">${safe(linkedCount)} vinculadas</span>
            <span class="badge danger">${safe(assignments.length - linkedCount)} disponíveis</span>
          </div>
        </div>
        <div class="assignment-modal-controls">
          <label>
            Buscar empresa
            ${searchActionField(`<input type="search" value="${safe(state.admin.companyAssignmentSearch || "")}" placeholder="Nome ou razão social" data-company-assignment-search />`)}
          </label>
          <label>
            Filtro
            <select data-company-assignment-filter>
              <option value="all" ${assignmentFilter === "all" ? "selected" : ""}>Todas</option>
              <option value="linked" ${assignmentFilter === "linked" ? "selected" : ""}>Vinculadas</option>
              <option value="free" ${assignmentFilter === "free" ? "selected" : ""}>Sem vínculo</option>
            </select>
          </label>
        </div>
        <div class="assignment-modal-list">
          ${filteredAssignments.length
            ? pagination.items.map((company) => `
                <div class="assignment-row ${company.assigned ? "is-linked" : "is-free"} ${company.active ? "" : "is-disabled"}">
                  <div class="assignment-row-main">
                    <div class="assignment-row-title">
                      <strong>${safe(company.name)}</strong>
                      <span>${safe(company.legal_name || "Sem razão social informada")}</span>
                    </div>
                    <div class="assignment-row-meta">
                      <span class="badge ${company.assigned ? "ok" : "warn"}">${company.assigned ? "Vinculada" : "Disponível"}</span>
                      ${company.active ? '<span class="badge brand">Ativa</span>' : '<span class="badge danger">Inativa</span>'}
                    </div>
                  </div>
                  <label class="switch assignment-switch" title="${safe(company.assigned ? "Desvincular empresa" : "Vincular empresa")}">
                    <input type="checkbox" data-company-assignment-toggle data-company-id="${safe(company.id)}" ${company.assigned ? "checked" : ""} />
                    <span class="switch-track"></span>
                  </label>
                </div>
              `).join("")
            : `<p class="empty-state">Nenhuma empresa encontrada para esse filtro.</p>`}
        </div>
        ${renderPagination("assignmentCompanies", pagination)}
        <div class="request-modal-note">
          O representante verá somente as empresas vinculadas aqui e os produtos cadastrados nelas.
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-company-assignment-modal>Fechar</button>
          <span class="lead">As alterações de acesso são aplicadas imediatamente.</span>
        </div>
      </div>
    `,
  });
}

export function renderGlobalModals() {
  const container = document.querySelector("#globalModals");
  if (!container) {
    return;
  }
  container.innerHTML = `${renderUserEditorModal()}${renderRequestApprovalModal()}${renderTempPasswordModal()}${renderCustomerModal()}${renderCustomerViewModal()}${renderCompanyModal()}${renderProductEditorModal()}${renderProductImportModal()}${renderOrderCreateModal()}${renderForcePasswordModal()}${renderCustomerAssignmentModal()}${renderCompanyAssignmentModal()}${renderProposalItemModal()}${renderTimelineModal()}${renderOccurrenceTimelineModal()}${renderProposalViewModal()}`;
  hydrateResponsiveTables(container);
  wireGlobalModals();
}

export function wireUsers(view) {
  wirePagination(view);
  view.querySelectorAll("[data-open-user-modal]").forEach((button) => {
    button.addEventListener("click", () => openUserModal(button.dataset.openUserModal));
  });

  view.querySelectorAll("[data-user-edit]").forEach((button) => {
    button.addEventListener("click", () => openUserModal("edit", button.dataset.userEdit));
  });

  view.querySelectorAll("[data-user-temp-password]").forEach((button) => {
    button.addEventListener("click", () => openUserModal("temp", button.dataset.userTempPassword));
  });

  view.querySelectorAll("[data-user-active-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => toggleUserActive(toggle.dataset.userId, toggle.checked));
  });

  view.querySelectorAll("[data-open-assignment-modal]").forEach((button) => {
    button.addEventListener("click", openCustomerAssignmentModal);
  });
  view.querySelectorAll("[data-open-company-assignment-modal]").forEach((button) => {
    button.addEventListener("click", openCompanyAssignmentModal);
  });

  view.querySelectorAll("[data-customer-assignment-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => toggleCustomerAssignment(toggle.dataset.customerId, toggle.checked));
  });

  const searchInput = view.querySelector("[data-user-search]");
  if (searchInput) {
    wireSearchSubmit(view, "[data-user-search]", (value) => {
      state.admin.userSearch = value;
      resetPage("adminUsers");
      render();
    });
  }

  const sellerSelect = view.querySelector("[data-customer-assignment-seller]");
  const companySellerSelect = view.querySelector("[data-company-assignment-seller]");
  const changeAssignmentSeller = async (value) => {
      state.admin.customerAssignmentSellerId = value;
      state.admin.customerAssignmentSearch = "";
      state.admin.customerAssignmentFilter = "all";
      state.admin.companyAssignmentSearch = "";
      state.admin.companyAssignmentFilter = "all";
      resetPage("assignmentCustomers");
      resetPage("assignmentCompanies");
      if (state.admin.activeAssignmentModal) {
        state.admin.activeAssignmentModal = { sellerId: String(value || "") };
      }
      if (state.admin.activeCompanyAssignmentModal) {
        state.admin.activeCompanyAssignmentModal = { sellerId: String(value || "") };
      }
      try {
        await Promise.all([loadCustomerAssignments(value), loadCompanyAssignments(value)]);
      } catch (error) {
        setFlash("", error.message);
      }
      render();
  };
  if (sellerSelect) {
    sellerSelect.addEventListener("change", () => changeAssignmentSeller(sellerSelect.value));
  }
  if (companySellerSelect) {
    companySellerSelect.addEventListener("change", () => changeAssignmentSeller(companySellerSelect.value));
  }

  const assignmentSearch = view.querySelector("[data-customer-assignment-search]");
  if (assignmentSearch) {
    wireSearchSubmit(view, "[data-customer-assignment-search]", (value) => {
      state.admin.customerAssignmentSearch = value;
      resetPage("assignmentCustomers");
      render();
    });
  }

  const assignmentFilter = view.querySelector("[data-customer-assignment-filter]");
  if (assignmentFilter) {
    assignmentFilter.addEventListener("change", () => {
      state.admin.customerAssignmentFilter = assignmentFilter.value;
      resetPage("assignmentCustomers");
      render();
    });
  }
}

export function wireGlobalModals() {
  const modalRoot = document.querySelector("#globalModals");
  if (!modalRoot) {
    return;
  }
  wirePagination(modalRoot);

  modalRoot.querySelectorAll("[data-close-user-modal]").forEach((button) => {
    button.addEventListener("click", closeUserModal);
  });

  modalRoot.querySelectorAll("[data-close-product-modal]").forEach((button) => {
    button.addEventListener("click", closeProductModal);
  });

  modalRoot.querySelectorAll("[data-close-customer-modal]").forEach((button) => {
    button.addEventListener("click", closeCustomerModal);
  });

  modalRoot.querySelectorAll("[data-close-customer-view-modal]").forEach((button) => {
    button.addEventListener("click", closeCustomerViewModal);
  });

  modalRoot.querySelectorAll("[data-close-company-modal]").forEach((button) => {
    button.addEventListener("click", closeCompanyModal);
  });

  modalRoot.querySelectorAll("[data-close-assignment-modal]").forEach((button) => {
    button.addEventListener("click", closeCustomerAssignmentModal);
  });
  modalRoot.querySelectorAll("[data-close-company-assignment-modal]").forEach((button) => {
    button.addEventListener("click", closeCompanyAssignmentModal);
  });

  modalRoot.querySelectorAll("[data-close-order-modal]").forEach((button) => {
    button.addEventListener("click", closeOrderModal);
  });

  modalRoot.querySelectorAll("[data-close-settings-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalKey = button.closest("[data-settings-modal]")?.dataset.settingsModal || "";
      if (modalKey === "userEditorModal" || modalKey === "tempPasswordModal") {
        closeUserModal();
      } else if (modalKey === "requestApprovalModal") {
        closeRequestModal();
      } else if (modalKey === "customerModal") {
        closeCustomerModal();
      } else if (modalKey === "customerViewModal") {
        closeCustomerViewModal();
      } else if (modalKey === "companyModal") {
        closeCompanyModal();
      } else if (modalKey === "assignmentModal") {
        closeCustomerAssignmentModal();
      } else if (modalKey === "companyAssignmentModal") {
        closeCompanyAssignmentModal();
      } else if (modalKey === "orderCreateModal") {
        closeOrderModal();
      } else if (modalKey === "productEditorModal" || modalKey === "productImportModal") {
        closeProductModal();
      } else if (modalKey === "proposalItemModal") {
        closeProposalItemModal();
      } else if (modalKey === "timelineModal") {
        closeTimelineModal();
      } else if (modalKey === "occurrenceTimelineModal") {
        closeOccurrenceTimelineModal();
      } else if (modalKey === "proposalViewModal") {
        closeProposalViewModal();
      } else {
        closeSettingsModal();
      }
    });
  });

  modalRoot.querySelectorAll("[data-settings-modal]").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        const modalKey = overlay.dataset.settingsModal || "";
        if (modalKey === "forcePasswordModal") {
          return;
        }
        if (modalKey === "userEditorModal" || modalKey === "tempPasswordModal") {
          closeUserModal();
        } else if (modalKey === "requestApprovalModal") {
          closeRequestModal();
        } else if (modalKey === "customerModal") {
          closeCustomerModal();
        } else if (modalKey === "customerViewModal") {
          closeCustomerViewModal();
        } else if (modalKey === "companyModal") {
          closeCompanyModal();
        } else if (modalKey === "assignmentModal") {
          closeCustomerAssignmentModal();
        } else if (modalKey === "companyAssignmentModal") {
          closeCompanyAssignmentModal();
        } else if (modalKey === "orderCreateModal") {
          closeOrderModal();
        } else if (modalKey === "productEditorModal" || modalKey === "productImportModal") {
          closeProductModal();
        } else if (modalKey === "proposalItemModal") {
          closeProposalItemModal();
        } else if (modalKey === "timelineModal") {
          closeTimelineModal();
        } else if (modalKey === "occurrenceTimelineModal") {
          closeOccurrenceTimelineModal();
        } else if (modalKey === "proposalViewModal") {
          closeProposalViewModal();
        } else {
          closeSettingsModal();
        }
      }
    });
  });

  const userForm = modalRoot.querySelector("#userModalForm");
  if (userForm) {
    userForm.addEventListener("submit", submitUserModal);
  }

  const userTempForm = modalRoot.querySelector("#userTempModalForm");
  if (userTempForm) {
    userTempForm.addEventListener("submit", submitTempPasswordModal);
  }

  const forcePasswordForm = modalRoot.querySelector("#forcePasswordForm");
  if (forcePasswordForm) {
    forcePasswordForm.addEventListener("submit", submitForcePasswordChange);
  }

  modalRoot.querySelectorAll("[data-close-proposal-item-modal]").forEach((button) => {
    button.addEventListener("click", closeProposalItemModal);
  });
  modalRoot.querySelectorAll("[data-close-timeline-modal]").forEach((button) => {
    button.addEventListener("click", closeTimelineModal);
  });
  modalRoot.querySelectorAll("[data-close-occurrence-timeline-modal]").forEach((button) => {
    button.addEventListener("click", closeOccurrenceTimelineModal);
  });
  modalRoot.querySelectorAll("[data-close-proposal-view-modal]").forEach((button) => {
    button.addEventListener("click", closeProposalViewModal);
  });
  modalRoot.querySelectorAll("[data-proposal-pdf]").forEach((button) => {
    button.addEventListener("click", () => openProposalPdf(button.dataset.proposalPdf));
  });
  modalRoot.querySelectorAll("[data-proposal-share]").forEach((button) => {
    button.addEventListener("click", () => shareProposalPdf(button.dataset.proposalShare));
  });
  modalRoot.querySelectorAll("[data-occurrence-pdf]").forEach((button) => {
    button.addEventListener("click", () => openOccurrencePdf(button.dataset.occurrencePdf));
  });
  modalRoot.querySelectorAll("[data-proposal-delivery-type]").forEach((select) => {
    const sync = () => syncProposalViewDeliveryDate(modalRoot);
    select.addEventListener("change", sync);
    sync();
  });
  modalRoot.querySelectorAll("[data-proposal-order-type]").forEach((select) => {
    const sync = () => syncProposalViewPaymentTerms(modalRoot);
    select.addEventListener("change", sync);
    sync();
  });

  const proposalItemForm = modalRoot.querySelector("#proposalItemForm");
  if (proposalItemForm) {
    proposalItemForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveProposalItemFromModal(event.target);
    });
  }

  const proposalViewForm = modalRoot.querySelector("#proposalViewForm");
  if (proposalViewForm) {
    const updateAdminItem = (index, field, value) => {
      const item = state.admin.proposalEditItems[index];
      if (item) item[field] = value;
    };
    proposalViewForm.querySelectorAll("[data-admin-item-product]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.dataset.adminItemProduct);
        const product = (state.admin.products || []).find((entry) => String(entry.id) === String(select.value));
        if (!product) return;
        const duplicated = state.admin.proposalEditItems.some(
          (item, itemIndex) => itemIndex !== index && String(item.product_id || item.id) === String(product.id)
        );
        if (duplicated) {
          setFlash("", "Este produto ja esta no pedido. Altere o item existente ou remova a duplicidade.");
          return;
        }
        preserveProposalAdminDraft(proposalViewForm, proposalViewForm.dataset.proposalId);
        const item = state.admin.proposalEditItems[index];
        if (!item) return;
        item.product_id = product.id;
        item.code = product.code;
        item.name = product.name;
        item.unit = product.unit;
        item.negotiated_price = Number(product.price || 0);
        render();
      });
    });
    proposalViewForm.querySelectorAll("[data-admin-item-quantity]").forEach((input) => {
      input.addEventListener("input", () => {
        updateAdminItem(Number(input.dataset.adminItemQuantity), "quantity", Number(input.value));
      });
    });
    proposalViewForm.querySelectorAll("[data-admin-item-price]").forEach((input) => {
      input.addEventListener("input", () => {
        updateAdminItem(Number(input.dataset.adminItemPrice), "negotiated_price", parseCurrencyValue(input.value));
      });
      input.addEventListener("blur", () => {
        const value = parseCurrencyValue(input.value);
        updateAdminItem(Number(input.dataset.adminItemPrice), "negotiated_price", value);
        input.value = formatCurrencyValue(value);
      });
    });
    proposalViewForm.querySelectorAll("[data-admin-edit-proposal-item]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.adminEditProposalItem);
        const productSelect = proposalViewForm.querySelector(`[data-admin-item-product="${index}"]`);
        const quantityInput = proposalViewForm.querySelector(`[data-admin-item-quantity="${index}"]`);
        const priceInput = proposalViewForm.querySelector(`[data-admin-item-price="${index}"]`);
        const target = productSelect || quantityInput || priceInput;
        target?.focus();
        target?.select?.();
      });
    });
    proposalViewForm.querySelectorAll("[data-admin-remove-proposal-item]").forEach((button) => {
      button.addEventListener("click", () => {
        preserveProposalAdminDraft(proposalViewForm, proposalViewForm.dataset.proposalId);
        state.admin.proposalEditItems.splice(Number(button.dataset.adminRemoveProposalItem), 1);
        render();
      });
    });
    proposalViewForm.querySelector("[data-admin-add-proposal-item]")?.addEventListener("click", () => {
      const select = proposalViewForm.querySelector("[data-admin-add-product]");
      const product = (state.admin.products || []).find((entry) => String(entry.id) === String(select?.value));
      if (!product) {
        setFlash("", "Selecione um produto para incluir.");
        return;
      }
      if (state.admin.proposalEditItems.some((item) => String(item.product_id) === String(product.id))) {
        setFlash("", "Este produto ja esta no pedido. Altere a quantidade no item existente.");
        return;
      }
      preserveProposalAdminDraft(proposalViewForm, proposalViewForm.dataset.proposalId);
      state.admin.proposalEditItems.push({
        product_id: product.id,
        code: product.code,
        name: product.name,
        unit: product.unit,
        quantity: 1,
        negotiated_price: Number(product.price || 0),
      });
      render();
    });
    proposalViewForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const proposalId = event.target.dataset.proposalId;
      if (!proposalId) {
        return;
      }
      try {
        const result = await api(`/api/admin/proposals/${proposalId}`, {
          method: "PATCH",
          body: JSON.stringify(orderAdminPayload(modalRoot, proposalId)),
        });
        await loadRouteData("admin");
        state.admin.activeProposalViewModal = String(proposalId);
        const updatedProposal = getProposalById(proposalId);
        state.admin.proposalEditItems = (updatedProposal?.items || []).map((item) => ({ ...item }));
        setFlash(result.message);
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const requestModalForm = modalRoot.querySelector("#requestModalForm");
  if (requestModalForm) {
    requestModalForm.addEventListener("submit", submitRequestModal);
    wireCustomerAutofill(requestModalForm);
  }

  modalRoot.querySelectorAll("[data-request-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.requestAction;
      if (action === "close") {
        closeRequestModal();
        return;
      }
      if (action === "approve" || action === "deny") {
        const form = modalRoot.querySelector("#requestModalForm");
        if (!form) {
          return;
        }
        const status = action === "approve" ? "aprovada" : "recusada";
        submitRequestModalAction(form, status);
      }
    });
  });

  const productModalForm = modalRoot.querySelector("#productModalForm");
  if (productModalForm) {
    productModalForm.addEventListener("submit", submitProductModal);
  }

  const customerModalForm = modalRoot.querySelector("#customerModalForm");
  if (customerModalForm) {
    customerModalForm.addEventListener("submit", submitCustomerModal);
    wireCustomerAutofill(customerModalForm);
  }

  modalRoot.querySelectorAll("[data-customer-view-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const customerId = button.dataset.customerViewEdit;
      closeCustomerViewModal();
      openCustomerModal("edit", customerId);
    });
  });
  modalRoot.querySelectorAll("[data-customer-performance-pdf]").forEach((button) => {
    button.addEventListener("click", () => openCustomerPerformancePdf(button.dataset.customerPerformancePdf));
  });

  const productImportForm = modalRoot.querySelector("#productImportForm");
  if (productImportForm) {
    productImportForm.addEventListener("submit", submitProductImportModal);
  }

  const companyModalForm = modalRoot.querySelector("#companyModalForm");
  if (companyModalForm) {
    companyModalForm.addEventListener("submit", submitCompanyModal);
  }

  wireAdminOrderModal(modalRoot);

  const assignmentSearch = modalRoot.querySelector("[data-customer-assignment-search]");
  if (assignmentSearch) {
    wireSearchSubmit(modalRoot, "[data-customer-assignment-search]", (value) => {
      state.admin.customerAssignmentSearch = value;
      resetPage("assignmentCustomers");
      render();
    });
  }

  const assignmentFilter = modalRoot.querySelector("[data-customer-assignment-filter]");
  if (assignmentFilter) {
    assignmentFilter.addEventListener("change", () => {
      state.admin.customerAssignmentFilter = assignmentFilter.value;
      resetPage("assignmentCustomers");
      render();
    });
  }

  modalRoot.querySelectorAll("[data-customer-assignment-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => toggleCustomerAssignment(toggle.dataset.customerId, toggle.checked));
  });
  const companyAssignmentSearch = modalRoot.querySelector("[data-company-assignment-search]");
  if (companyAssignmentSearch) {
    wireSearchSubmit(modalRoot, "[data-company-assignment-search]", (value) => {
      state.admin.companyAssignmentSearch = value;
      resetPage("assignmentCompanies");
      render();
    });
  }
  const companyAssignmentFilter = modalRoot.querySelector("[data-company-assignment-filter]");
  if (companyAssignmentFilter) {
    companyAssignmentFilter.addEventListener("change", () => {
      state.admin.companyAssignmentFilter = companyAssignmentFilter.value;
      resetPage("assignmentCompanies");
      render();
    });
  }
  modalRoot.querySelectorAll("[data-company-assignment-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => toggleCompanyAssignment(toggle.dataset.companyId, toggle.checked));
  });
}

export async function submitUserModal(event) {
  event.preventDefault();
  const form = event.target;
  const values = readFormValues(form);
  if (values.email) {
    values.email = String(values.email).trim().toLowerCase().split("@")[0];
  }
  const password = String(values.password || "").trim();
  const temporaryPassword = String(values.temporary_password || "").trim();
  if (temporaryPassword) {
    values.temporary_password = temporaryPassword;
    delete values.password;
  } else if (password) {
    values.password = password;
    delete values.temporary_password;
  } else {
    delete values.password;
    delete values.temporary_password;
    if (form.dataset.userMode === "create") {
      setFlash("", "Informe uma senha normal ou uma senha temporaria.");
      return;
    }
  }
  const mode = form.dataset.userMode;
  const userId = form.dataset.userId;
  const endpoint = mode === "edit" && userId ? `/api/admin/users/${userId}` : "/api/admin/users";
  const method = mode === "edit" && userId ? "PATCH" : "POST";
  try {
    const result = await api(endpoint, {
      method,
      body: JSON.stringify(values),
    });
    await loadRouteData("users");
    state.admin.activeUserModal = null;
    state.message = result.message;
    state.error = "";
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitTempPasswordModal(event) {
  event.preventDefault();
  const form = event.target;
  const values = readFormValues(form);
  const userId = form.dataset.userId;
  if (!userId) {
    return;
  }
  try {
    const result = await api(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        temporary_password: values.temporary_password,
      }),
    });
    await loadRouteData("users");
    state.admin.activeUserModal = null;
    state.message = result.message;
    state.error = "";
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function toggleUserActive(userId, active) {
  try {
    const result = await api(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
    await loadRouteData("users");
    state.message = result.message;
    state.error = "";
    render();
  } catch (error) {
    await loadRouteData("users").catch(() => {});
    setFlash("", error.message);
  }
}

export async function submitForcePasswordChange(event) {
  event.preventDefault();
  const form = event.target;
  const values = readFormValues(form);
  if (String(values.new_password || "") !== String(values.confirm_password || "")) {
    setFlash("", "As senhas nao conferem.");
    return;
  }
  try {
    const result = await api("/api/me/password", {
      method: "POST",
      body: JSON.stringify({
        new_password: values.new_password,
      }),
    });
    state.user = result.user;
    state.mustChangePassword = Boolean(result.user.must_change_password);
    state.message = result.message;
    state.error = "";
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}
