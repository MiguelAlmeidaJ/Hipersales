import {
  renderGlobalModals,
} from "../admin/modals.js";

import {
  renderUsers,
} from "../admin/orders.js";

import {
  renderAdmin,
} from "../admin/settings.js";

import {
  api,
  formData,
  goTo,
  loadRouteData,
  loadSuperAdminData,
  openBlankProposal,
  openProposalForCustomer,
  setFlash,
} from "./api.js";

import {
  resetProposalDraft,
  state,
} from "./state.js";

import {
  app,
  date,
  defaultRouteForUser,
  flashMarkup,
  hydrateResponsiveTables,
  isAdmin,
  isStandalonePwa,
  isSuperAdmin,
  metricCard,
  promptInstallPwa,
  proposalSubmissionBanner,
  routeEyebrow,
  routeTitle,
  safe,
  sectionBand,
  sellerActionButton,
  sellerActionCard,
  sellerIcons,
  uiIcons,
} from "./ui.js";

import {
  renderCompanies,
  renderProducts,
} from "../features/catalog-views.js";

import {
  renderCustomerApprovals,
  renderCustomerRequest,
} from "../features/customer-requests.js";

import {
  renderCustomers,
} from "../features/customers.js";

import {
  renderDashboard,
  renderGoals,
  renderReports,
} from "../features/dashboard.js";

import {
  renderOccurrences,
} from "../features/occurrences.js";

import {
  renderOrders,
  renderProposal,
  renderSellerActivities,
} from "../features/proposals.js";

export function renderSuperAdminShell() {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-shell">
          <img class="brand-mark" src="/assets/logoapp.png" alt="Hipersales" />
          <div class="brand-copy">
            <strong>Hipersales</strong>
            <span>Super admin SaaS</span>
          </div>
        </div>
        <div class="sidebar-group">
          <p class="sidebar-group-label">Plataforma</p>
          <nav class="nav">
            <button class="nav-btn active" data-route="superAdmin">Contas</button>
          </nav>
        </div>
        <div class="sidebar-footer">
          <strong>${safe(state.user.name)}</strong>
          <span>${safe(state.user.email)}</span>
          <small>Acesso master</small>
        </div>
      </aside>
      <section class="content">
        <header class="content-head">
          <div>
            <p class="eyebrow">${safe(routeEyebrow())}</p>
            <h1>${safe(routeTitle())}</h1>
          </div>
          <div class="content-actions">
            <span class="badge brand">Super admin</span>
            <button class="secondary" id="logoutBtn">Sair</button>
          </div>
        </header>
        ${flashMarkup()}
        <div id="view"></div>
      </section>
      <div id="globalModals"></div>
    </div>
  `;
}

export function renderAdminShell() {
  const topNav = [
    { route: "dashboard", label: "Dashboard" },
    { route: "orders", label: "Pedidos" },
    { route: "occurrences", label: "Ocorrencias" },
    { route: "customers", label: "Clientes" },
    { route: "companies", label: "Empresas" },
    { route: "products", label: "Produtos" },
  ];
  const bottomNav = [
    { route: "reports", label: "Relatorios" },
    { route: "goals", label: "Metas" },
    { route: "users", label: "Usuarios" },
    { route: "admin", label: "Configuracoes" },
  ];

  const renderNavGroup = (title, items) => `
    <div class="sidebar-group">
      <p class="sidebar-group-label">${safe(title)}</p>
      <nav class="nav">
        ${items
          .map(
            (item) => `
              <button class="nav-btn ${state.route === item.route ? "active" : ""}" data-route="${item.route}">
                ${safe(item.label)}
              </button>
            `
          )
          .join("")}
      </nav>
    </div>
  `;

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-shell">
          <img class="brand-mark" src="/assets/logoapp.png" alt="Hipersales" />
          <div class="brand-copy">
            <strong>Hipersales</strong>
            <span>Console de gestao</span>
          </div>
        </div>
        ${renderNavGroup("Acoes", topNav)}
        ${renderNavGroup("Gestao", bottomNav)}
        <div class="sidebar-footer">
          <strong>${safe(state.user.name)}</strong>
          <span>${safe(state.user.email)}</span>
          <small>Acesso total ao painel</small>
        </div>
      </aside>
      <section class="content">
        <header class="content-head">
          <div>
            <p class="eyebrow">${safe(routeEyebrow())}</p>
            <h1>${safe(routeTitle())}</h1>
          </div>
          <div class="content-actions">
            ${state.installPrompt && !isStandalonePwa() ? `<button class="secondary icon-text-btn" id="installPwaBtn" type="button">${uiIcons.install}<span>Instalar app</span></button>` : ""}
            <span class="badge brand">Administrador</span>
            <button class="secondary" id="logoutBtn">Sair</button>
          </div>
        </header>
        ${flashMarkup()}
        <div id="view"></div>
      </section>
      <div id="globalModals"></div>
    </div>
  `;
}

