export const state = {
  user: null,
  mustChangePassword: false,
  route: "dashboard",
  message: "",
  error: "",
  dashboard: null,
  orders: [],
  common: {
    customers: [],
    companies: [],
  },
  occurrences: [],
  occurrenceCustomerId: "",
  occurrenceCustomerSearch: "",
  proposalItems: [],
  proposalProducts: [],
  proposalSelectedProductId: "",
  proposalPrefillCustomerId: "",
  proposalLastSubmission: null,
  activeOccurrenceTimelineId: null,
  proposalDraft: {
    companyId: "",
    customerId: "",
    customerSearch: "",
    orderType: "Venda de Mercadoria",
    freightType: "CIF - Pago pela Industria",
    deliveryType: "Entrega Imediata",
    scheduledDeliveryDate: "",
    purchaseOrder: "",
    paymentTerms: "Pagamento Antecipado",
    discountPercent: "0,00%",
    discountOn: "Sem descontos",
    commissionPercent: "0,00%",
    taxOperatorInvoice: "0",
    notes: "",
  },
  proposalProductPickerBound: false,
  proposalActiveItemModal: null,
  activeTimelineProposalId: null,
  sellerCustomerSearch: "",
  pagination: {},
  installPrompt: null,
  admin: {
    overview: null,
    customers: [],
    companies: [],
    products: [],
    users: [],
    requests: [],
    occurrences: [],
    occurrenceSearch: "",
    occurrenceStatusFilter: "all",
    occurrenceReasonFilter: "all",
    occurrenceSellerFilter: "",
    occurrenceDateFrom: "",
    occurrenceDateTo: "",
    proposals: [],
    outbox: [],
    goals: null,
    goalsMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
    goalsYear: String(new Date().getFullYear()),
    orderSearch: "",
    orderStatusFilter: "all",
    orderSellerFilter: "",
    orderCompanyFilter: "",
    orderCustomerFilter: "",
    orderDateFrom: "",
    orderDateTo: "",
    orderMinTotal: "",
    orderMaxTotal: "",
    dashboardSearch: "",
    dashboardStatusFilter: "all",
    dashboardDateFrom: "",
    dashboardDateTo: "",
    reportType: "vendas",
    reportDateFrom: "",
    reportDateTo: "",
    reportSellerId: "",
    reportCompanyId: "",
    reportCustomerId: "",
    reportStatus: "",
    activeOrderModal: null,
    activeProposalViewModal: null,
    proposalEditItems: [],
    productFilterCompanyId: "",
    productSearch: "",
    productActiveFilter: "all",
    customerSearch: "",
    customerActiveFilter: "all",
    companySearch: "",
    companyActiveFilter: "all",
    settings: null,
    placeholders: [],
    activeSettingsModal: null,
    activeUserModal: null,
    activeCustomerModal: null,
    activeCustomerViewModal: null,
    activeRequestModal: null,
    activeProductModal: null,
    activeCompanyModal: null,
    activeAssignmentModal: null,
    activeProposalViewModal: null,
    userSearch: "",
    customerAssignmentSellerId: "",
    customerAssignmentSearch: "",
    customerAssignmentFilter: "all",
    customerAssignments: [],
    customerAssignmentSeller: null,
    companyAssignmentSearch: "",
    companyAssignmentFilter: "all",
    companyAssignments: [],
    companyAssignmentSeller: null,
    activeCompanyAssignmentModal: null,
    pendingScrollTarget: "",
  },
  superAdmin: {
    overview: null,
    tenants: [],
  },
  sellerActivityMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
  sellerActivityYear: String(new Date().getFullYear()),
  sellerGoals: null,
};

export const defaultPageSize = 10;
export const apiCache = new Map();
export const apiCacheTtlMs = 20000;


export function invalidateApiCache() {
  apiCache.clear();
}



export function currentPage(key) {
  return Math.max(1, Number(state.pagination[key] || 1));
}

export function resetPage(key) {
  state.pagination[key] = 1;
}

export function resetProposalDraft(preset = {}) {
  state.proposalDraft = {
    companyId: "",
    customerId: "",
    customerSearch: "",
    orderType: "Venda de Mercadoria",
    freightType: "CIF - Pago pela Industria",
    deliveryType: "Entrega Imediata",
    scheduledDeliveryDate: "",
    purchaseOrder: "",
    paymentTerms: "Pagamento Antecipado",
    discountPercent: "0,00%",
    discountOn: "Sem descontos",
    commissionPercent: "0,00%",
    taxOperatorInvoice: "0",
    notes: "",
    ...preset,
  };
}

export function syncProposalDraftField(name, value) {
  const fieldMap = {
    company_id: "companyId",
    customer_id: "customerId",
    order_type: "orderType",
    freight_type: "freightType",
    delivery_type: "deliveryType",
    scheduled_delivery_date: "scheduledDeliveryDate",
    purchase_order: "purchaseOrder",
    payment_terms: "paymentTerms",
    discount_percent: "discountPercent",
    discount_on: "discountOn",
    commission_percent: "commissionPercent",
    tax_operator_invoice: "taxOperatorInvoice",
    notes: "notes",
  };
  const mapped = fieldMap[name];
  if (!mapped) return;
  state.proposalDraft[mapped] = value;
}

export function setPage(key, page) {
  state.pagination[key] = Math.max(1, Number(page || 1));
}

export function paginateItems(key, items, pageSize = defaultPageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(currentPage(key), totalPages);
  state.pagination[key] = page;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    totalPages,
    totalItems,
    start,
    end: Math.min(start + pageSize, totalItems),
  };
}
