import {
  clearWhatsAppSettingsRefresh,
  readFormValues,
} from "../admin/settings.js";

import {
  render,
  renderFatalError,
} from "./shell.js";

import {
  apiCache,
  apiCacheTtlMs,
  invalidateApiCache,
  resetProposalDraft,
  state,
} from "./state.js";

import {
  defaultRouteForUser,
  isAdmin,
  isSuperAdmin,
} from "./ui.js";

export async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const useCache = method === "GET" && !options.skipCache;
  const { skipCache, ...fetchOptions } = options;
  const cached = useCache ? apiCache.get(path) : null;
  if (cached && Date.now() - cached.createdAt < apiCacheTtlMs) {
    return cached.promise;
  }

  if (!useCache) {
    invalidateApiCache();
  }

  const request = fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Erro na requisicao.");
    }
    return data;
  });

  if (useCache) {
    apiCache.set(path, { createdAt: Date.now(), promise: request });
    request.catch(() => apiCache.delete(path));
  }

  return request;
}

export function formData(form) {
  return readFormValues(form);
}

export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve({
        filename: file.name,
        mimetype: file.type || "application/octet-stream",
        content: result.includes(",") ? result.split(",", 2)[1] : result,
      });
    };
    reader.onerror = () => reject(new Error(`Nao foi possivel ler o anexo ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function setFlash(message, error = "") {
  state.message = message;
  state.error = error;
  render();
}

export async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => {});
  }

  try {
    const session = await api("/api/me");
    state.user = session.user;
    state.mustChangePassword = Boolean(session.user.must_change_password);
    state.route = window.location.pathname === "/super_admin" && isSuperAdmin() ? "superAdmin" : defaultRouteForUser(state.user);
    await loadRouteData(state.route);
  } catch {
    state.user = null;
    state.mustChangePassword = false;
  }

  render();
}

window.addEventListener("error", (event) => {
  const message = event?.error?.message || event?.message;
  if (message) {
    renderFatalError(message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const message =
    reason && typeof reason === "object"
      ? reason.message || JSON.stringify(reason)
      : String(reason || "Falha nao tratada.");
  renderFatalError(message);
});

export async function loadCommonData() {
  const [customers, companies] = await Promise.all([api("/api/customers"), api("/api/companies")]);
  state.common.customers = customers.customers;
  state.common.companies = companies.companies;
}

export async function loadDashboardData() {
  const { summary } = await api("/api/dashboard");
  state.dashboard = summary;
}

export async function loadOrdersData() {
  const { proposals } = await api("/api/proposals");
  state.orders = proposals;
}

export async function loadOccurrencesData() {
  const { occurrences } = await api("/api/occurrences", { skipCache: true });
  state.occurrences = occurrences || [];
  state.admin.occurrences = occurrences || [];
}

export async function loadSellerGoals() {
  const year = state.sellerActivityYear || String(new Date().getFullYear());
  const month = state.sellerActivityMonth || String(new Date().getMonth() + 1).padStart(2, "0");
  const result = await api(`/api/goals/my?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`, { skipCache: true });
  state.sellerGoals = result.goals || null;
}

export async function loadAdminGoals() {
  const year = state.admin.goalsYear || String(new Date().getFullYear());
  const month = state.admin.goalsMonth || String(new Date().getMonth() + 1).padStart(2, "0");
  const result = await api(`/api/admin/goals?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`, { skipCache: true });
  state.admin.goals = result;
}

export async function loadAdminData() {
  const [
    overview,
    customers,
    companies,
    products,
    users,
    requests,
    occurrences,
    proposals,
    outbox,
    settings,
  ] = await Promise.all([
    api("/api/admin/overview"),
    api("/api/admin/customers"),
    api("/api/admin/companies"),
    api("/api/admin/products"),
    api("/api/admin/users"),
    api("/api/admin/requests"),
    api("/api/occurrences", { skipCache: true }),
    api("/api/proposals"),
    api("/api/admin/outbox"),
    api("/api/admin/settings"),
  ]);

  state.admin.overview = overview;
  state.admin.customers = customers.customers;
  state.common.customers = customers.customers.filter((customer) => customer.active);
  state.common.companies = companies.companies;
  state.admin.companies = companies.companies;
  state.admin.products = products.products;
  state.admin.users = users.users;
  state.admin.requests = requests.requests;
  state.admin.occurrences = occurrences.occurrences || [];
  state.occurrences = occurrences.occurrences || [];
  state.admin.proposals = proposals.proposals;
  state.orders = proposals.proposals;
  state.admin.outbox = outbox.outbox;
  state.admin.settings = settings.settings;
  state.admin.placeholders = settings.placeholders || [];

  const sellers = users.users.filter((user) => user.role === "seller");
  const preferredSellerId = sellers.find((user) => String(user.id) === String(state.admin.customerAssignmentSellerId))?.id || sellers[0]?.id || "";
  state.admin.customerAssignmentSellerId = preferredSellerId ? String(preferredSellerId) : "";
  if ((state.route === "users" || state.admin.activeAssignmentModal || state.admin.activeCompanyAssignmentModal) && state.admin.customerAssignmentSellerId) {
    await Promise.all([
      loadCustomerAssignments(state.admin.customerAssignmentSellerId),
      loadCompanyAssignments(state.admin.customerAssignmentSellerId),
    ]);
  } else {
    state.admin.customerAssignments = [];
    state.admin.customerAssignmentSeller = null;
    state.admin.companyAssignments = [];
    state.admin.companyAssignmentSeller = null;
  }
}

export async function loadSuperAdminData() {
  const overview = await api("/api/super-admin/overview");
  state.superAdmin.overview = overview.summary || {};
  state.superAdmin.tenants = overview.tenants || [];
}

export async function loadCustomerAssignments(sellerId) {
  const selectedSellerId = String(sellerId || "").trim();
  if (!selectedSellerId) {
    state.admin.customerAssignments = [];
    state.admin.customerAssignmentSeller = null;
    return;
  }
  const result = await api(`/api/admin/users/${selectedSellerId}/customers`);
  state.admin.customerAssignmentSellerId = selectedSellerId;
  state.admin.customerAssignments = result.customers || [];
  state.admin.customerAssignmentSeller = result.seller || null;
}

export async function loadCompanyAssignments(sellerId) {
  const selectedSellerId = String(sellerId || "").trim();
  if (!selectedSellerId) {
    state.admin.companyAssignments = [];
    state.admin.companyAssignmentSeller = null;
    return;
  }
  const result = await api(`/api/admin/users/${selectedSellerId}/companies`);
  state.admin.companyAssignments = result.companies || [];
  state.admin.companyAssignmentSeller = result.seller || null;
}

export async function loadRouteData(route) {
  if (!state.user) return;
  if (isSuperAdmin()) {
    await loadSuperAdminData();
    return;
  }
  if (route === "dashboard") {
    if (isAdmin()) {
      await Promise.all([loadDashboardData(), loadAdminData()]);
    }
    return;
  }
  if (isAdmin()) {
    if (["orders", "occurrences", "customers", "customerApprovals", "companies", "products", "users", "admin", "goals", "reports"].includes(route)) {
      await loadAdminData();
      if (route === "goals") {
        await loadAdminGoals();
      }
    }
    return;
  }
  if (route === "customers" || route === "proposal") {
    await loadCommonData();
    return;
  }
  if (route === "orders") {
    await loadOrdersData();
    return;
  }
  if (route === "occurrences") {
    await Promise.all([loadCommonData(), loadOccurrencesData()]);
    return;
  }
  if (route === "activities") {
    await Promise.all([loadCommonData(), loadOrdersData(), loadSellerGoals()]);
    return;
  }
}

export async function goTo(route) {
  clearWhatsAppSettingsRefresh();
  if (isSuperAdmin()) {
    route = "superAdmin";
    state.route = route;
    state.message = "";
    state.error = "";
    render();
    try {
      await loadRouteData(route);
    } catch (error) {
      state.error = error.message;
    }
    render();
    return;
  }
  if (!isAdmin() && !["dashboard", "proposal", "orders", "requestCustomer", "customers", "activities", "occurrences"].includes(route)) {
    route = "dashboard";
  }
  if (route === "customerApprovals" && !isAdmin()) {
    route = "dashboard";
  }
  if (route === "admin" && !isAdmin()) {
    route = "dashboard";
  }
  if (route === "customers" && isAdmin()) {
    route = "customers";
  }
  if (route === "companies" && !isAdmin()) {
    route = "dashboard";
  }
  if (route === "products" && !isAdmin()) {
    route = "dashboard";
  }
  if (route === "proposal" && isAdmin()) {
    route = "orders";
  }
  if (route === "requestCustomer" && isAdmin()) {
    route = "admin";
  }
  if (route === "users" && !isAdmin()) {
    route = "dashboard";
  }

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
  state.admin.pendingScrollTarget = "";
  state.route = route;
  state.message = "";
  state.error = "";
  render();

  try {
    await loadRouteData(route);
  } catch (error) {
    state.error = error.message;
  }

  render();
}

export async function goToCustomersApprovals() {
  if (!isAdmin()) {
    return;
  }
  await goTo("customerApprovals");
}

export async function openBlankProposal() {
  state.proposalPrefillCustomerId = "";
  state.proposalItems = [];
  state.proposalProducts = [];
  state.proposalSelectedProductId = "";
  state.proposalLastSubmission = null;
  resetProposalDraft();
  await goTo("proposal");
}

export async function openProposalForCustomer(customerId) {
  state.proposalPrefillCustomerId = String(customerId || "");
  state.proposalItems = [];
  state.proposalProducts = [];
  state.proposalSelectedProductId = "";
  state.proposalLastSubmission = null;
  const customer = state.common.customers.find((entry) => String(entry.id) === String(customerId)) || null;
  resetProposalDraft({
    customerId: String(customerId || ""),
    customerSearch: customer ? `${customer.legal_name} - ${customer.cnpj}` : "",
  });
  await goTo("proposal");
}