export function renderSellerShell() {
  const isHome = state.route === "dashboard";

  return `
    <div class="seller-shell">
      <header class="seller-topbar">
        <div class="brand-shell seller-brand" data-route="dashboard" title="Menu principal">
          <img class="seller-logo-mark" src="/assets/logoapp.png" alt="Hipersales" />
          <div class="brand-copy">
            <strong>Hipersales</strong>
            <span>Portal comercial</span>
          </div>
        </div>
        <div class="seller-topbar-actions">
          ${state.installPrompt && !isStandalonePwa() ? `<button class="secondary icon-text-btn" id="installPwaBtn" type="button">${uiIcons.install}<span>Instalar app</span></button>` : ""}
          <span class="badge brand">Representante comercial</span>
          <button class="secondary seller-logout" id="logoutBtn" type="button">Sair</button>
        </div>
      </header>
      <main class="seller-content">
        ${flashMarkup()}
        ${state.route !== "proposal" ? proposalSubmissionBanner() : ""}
        ${
          isHome
            ? sectionBand({
                id: "sellerHome",
                eyebrow: routeEyebrow(),
                title: routeTitle(),
                body: `
                  <div class="seller-home-stack">
                    <div class="seller-actions seller-actions-primary">
                      ${sellerActionButton(sellerIcons.proposal, "Enviar nova proposta", "", 'data-open-proposal-blank="1"')}
                      ${sellerActionCard("requestCustomer", sellerIcons.requestCustomer, "Solicitar cadastro de cliente")}
                    </div>
                    <div class="seller-actions seller-actions-secondary">
                      ${sellerActionCard("customers", sellerIcons.customers, "Meus clientes")}
                      ${sellerActionCard("orders", sellerIcons.orders, "Consultar pedidos")}
                      ${sellerActionCard("occurrences", uiIcons.alert, "Registrar ocorrências")}
                      ${sellerActionCard("activities", sellerIcons.activities, "Minhas atividades")}
                    </div>
                  </div>
                `,
              })
            : ""
        }
        ${isHome ? "" : `<div id="view"></div>`}
      </main>
      <div id="globalModals"></div>
    </div>
  `;
}

export function render() {
  try {
    if (!state.user) {
      renderLogin();
      return;
    }

    app.innerHTML = isSuperAdmin() ? renderSuperAdminShell() : isAdmin() ? renderAdminShell() : renderSellerShell();
    document.body.classList.toggle(
      "modal-open",
      Boolean(
        !isSuperAdmin() &&
          isAdmin() &&
          (state.admin.activeSettingsModal ||
            state.admin.activeUserModal ||
            state.admin.activeCustomerModal ||
            state.admin.activeRequestModal ||
            state.admin.activeOrderModal ||
            state.admin.activeProposalViewModal ||
            state.admin.activeProductModal ||
            state.admin.activeCompanyModal ||
            state.admin.activeAssignmentModal ||
            state.admin.activeCompanyAssignmentModal)
      ) || Boolean(state.mustChangePassword)
        || Boolean(state.proposalActiveItemModal)
        || Boolean(state.admin.activeProposalViewModal)
    );

    document.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => goTo(button.dataset.route));
    });
    document.querySelectorAll("[data-open-proposal-blank]").forEach((button) => {
      button.addEventListener("click", openBlankProposal);
    });
    document.querySelectorAll("[data-open-proposal-customer]").forEach((button) => {
      button.addEventListener("click", () => openProposalForCustomer(button.dataset.openProposalCustomer));
    });
    const installButton = document.querySelector("#installPwaBtn");
    if (installButton) {
      installButton.addEventListener("click", promptInstallPwa);
    }
    const logoutButton = document.querySelector("#logoutBtn");
    if (logoutButton) {
      logoutButton.addEventListener("click", logout);
    }
    renderView();
  } catch (error) {
    app.innerHTML = `
      <div class="login-shell">
        <section class="login-hero">
          <div class="login-copy">
            <p class="eyebrow light">Hipersales</p>
            <h1>Algo saiu do ar</h1>
            <p>O sistema encontrou um erro ao carregar a interface. Atualize a página ou fale com a equipe tecnica.</p>
          </div>
        </section>
        <section class="login-panel">
          <div class="flash error">${safe(error?.message || "Erro inesperado ao renderizar a tela.")}</div>
        </section>
      </div>
    `;
  }
}

export function renderLogin() {
  app.innerHTML = `
    <div class="login-shell">
      <div class="login-backdrop" aria-hidden="true"></div>
      <section class="login-panel">
        <form class="login-form" id="loginForm">
          <div class="login-brand">
            <img class="login-brand-logo" src="/assets/logoapp.png" alt="HiperSales Web" />
            <div>
              <p class="eyebrow">Força de Vendas</p>
              <h2>Portal de Representantes</h2>
              <p class="login-hint">Faça login para acessar suas informações</p>
            </div>
          </div>
          ${state.error ? `<div class="flash error">${safe(state.error)}</div>` : ""}
          <label>
            Usuário
            <input name="username" type="text" placeholder="Usuário" autocomplete="username" autocapitalize="none" spellcheck="false" required />
          </label>
          <label>
            Senha
            <input name="password" type="password" placeholder="Senha" autocomplete="current-password" required />
          </label>
          <button type="submit">Entrar</button>
          <p class="login-footer">Desenvolvido por HiperSales Web Software</p>
        </form>
      </section>
    </div>
  `;

  document.querySelector("#loginForm").addEventListener("submit", login);
}

export function renderFatalError(message) {
  if (!app) return;
  app.innerHTML = `
    <div class="login-shell">
      <section class="login-hero">
        <div class="login-copy">
          <p class="eyebrow light">Hipersales</p>
          <h1>Erro ao carregar</h1>
          <p>O sistema encontrou um problema inesperado. Atualize a pagina para tentar novamente.</p>
        </div>
      </section>
      <section class="login-panel">
        <div class="flash error">${safe(message || "Erro inesperado no front-end.")}</div>
      </section>
    </div>
  `;
}

export async function login(event) {
  event.preventDefault();
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(formData(event.target)),
    });
    state.user = result.user;
    state.mustChangePassword = Boolean(result.user.must_change_password);
    state.admin.activeSettingsModal = null;
    state.admin.activeUserModal = null;
    state.admin.activeRequestModal = null;
    state.admin.activeOrderModal = null;
    state.admin.activeProposalViewModal = null;
    state.route = defaultRouteForUser(state.user);
    state.message = "";
    state.error = "";
    await loadRouteData(state.route);
    render();
  } catch (error) {
    state.error = error.message;
    renderLogin();
  }
}

export async function logout() {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  state.mustChangePassword = false;
  state.admin.activeSettingsModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeCustomerModal = null;
  state.admin.activeCustomerViewModal = null;
  state.admin.activeRequestModal = null;
  state.admin.activeOrderModal = null;
  state.admin.activeProposalViewModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeCompanyModal = null;
  state.admin.activeAssignmentModal = null;
  state.admin.activeCompanyAssignmentModal = null;
  state.route = "dashboard";
  state.message = "";
  state.error = "";
  state.proposalItems = [];
  state.proposalProducts = [];
  state.proposalSelectedProductId = "";
  state.proposalPrefillCustomerId = "";
  state.proposalLastSubmission = null;
  resetProposalDraft();
  render();
}

export async function renderView() {
  const view = document.querySelector("#view");
  if (!view) {
    renderGlobalModals();
    return;
  }
  if (state.route === "dashboard") {
    if (isAdmin()) {
      await renderDashboard(view);
    }
  } else if (state.route === "superAdmin") {
    renderSuperAdmin(view);
  } else if (state.route === "requestCustomer") {
    renderCustomerRequest(view);
  } else if (state.route === "customers") {
    renderCustomers(view);
  } else if (state.route === "activities") {
    renderSellerActivities(view);
  } else if (state.route === "occurrences") {
    renderOccurrences(view);
  } else if (state.route === "customerApprovals") {
    renderCustomerApprovals(view);
  } else if (state.route === "companies") {
    renderCompanies(view);
  } else if (state.route === "products") {
    renderProducts(view);
  } else if (state.route === "proposal") {
    renderProposal(view);
  } else if (state.route === "orders") {
    renderOrders(view);
  } else if (state.route === "goals") {
    renderGoals(view);
  } else if (state.route === "reports") {
    renderReports(view);
  } else if (state.route === "users") {
    renderUsers(view);
  } else if (state.route === "admin") {
    renderAdmin(view);
  }
  renderGlobalModals();
  hydrateResponsiveTables(view);
  if (state.admin.pendingScrollTarget) {
    const targetId = state.admin.pendingScrollTarget;
    state.admin.pendingScrollTarget = "";
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

export function renderSuperAdmin(view) {
  const overview = state.superAdmin.overview || {};
  const tenants = state.superAdmin.tenants || [];
  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "superAdminSummary",
        span: "span-12",
        eyebrow: "SaaS",
        title: "Visao geral da plataforma",
        body: `
          <div class="metrics-grid">
            ${metricCard("Contas", overview.tenants || 0, "Tenants cadastrados", "blue")}
            ${metricCard("Ativas", overview.active_tenants || 0, "Contas liberadas", "green")}
            ${metricCard("Usuarios", overview.tenant_users || 0, "Sem super admins", "teal")}
            ${metricCard("Pedidos", overview.proposals || 0, "Volume consolidado", "gold")}
          </div>
        `,
      })}
      ${sectionBand({
        id: "newTenant",
        span: "span-12",
        eyebrow: "Nova conta",
        title: "Criar empresa zerada",
        body: `
          <form class="form-grid" id="tenantForm">
            <label>
              Nome da empresa
              <input name="name" placeholder="Ex: Cliente Demo Representacoes" required />
            </label>
            <label>
              Slug
              <input name="slug" placeholder="cliente-demo" />
            </label>
            <label>
              Nome do admin
              <input name="admin_name" placeholder="Responsavel da conta" required />
            </label>
            <label>
              Usuario/e-mail do admin
              <input name="admin_email" placeholder="admin_cliente" required />
            </label>
            <label>
              Senha inicial
              <input name="admin_password" type="password" autocomplete="new-password" required />
            </label>
            <div class="form-actions">
              <button type="submit" class="icon-text-btn">${uiIcons.plus}<span>Criar conta</span></button>
            </div>
          </form>
        `,
      })}
      ${sectionBand({
        id: "tenantList",
        span: "span-12",
        eyebrow: "Contas",
        title: "Empresas cadastradas",
        body: `
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Status</th>
                  <th>Usuarios</th>
                  <th>Clientes</th>
                  <th>Pedidos</th>
                  <th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                ${
                  tenants.length
                    ? tenants.map((tenant) => `
                      <tr>
                        <td>
                          <strong>${safe(tenant.name)}</strong><br />
                          <small>${safe(tenant.slug)}</small>
                        </td>
                        <td><span class="badge ${tenant.status === "active" ? "success" : "danger"}">${tenant.status === "active" ? "Ativa" : "Inativa"}</span></td>
                        <td>${safe(tenant.users_count || 0)}</td>
                        <td>${safe(tenant.customers_count || 0)}</td>
                        <td>${safe(tenant.proposals_count || 0)}</td>
                        <td>${date(tenant.created_at)}</td>
                      </tr>
                    `).join("")
                    : `<tr><td colspan="6">Nenhuma conta cadastrada.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `,
      })}
    </div>
  `;

  hydrateResponsiveTables(view);
  view.querySelector("#tenantForm")?.addEventListener("submit", createTenant);
}

export async function createTenant(event) {
  event.preventDefault();
  try {
    const result = await api("/api/super-admin/tenants", {
      method: "POST",
      body: JSON.stringify(formData(event.target)),
    });
    event.target.reset();
    state.message = result.message || "Conta criada.";
    state.error = "";
    await loadSuperAdminData();
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}
