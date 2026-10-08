import {
  deleteProposal,
  updateProposalStatus,
} from "../admin/catalog.js";

import {
  openOrderModal,
  openProposalViewModal,
  orderAdminPayload,
  renderProposalsTable,
  syncPaymentTermsForOrderType,
} from "../admin/orders.js";

import {
  renderSettingsModalShell,
} from "../admin/settings.js";

import {
  api,
  formData,
  loadRouteData,
  loadSellerGoals,
  setFlash,
} from "../core/api.js";

import {
  render,
} from "../core/shell.js";

import {
  paginateItems,
  resetPage,
  resetProposalDraft,
  state,
  syncProposalDraftField,
} from "../core/state.js";

import {
  companyOptions,
  customerOptions,
  date,
  datetime,
  formatCurrencyValue,
  formatPercentValue,
  invoiceTypeOptions,
  isAdmin,
  isBonusOrderType,
  money,
  nowForInput,
  parseAppDate,
  parseCurrencyValue,
  parsePercentValue,
  paymentTermsOptions,
  proposalSubmissionBanner,
  renderPagination,
  resetPercentInputs,
  routeEyebrow,
  routeTitle,
  safe,
  searchActionField,
  sellerIcons,
  sellerOptions,
  softStatusColor,
  statusInfo,
  statusMeta,
  statusOptions,
  taxOperatorLabel,
  taxOperatorOptions,
  uiIcons,
  wirePagination,
  wireSearchSubmit,
} from "../core/ui.js";

import {
  goalNumber,
} from "./dashboard.js";

import {
  getOccurrenceById,
  normalizeOccurrenceStatus,
  occurrenceStatusLabel,
  occurrenceStatusTone,
} from "./occurrences.js";

export function renderProposalCustomerPreview(customer) {
  if (!customer) {
    return `
      <div class="proposal-customer-empty">
        <strong>Selecione um cliente</strong>
        <span>Use a lista de clientes ou o seletor para preencher o pedido automaticamente.</span>
      </div>
    `;
  }

  return `
    <article class="proposal-customer-card">
      <div class="proposal-customer-copy">
        <p class="eyebrow">Cliente selecionado</p>
        <h3>${safe(customer.legal_name || customer.trade_name || "Cliente")}</h3>
        <p>${safe(customer.trade_name || "Sem nome fantasia")} | ${safe(customer.cnpj || "")}</p>
      </div>
      <div class="proposal-customer-meta">
        <span><strong>Telefone</strong>${safe(customer.phone || "Nao informado")}</span>
        <span><strong>Endereco</strong>${safe(customer.address || "Nao informado")}</span>
        <span><strong>IE</strong>${safe(customer.state_registration || "Nao informada")}</span>
        <span><strong>E-mail</strong>${safe(customer.email || "Nao informado")}</span>
      </div>
    </article>
  `;
}

export function renderProposal(view) {
  const draft = state.proposalDraft || {};
  const selectedCompanyId = String(draft.companyId || "");
  const selectedCustomerId = String(draft.customerId || state.proposalPrefillCustomerId || "");
  const selectedCustomer = state.common.customers.find((customer) => String(customer.id) === selectedCustomerId) || null;
  const selectedCompany = state.common.companies.find((company) => String(company.id) === selectedCompanyId) || null;
  const deliveryType = String(draft.deliveryType || "Entrega Imediata");
  const orderType = String(draft.orderType || "Venda de Mercadoria");
  const freightType = String(draft.freightType || "CIF - Pago pela Industria");
  const isBonus = isBonusOrderType(orderType);
  const paymentTerms = isBonus ? "" : String(draft.paymentTerms || "Pagamento Antecipado");
  const discountOn = isBonus ? "Sem descontos" : String(draft.discountOn || "Sem descontos");
  const discountPercent = isBonus ? "0,00%" : String(draft.discountPercent || "0,00%");
  const commissionPercent = isBonus ? "0,00%" : String(draft.commissionPercent || "0,00%");
  const taxOperatorInvoice = String(draft.taxOperatorInvoice ?? "0");
  view.innerHTML = `
    <div class="proposal-grid">
      <section class="section-band span-12 seller-proposal-panel">
        <header class="section-head">
          <div>
            <p class="eyebrow">Pedido</p>
            <h2>Novo pedido</h2>
          </div>
        </header>
        <div class="section-body">
          ${proposalSubmissionBanner()}
          <form class="seller-order-form" id="proposalForm">
            <section class="seller-order-card">
              <div class="seller-order-card-head">
                <span class="step-badge">1</span>
                <h3>Cabecalho</h3>
              </div>
              <div class="seller-order-grid">
                <label>
                  Data e hora de emissao
                  <input value="${safe(nowForInput())}" readonly />
                </label>
                <label>
                  Empresa (Fornecedor)
                  <select name="company_id" id="companySelect" required>
                    <option value="">Selecione</option>
                    ${companyOptions(selectedCompanyId)}
                  </select>
                </label>
                <label class="span-2 product-picker">
                  Pesquisar cliente
                  ${searchActionField(`<input id="customerSearchSelect" type="text" autocomplete="off" placeholder="Digite razao social ou CNPJ" value="${safe(draft.customerSearch || (selectedCustomer ? `${selectedCustomer.legal_name} - ${selectedCustomer.cnpj}` : ""))}" />`)}
                  <input name="customer_id" id="customerSelect" type="hidden" value="${safe(selectedCustomerId)}" required />
                  <div class="product-suggestions" id="customerSuggestions" hidden></div>
                </label>
              </div>
              <div class="proposal-summary-grid">
                <article class="proposal-summary-card">
                  <span>Empresa selecionada</span>
                  <strong>${safe(selectedCompany?.name || "Nenhuma empresa selecionada")}</strong>
                  <small>${safe(selectedCompany?.legal_name || "Escolha a empresa antes de adicionar itens")}</small>
                </article>
                <article class="proposal-summary-card">
                  <span>Cliente selecionado</span>
                  <strong>${safe(selectedCustomer?.legal_name || "Nenhum cliente selecionado")}</strong>
                  <small>${safe(selectedCustomer?.trade_name || selectedCustomer?.cnpj || "Use a busca acima para selecionar um cliente")}</small>
                </article>
              </div>
              <div class="proposal-customer-preview" id="proposalCustomerPreview">
                ${renderProposalCustomerPreview(selectedCustomer)}
              </div>
              <div class="seller-order-grid tax-operator-block">
                <label class="span-2">
                  Nota Fiscal via Operador Fiscal?
                  <select name="tax_operator_invoice" required>
                    ${taxOperatorOptions.map((option) => `<option value="${safe(option.value)}" ${taxOperatorInvoice === option.value ? "selected" : ""}>${safe(option.label)}</option>`).join("")}
                  </select>
                </label>
                <div class="span-2 tax-operator-alert">
                  <strong>Atenção ao faturamento</strong>
                  <span>Se for faturar a Nota Fiscal através de um Operador Fiscal, informe no campo de observações qual será o operador desta venda.</span>
                </div>
              </div>
            </section>

            <section class="seller-order-card">
              <div class="seller-order-card-head">
                <span class="step-badge">2</span>
                <h3>Condicoes da proposta</h3>
              </div>
              <div class="seller-order-grid">
                <label>
                  Natureza da Operacao
                  <select name="order_type" required>
                    <option value="Venda de Mercadoria" ${orderType === "Venda de Mercadoria" ? "selected" : ""}>Venda de Mercadoria</option>
                    <option value="Bonificacao" ${orderType === "Bonificacao" ? "selected" : ""}>Bonificacao</option>
                  </select>
                </label>
                <label>
                  Frete
                  <select name="freight_type" required>
                    <option value="CIF - Pago pela Industria" ${freightType === "CIF - Pago pela Industria" ? "selected" : ""}>CIF - Pago pela Industria</option>
                    <option value="FOB - Pago pelo Cliente" ${freightType === "FOB - Pago pelo Cliente" ? "selected" : ""}>FOB - Pago pelo Cliente</option>
                  </select>
                </label>
                <label>
                  Tipo de Entrega
                  <select name="delivery_type" id="deliveryTypeSelect" required>
                    <option value="Entrega Imediata" ${deliveryType === "Entrega Imediata" ? "selected" : ""}>Entrega Imediata</option>
                    <option value="Entrega Programada" ${deliveryType === "Entrega Programada" ? "selected" : ""}>Entrega Programada</option>
                  </select>
                </label>
                <label>
                  Data Programada Entrega
                  <input name="scheduled_delivery_date" id="scheduledDeliveryDate" type="date" value="${safe(draft.scheduledDeliveryDate || "")}" ${deliveryType !== "Entrega Programada" ? "disabled" : ""} />
                </label>
                <label>
                  Ordem de Compras Cliente
                  <input name="purchase_order" value="${safe(draft.purchaseOrder || "")}" />
                </label>
                <label>
                  Forma de Pagamento
                  <select name="payment_terms" ${isBonus ? "disabled" : "required"}>
                    <option value="" ${isBonus ? "selected" : ""}>Sem pagamento</option>
                    ${paymentTermsOptions.map((option) => `<option value="${safe(option)}" ${paymentTerms === option ? "selected" : ""}>${safe(option)}</option>`).join("")}
                  </select>
                </label>
                <label>
                  %Desconto
                  <input name="discount_percent" type="text" inputmode="decimal" autocomplete="off" value="${safe(discountPercent)}" data-percent-input ${isBonus ? "disabled" : ""} />
                  ${isBonus ? `<span class="field-help">Nao tem desconto em bonificacao.</span>` : ""}
                </label>
                <label>
                  Desconto em
                  <select name="discount_on" ${isBonus ? "disabled" : ""}>
                    <option value="Sem descontos" ${discountOn === "Sem descontos" ? "selected" : ""}>Sem descontos</option>
                    <option value="Boleto Bancario" ${discountOn === "Boleto Bancario" ? "selected" : ""}>Boleto Bancario</option>
                    <option value="Nota Fiscal" ${discountOn === "Nota Fiscal" ? "selected" : ""}>Nota Fiscal</option>
                  </select>
                </label>
                <label>
                  %Comissao
                  <input name="commission_percent" type="text" inputmode="decimal" autocomplete="off" value="${safe(commissionPercent)}" data-percent-input ${isBonus ? "disabled" : ""} />
                  ${isBonus ? `<span class="field-help">Sem comissao em bonificacao.</span>` : ""}
                </label>
                <label class="span-2">
                  Observacoes
                  <textarea name="notes">${safe(draft.notes || "")}</textarea>
                </label>
              </div>
            </section>

            <section class="seller-order-card">
              <div class="seller-order-card-head">
                <span class="step-badge">3</span>
                <h3>Itens</h3>
              </div>
              <div class="seller-product-entry">
                <label class="product-picker product-picker-large">
                  Produto
                  ${searchActionField(`<input id="productSearch" type="text" autocomplete="off" placeholder="Digite o nome ou codigo" />`)}
                  <input id="productSelect" type="hidden" value="" />
                  <div class="product-suggestions" id="productSuggestions" hidden></div>
                </label>
              </div>
              <div class="proposal-items-shell" id="proposalItemsTable"></div>
            </section>

            <div class="seller-order-submit">
              <button type="submit">Enviar Proposta</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;

  const companySelect = document.querySelector("#companySelect");
  const customerSelect = document.querySelector("#customerSelect");
  const customerSearchSelect = document.querySelector("#customerSearchSelect");
  const customerSuggestions = document.querySelector("#customerSuggestions");
  const productSearch = document.querySelector("#productSearch");
  const productSelect = document.querySelector("#productSelect");
  const productSuggestions = document.querySelector("#productSuggestions");
  const deliveryTypeSelect = document.querySelector("#deliveryTypeSelect");
  const scheduledDeliveryDate = document.querySelector("#scheduledDeliveryDate");

  companySelect.addEventListener("change", async () => {
    syncProposalDraftField("company_id", companySelect.value);
    await loadProposalProducts(companySelect.value);
  });
  customerSearchSelect?.addEventListener("input", () => {
    state.proposalDraft.customerSearch = customerSearchSelect.value;
  });
  customerSearchSelect?.addEventListener("change", () => {
    state.proposalDraft.customerSearch = customerSearchSelect.value;
  });

  const renderCustomerSuggestions = () => {
    const query = String(customerSearchSelect?.value || "").trim().toLowerCase();
    const matches = state.common.customers
      .filter((customer) => {
        if (!query) return true;
        return [customer.legal_name, customer.trade_name, customer.cnpj].join(" ").toLowerCase().includes(query);
      })
      .slice(0, 10);
    customerSuggestions.innerHTML = matches.length
      ? matches
          .map(
            (customer) => `
              <button type="button" class="product-suggestion" data-customer-id="${safe(customer.id)}">
                <strong>${safe(customer.legal_name)}</strong>
                <span>${safe(customer.trade_name || "Sem fantasia")} • ${safe(customer.cnpj)}</span>
              </button>
            `
          )
          .join("")
      : `<div class="product-suggestions-empty">Nenhum cliente vinculado encontrado.</div>`;
    customerSuggestions.hidden = false;
  };

  wireSearchSubmit(document, "#customerSearchSelect", () => {
    customerSelect.value = "";
    state.proposalPrefillCustomerId = "";
    syncProposalDraftField("customer_id", "");
    state.proposalDraft.customerSearch = String(customerSearchSelect?.value || "");
    renderCustomerSuggestions();
    document.querySelectorAll("#proposalCustomerPreview").forEach((preview) => {
      preview.innerHTML = renderProposalCustomerPreview(null);
    });
  });
  customerSuggestions?.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-customer-id]");
    if (!button) return;
    event.preventDefault();
    const customer = state.common.customers.find((entry) => String(entry.id) === String(button.dataset.customerId));
    if (!customer) return;
    customerSelect.value = String(customer.id);
    state.proposalPrefillCustomerId = String(customer.id);
    syncProposalDraftField("customer_id", String(customer.id));
    state.proposalDraft.customerSearch = `${customer.legal_name} - ${customer.cnpj}`;
    customerSearchSelect.value = `${customer.legal_name} - ${customer.cnpj}`;
    customerSuggestions.hidden = true;
    document.querySelectorAll("#proposalCustomerPreview").forEach((preview) => {
      preview.innerHTML = renderProposalCustomerPreview(customer);
    });
  });
  customerSearchSelect?.addEventListener("change", () => {
    const selected = state.common.customers.find((entry) => String(entry.id) === String(customerSelect.value));
    if (!selected || customerSearchSelect.value !== `${selected.legal_name} - ${selected.cnpj}`) {
      customerSelect.value = "";
      state.proposalPrefillCustomerId = "";
      syncProposalDraftField("customer_id", "");
      state.proposalDraft.customerSearch = String(customerSearchSelect.value || "");
    }
  });

  deliveryTypeSelect?.addEventListener("change", () => {
    syncProposalDraftField("delivery_type", deliveryTypeSelect.value);
    const enabled = deliveryTypeSelect.value === "Entrega Programada";
    scheduledDeliveryDate.disabled = !enabled;
    if (!enabled) scheduledDeliveryDate.value = "";
    if (!enabled) {
      state.proposalDraft.scheduledDeliveryDate = "";
    }
  });

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
        const code = String(product.code || "").toLowerCase();
        const name = String(product.name || "").toLowerCase();
        const unit = String(product.unit || "").toLowerCase();
        const haystack = `${code} ${name} ${unit}`;
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

    if (!ranked.length) {
      productSuggestions.innerHTML = `<div class="product-suggestions-empty">Nenhum produto encontrado.</div>`;
      productSuggestions.hidden = false;
      return;
    }

    productSuggestions.innerHTML = ranked
      .map((product) => {
        const active = String(product.id) === selectedId ? "is-selected" : "";
        return `
          <button type="button" class="product-suggestion ${active}" data-product-id="${safe(product.id)}">
            <strong>${safe(product.code)} - ${safe(product.name)}</strong>
            <span>${safe(product.unit || "UN")} • ${safe(money(product.price))}</span>
          </button>
        `;
      })
      .join("");
    productSuggestions.hidden = false;
  };

  const chooseProduct = (productId) => {
    const product = state.proposalProducts.find((entry) => String(entry.id) === String(productId));
    if (!product) return;
    state.proposalSelectedProductId = String(product.id);
    productSelect.value = String(product.id);
    productSearch.value = `${product.code} - ${product.name}`;
    if (productSuggestions) {
      productSuggestions.hidden = true;
      productSuggestions.innerHTML = "";
    }
    productSearch.blur();
    openProposalItemModal(product.id);
  };

  wireSearchSubmit(document, "#productSearch", () => {
    state.proposalSelectedProductId = "";
    productSelect.value = "";
    renderProductSuggestions(productSearch.value);
  });
  productSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && productSuggestions) {
      productSuggestions.hidden = true;
    }
  });
  productSearch.addEventListener("change", () => {
    const selected = state.proposalProducts.find((entry) => String(entry.id) === String(productSelect.value));
    if (!selected || productSearch.value !== `${selected.code} - ${selected.name}`) {
      state.proposalSelectedProductId = "";
      productSelect.value = "";
    }
  });

  productSuggestions?.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-product-id]");
    if (!button) return;
    event.preventDefault();
    chooseProduct(button.dataset.productId);
  });

  if (!state.proposalProductPickerBound) {
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".product-picker")) {
        document.querySelector("#productSuggestions")?.setAttribute("hidden", "");
      }
    });
    state.proposalProductPickerBound = true;
  }

  document.querySelector("#proposalForm").addEventListener("submit", submitProposal);
  document.querySelector("#proposalForm").addEventListener("input", (event) => {
    const field = event.target.closest?.("input[name], select[name], textarea[name]");
    if (!field) return;
    syncProposalDraftField(field.name, field.value);
    if (field.name === "company_id") {
      state.proposalDraft.companyId = field.value;
    }
    if (field.name === "customer_id") {
      state.proposalDraft.customerId = field.value;
    }
    if (field.name === "scheduled_delivery_date") {
      state.proposalDraft.scheduledDeliveryDate = field.value;
    }
    if (field.name === "order_type") {
      syncPaymentTermsForOrderType(document.querySelector("#proposalForm"));
    }
  });
  document.querySelector("#proposalForm").addEventListener("change", (event) => {
    const field = event.target.closest?.("input[name], select[name], textarea[name]");
    if (!field) return;
    syncProposalDraftField(field.name, field.value);
    if (field.name === "company_id") {
      state.proposalDraft.companyId = field.value;
    }
    if (field.name === "customer_id") {
      state.proposalDraft.customerId = field.value;
    }
    if (field.name === "scheduled_delivery_date") {
      state.proposalDraft.scheduledDeliveryDate = field.value;
    }
    if (field.name === "order_type") {
      syncPaymentTermsForOrderType(document.querySelector("#proposalForm"));
    }
  });
  syncPaymentTermsForOrderType(document.querySelector("#proposalForm"));
  drawProposalItemsTable();

  if (selectedCustomerId) {
    state.proposalPrefillCustomerId = selectedCustomerId;
  }
  if (selectedCompanyId) {
    state.proposalDraft.companyId = selectedCompanyId;
  }
  state.proposalDraft.customerId = selectedCustomerId;

  if (companySelect.value) {
    loadProposalProducts(companySelect.value);
  }
}

export async function loadProposalProducts(companyId) {
  if (!companyId) {
    state.proposalProducts = [];
    state.proposalSelectedProductId = "";
    const input = document.querySelector("#productSearch");
    const hidden = document.querySelector("#productSelect");
    const suggestions = document.querySelector("#productSuggestions");
    if (input) input.value = "";
    if (hidden) hidden.value = "";
    if (suggestions) {
      suggestions.hidden = true;
      suggestions.innerHTML = `<div class="product-suggestions-empty">Selecione uma empresa para liberar os produtos.</div>`;
    }
    return;
  }

  const data = await api(`/api/products?company_id=${encodeURIComponent(companyId)}`);
  state.proposalProducts = data.products;
  state.proposalSelectedProductId = "";
  const input = document.querySelector("#productSearch");
  const hidden = document.querySelector("#productSelect");
  const suggestions = document.querySelector("#productSuggestions");
  if (input) input.value = "";
  if (hidden) hidden.value = "";
  if (suggestions) {
    suggestions.hidden = true;
    suggestions.innerHTML = `
      ${state.proposalProducts
        .slice(0, 8)
        .map(
          (product) => `
            <button type="button" class="product-suggestion" data-product-id="${safe(product.id)}">
              <strong>${safe(product.code)} - ${safe(product.name)}</strong>
              <span>${safe(product.unit || "UN")} • ${safe(money(product.price))}</span>
            </button>
          `
        )
        .join("")}
    `;
  }
}

export function openProposalItemModal(productId, index = null) {
  const existing = index !== null ? state.proposalItems[Number(index)] : null;
  const product = state.proposalProducts.find((entry) => String(entry.id) === String(productId)) || existing;
  if (!product) return;
  state.proposalActiveItemModal = {
    product_id: product.product_id || product.id,
    code: product.code,
    name: product.name,
    unit: product.unit || "UN",
    quantity: existing?.quantity || "",
    negotiated_price: existing?.negotiated_price || product.price || 0,
    index: index === null ? null : Number(index),
  };
  render();
}

export function closeProposalItemModal() {
  state.proposalActiveItemModal = null;
  state.proposalSelectedProductId = "";
  render();
}

export function saveProposalItemFromModal(form) {
  const modal = state.proposalActiveItemModal;
  if (!modal) return;
  const quantity = Number(form.quantity.value || 0);
  const negotiatedPrice = parseCurrencyValue(form.negotiated_price.value);

  if (!quantity || quantity <= 0) {
    setFlash("", "Informe uma quantidade valida.");
    return;
  }

  const item = {
    product_id: modal.product_id,
    code: modal.code,
    name: modal.name,
    unit: modal.unit || "UN",
    quantity,
    negotiated_price: negotiatedPrice,
  };
  if (modal.index === null || Number.isNaN(modal.index)) {
    state.proposalItems.push(item);
  } else {
    state.proposalItems[modal.index] = item;
  }

  state.proposalActiveItemModal = null;
  state.proposalSelectedProductId = "";
  const productSearchField = document.querySelector("#productSearch");
  const productHidden = document.querySelector("#productSelect");
  if (productSearchField) productSearchField.value = "";
  if (productHidden) productHidden.value = "";
  render();
}

export function addProposalItem() {
  const productId = String(state.proposalSelectedProductId || document.querySelector("#productSelect")?.value || "");
  const product = state.proposalProducts.find((entry) => String(entry.id) === String(productId));
  if (!product) {
    setFlash("", "Escolha um produto antes de adicionar o item.");
    return;
  }
  const qtyInput = document.querySelector("#itemQty");
  const priceInput = document.querySelector("#itemPrice");
  const quantity = Number(qtyInput?.value || 0);
  const negotiatedPrice = priceInput ? parseCurrencyValue(priceInput.value) : Number(product.price || 0);
  if (!quantity || quantity <= 0) {
    setFlash("", "Informe uma quantidade valida.");
    return;
  }
  state.proposalItems.push({
    product_id: product.id,
    code: product.code,
    name: product.name,
    unit: product.unit || "UN",
    quantity,
    negotiated_price: negotiatedPrice,
  });
  if (qtyInput) qtyInput.value = "";
  if (priceInput) {
    delete priceInput.dataset.currencyRaw;
    priceInput.value = "0,00";
  }
  state.proposalSelectedProductId = "";
  const productSearchField = document.querySelector("#productSearch");
  const productHidden = document.querySelector("#productSelect");
  if (productSearchField) productSearchField.value = "";
  if (productHidden) productHidden.value = "";
  drawProposalItemsTable();
}

export function drawProposalItemsTable() {
  const target = document.querySelector("#proposalItemsTable");
  if (!target) return;

  const total = state.proposalItems.reduce((sum, item) => sum + item.quantity * item.negotiated_price, 0);
  if (!state.proposalItems.length) {
    target.innerHTML = `
      <div class="seller-items-empty">
        <strong>Nenhum produto adicionado</strong>
        <span>Os produtos escolhidos aparecem aqui antes de enviar.</span>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="seller-items-list">
      ${state.proposalItems
        .map(
          (item, index) => `
            <article class="seller-item-card">
              <div class="seller-item-main">
                <strong>${safe(item.name)}</strong>
                <span>${safe(item.code)} • ${safe(item.unit || "UN")}</span>
              </div>
              <div class="seller-item-meta">
                <span><b>Qtd</b>${safe(item.quantity)}</span>
                <span><b>Preco</b>${safe(money(item.negotiated_price))}</span>
                <span><b>Total</b>${safe(money(item.quantity * item.negotiated_price))}</span>
              </div>
              <div class="seller-item-actions">
                <button type="button" class="secondary" data-edit-item="${index}">Editar</button>
                <button type="button" class="secondary danger-soft" data-remove-item="${index}">Remover</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
    <div class="seller-order-total">
      <span>Total do pedido</span>
      <strong>${safe(money(total))}</strong>
    </div>
  `;

  document.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.addEventListener("click", () => {
      state.proposalItems.splice(Number(button.dataset.removeItem), 1);
      drawProposalItemsTable();
    });
  });
  document.querySelectorAll("[data-edit-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.proposalItems[Number(button.dataset.editItem)];
      if (item) openProposalItemModal(item.product_id, button.dataset.editItem);
    });
  });
}

export async function submitProposal(event) {
  event.preventDefault();
  if (!state.proposalItems.length) {
    setFlash("", "Inclua ao menos um item na proposta.");
    return;
  }
  try {
    const payload = {
      ...formData(event.target),
      items: state.proposalItems,
    };
    if (isBonusOrderType(payload.order_type)) {
      payload.payment_terms = "";
      payload.discount_percent = 0;
      payload.discount_on = "Sem descontos";
      payload.commission_percent = 0;
    } else {
      payload.discount_percent = parsePercentValue(payload.discount_percent);
      payload.commission_percent = parsePercentValue(payload.commission_percent);
    }
    const result = await api("/api/proposals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const company = state.common.companies.find((entry) => String(entry.id) === String(payload.company_id));
    const customer = state.common.customers.find((entry) => String(entry.id) === String(payload.customer_id));
    state.proposalLastSubmission = {
      id: result.id,
      orderNumber: result.order_number,
      company: company?.name || "",
      customer: customer ? `${customer.legal_name}${customer.cnpj ? ` - ${customer.cnpj}` : ""}` : "",
      status: result.status || "em_analise",
    };
    state.proposalItems = [];
    state.proposalProducts = [];
    state.proposalSelectedProductId = "";
    state.proposalPrefillCustomerId = "";
    resetProposalDraft();
    event.target.reset();
    resetPercentInputs(event.target);
    setFlash(`Proposta enviada para analise. Pedido #${result.order_number || result.id} já foi registrado.`);
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitAdminOrder(event) {
  event.preventDefault();
  if (!state.proposalItems.length) {
    setFlash("", "Inclua ao menos um produto no pedido.");
    return;
  }
  try {
    const payload = {
      ...formData(event.target),
      items: state.proposalItems,
    };
    if (isBonusOrderType(payload.order_type)) {
      payload.payment_terms = "";
      payload.discount_percent = 0;
      payload.discount_on = "Sem descontos";
      payload.commission_percent = 0;
    } else {
      payload.discount_percent = parsePercentValue(payload.discount_percent);
      payload.commission_percent = parsePercentValue(payload.commission_percent);
    }
    const result = await api("/api/proposals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.proposalItems = [];
    state.proposalProducts = [];
    state.proposalSelectedProductId = "";
    state.admin.activeOrderModal = null;
    resetPercentInputs(event.target);
    await loadRouteData("orders");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export function sellerStatusSummary(status) {
  const orders = (state.orders || []).filter((order) => order.status === status);
  return {
    count: orders.length,
    total: orders.reduce((sum, order) => sum + proposalTotal(order), 0),
  };
}

export function renderActivityMetric(title, count, subtitle, icon, tone = "blue") {
  return `
    <article class="seller-activity-metric metric-${safe(tone)}">
      <span class="seller-activity-icon">${icon}</span>
      <div>
        <span>${safe(title)}</span>
        <strong>${safe(count)}</strong>
        <small>${safe(subtitle)}</small>
      </div>
    </article>
  `;
}

export function renderSellerGoalCard(title, goal, type, icon, tone = "blue") {
  if (!goal?.enabled) return "";
  const proposed = type === "money" ? money(goal.goal) : type === "percent" ? `${goalNumber(goal.goal)}%` : String(Math.round(Number(goal.goal || 0)));
  const realized = type === "money" ? money(goal.realized) : type === "percent" ? `${goalNumber(goal.realized)}%` : String(Math.round(Number(goal.realized || 0)));
  const missing = type === "money" ? money(goal.missing) : type === "percent" ? `${goalNumber(goal.missing)}%` : String(Math.round(Number(goal.missing || 0)));
  const missingPercent = Math.max(0, 100 - Number(goal.percent || 0));
  return `
    <article class="seller-goal-card metric-${safe(tone)}">
      <span class="seller-activity-icon">${icon}</span>
      <div>
        <span>${safe(title)}</span>
        <strong>${safe(realized)}</strong>
        <small>Proposto: ${safe(proposed)}</small>
        <small>Falta ${safe(missing)} (${safe(goalNumber(missingPercent))}%) para atingir o resultado</small>
      </div>
    </article>
  `;
}

export function renderSellerGoalsSection() {
  const goals = state.sellerGoals;
  if (!goals?.has_goals) {
    return `
      <div class="seller-activity-section-label">Sua meta</div>
      <p class="empty-state compact">Você não tem metas cadastradas para este período.</p>
    `;
  }
  const cards = [
    renderSellerGoalCard("Faturamento", goals.sales, "money", uiIcons.wallet, "blue"),
    renderSellerGoalCard("Novos clientes", goals.new_customers, "count", sellerIcons.requestCustomer, "green"),
    renderSellerGoalCard("Positivação de clientes", goals.customer_positivation, "percent", uiIcons.chart, "teal"),
  ].filter(Boolean).join("");
  return `
    <div class="seller-activity-section-label">Sua meta</div>
    <div class="seller-goals-grid">
      ${cards || `<p class="empty-state compact">Você não tem metas cadastradas para este período.</p>`}
    </div>
  `;
}

export function parseOrderDate(value) {
  const date = parseAppDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function activityMonthLabel(month) {
  const index = Math.max(1, Math.min(12, Number(month || 1))) - 1;
  return [
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][index];
}

export function activityMonthOptions(selectedMonth) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `<option value="${safe(month)}" ${String(selectedMonth) === month ? "selected" : ""}>${safe(activityMonthLabel(month))}</option>`;
  }).join("");
}

export function activityYearOptions(orders, selectedYear) {
  const years = new Set([String(new Date().getFullYear())]);
  orders.forEach((order) => {
    const date = parseOrderDate(order.created_at);
    if (date) {
      years.add(String(date.getFullYear()));
    }
  });
  return Array.from(years)
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => `<option value="${safe(year)}" ${String(selectedYear) === year ? "selected" : ""}>${safe(year)}</option>`)
    .join("");
}

export function renderSellerActivities(view) {
  const customers = (state.common.customers || []).filter((customer) => customer.active !== false && customer.active !== 0);
  const orders = state.orders || [];
  const currentDate = new Date();
  const selectedMonth = String(state.sellerActivityMonth || String(currentDate.getMonth() + 1).padStart(2, "0")).padStart(2, "0");
  const selectedYear = String(state.sellerActivityYear || String(currentDate.getFullYear()));
  const filteredOrders = orders.filter((order) => {
    const parsed = parseOrderDate(order.created_at);
    if (!parsed) {
      return false;
    }
    return String(parsed.getFullYear()) === selectedYear && String(parsed.getMonth() + 1).padStart(2, "0") === selectedMonth;
  });
  const visibleOrders = filteredOrders;
  const visibleStatusSummary = (status) => {
    const items = visibleOrders.filter((order) => order.status === status);
    return {
      count: items.length,
      total: items.reduce((sum, order) => sum + proposalTotal(order), 0),
    };
  };
  const proposedTotal = visibleOrders.reduce((sum, order) => sum + proposalTotal(order), 0);
  const production = visibleStatusSummary("em_producao");
  const billed = visibleStatusSummary("faturado");
  const delivered = visibleStatusSummary("entregue");
  const visibleOrdersWithoutRejection = visibleOrders.filter((order) => order.status !== "recusado");
  const customerIdsWithOrder = new Set(visibleOrdersWithoutRejection.map((order) => String(order.customer_id)));
  const attendedCustomers = customers.filter((customer) => customerIdsWithOrder.has(String(customer.id)));
  const unattendedCustomers = customers.filter((customer) => !customerIdsWithOrder.has(String(customer.id)));
  const portfolioCount = customers.length;
  const attendedPercent = portfolioCount ? Math.round((attendedCustomers.length / portfolioCount) * 100) : 0;
  const unattendedPercent = Math.max(0, 100 - attendedPercent);
  const deliveredByCustomer = orders
    .filter((order) => order.status === "entregue")
    .reduce((acc, order) => {
      const key = String(order.customer_id);
      const current = acc[key];
      const orderDate = order.delivery_forecast || order.updated_at || order.created_at;
      if (!current || new Date(orderDate) > new Date(current.delivery_forecast || current.updated_at || current.created_at)) {
        acc[key] = order;
      }
      return acc;
    }, {});
  const urgentCustomers = unattendedCustomers
    .map((customer) => ({
      customer,
      lastDelivery: deliveredByCustomer[String(customer.id)]?.delivery_forecast ||
        deliveredByCustomer[String(customer.id)]?.updated_at ||
        deliveredByCustomer[String(customer.id)]?.created_at ||
        "",
    }))
    .sort((a, b) => String(a.customer.legal_name || "").localeCompare(String(b.customer.legal_name || "")))
    .slice(0, 12);

  view.innerHTML = `
    <section class="section-band span-12 seller-activities-page">
      <header class="section-head">
        <div>
          <p class="eyebrow">${routeEyebrow()}</p>
          <h2>${routeTitle()}</h2>
        </div>
      </header>
      <div class="section-body seller-activities-body">
        <div class="seller-activity-hero">
          <div>
            <span class="seller-activity-hero-icon">${sellerIcons.activities}</span>
            <div>
              <strong>${safe(state.user?.name || "Representante comercial")}</strong>
              <p>Abaixo uma análise das suas atividades. Avalie sua performance.</p>
            </div>
          </div>
        </div>
        <div class="seller-activity-filters">
          <label>
            Mês
            <select data-activity-month>
              ${activityMonthOptions(selectedMonth)}
            </select>
          </label>
          <label>
            Ano
            <select data-activity-year>
              ${activityYearOptions(orders, selectedYear)}
            </select>
          </label>
          <p class="seller-activity-period-hint">Consultando desempenho de ${safe(activityMonthLabel(selectedMonth))}/${safe(selectedYear)}.</p>
        </div>

        ${renderSellerGoalsSection()}

        <div class="seller-activity-section-label">Seus pedidos</div>
        <div class="seller-activity-grid">
          ${renderActivityMetric("Propostas enviadas", visibleOrders.length, money(proposedTotal), timelineIcon("em_analise").svg, "blue")}
          ${renderActivityMetric("Em produção", production.count, money(production.total), timelineIcon("em_producao").svg, "teal")}
          ${renderActivityMetric("Faturados", billed.count, money(billed.total), timelineIcon("faturado").svg, "gold")}
          ${renderActivityMetric("Entregues", delivered.count, money(delivered.total), timelineIcon("entregue").svg, "green")}
        </div>

        <div class="seller-activity-section-label">Sua carteira de clientes</div>
        <div class="seller-activity-grid">
          ${renderActivityMetric("Clientes na carteira", portfolioCount, `${attendedCustomers.length} atendidos`, sellerIcons.customers, "blue")}
          ${renderActivityMetric("Clientes atendidos", attendedCustomers.length, `${attendedPercent}% de positivacao`, uiIcons.chart, "green")}
          ${renderActivityMetric("Nao atendidos", unattendedCustomers.length, `${unattendedPercent}% da carteira`, uiIcons.alert, "red")}
        </div>

        <section class="seller-portfolio-panel">
          <div class="seller-portfolio-head">
            <div>
              <span>Positivação da carteira</span>
              <strong>${safe(attendedPercent)}%</strong>
            </div>
            <small>${safe(attendedCustomers.length)} atendidos de ${safe(portfolioCount)} clientes</small>
          </div>
          <div class="seller-progress" aria-label="Positivacao da carteira">
            <i style="width:${safe(attendedPercent)}%"></i>
          </div>
          <div class="seller-portfolio-split">
            <span><b>${safe(attendedCustomers.length)}</b> clientes atendidos</span>
            <span><b>${safe(unattendedCustomers.length)}</b> clientes sem pedido</span>
          </div>
        </section>

        <section class="seller-urgent-panel">
          <div class="seller-urgent-callout">
            <span>Alerta de atenção</span>
            <strong>${safe(state.user?.name || "Representante comercial")}, fique em alerta.</strong>
            <p>Os clientes listados abaixo ainda não fizeram pedido e precisam de atendimento urgente.</p>
          </div>
          <div class="seller-panel-title">
            <div>
              <span>Carteira</span>
              <strong>Clientes que precisam de atenção urgente</strong>
            </div>
            <button type="button" class="secondary icon-text-btn" data-route="customers">${sellerIcons.customers}<span>Ver clientes</span></button>
          </div>
          ${
            urgentCustomers.length
              ? `<div class="seller-urgent-list">
                  ${urgentCustomers
                    .map(({ customer, lastDelivery }) => `
                      <article class="seller-urgent-card">
                        <div>
                          <strong>${safe(customer.legal_name)}</strong>
                          <span>${safe(customer.cnpj || customer.trade_name || "")}</span>
                        </div>
                        <small>Última entrega: ${safe(lastDelivery ? date(lastDelivery) : "Sem entrega registrada")}</small>
                      </article>
                    `)
                    .join("")}
                </div>`
              : `<p class="empty-state compact">Nenhum cliente urgente no momento.</p>`
          }
        </section>
      </div>
    </section>
  `;
  wireSellerActivities(view);
}

export function wireSellerActivities(view) {
  const monthField = view.querySelector("[data-activity-month]");
  const yearField = view.querySelector("[data-activity-year]");
  if (monthField) {
    monthField.addEventListener("change", async () => {
      state.sellerActivityMonth = String(monthField.value || "01").padStart(2, "0");
      await loadSellerGoals().catch(() => {});
      render();
    });
  }
  if (yearField) {
    yearField.addEventListener("change", async () => {
      state.sellerActivityYear = String(yearField.value || new Date().getFullYear());
      await loadSellerGoals().catch(() => {});
      render();
    });
  }
}

export function renderOrders(view) {
  const orders = isAdmin() ? filteredAdminOrders() : state.orders;
  const statusCounts = orderStatusCounts(orders);
  const ordersPagination = paginateItems(isAdmin() ? "adminOrders" : "sellerOrders", orders);
  view.innerHTML = `
    <section class="section-band span-12">
      <header class="section-head">
        <div>
          <p class="eyebrow">${isAdmin() ? "Gestao de pedidos" : "Pedidos"}</p>
          <h2>${isAdmin() ? "Pedidos com filtros avancados" : "Pedidos e status"}</h2>
        </div>
        ${isAdmin() ? `<div class="section-action"><button type="button" class="icon-text-btn" data-open-order-modal>${uiIcons.plus}<span>Novo pedido</span></button></div>` : ""}
      </header>
      <div class="section-body">
        ${
          isAdmin()
            ? `
              ${renderAdminOrderFilters(orders)}
              <div class="order-status-strip">
                <span class="mini-stat"><strong>${safe(orders.length)}</strong><small>filtrados</small></span>
                ${Object.entries(statusCounts)
                  .map(
                    ([status, count]) => {
                      const meta = statusInfo(status);
                      return `
                      <span class="mini-stat status-mini-stat" style="--status-color:${safe(meta.color)};--status-soft:${safe(softStatusColor(meta.color))};">
                        <strong>${safe(count)}</strong>
                        <small>${safe(meta.name)}</small>
                      </span>
                    `;
                    }
                  )
                  .join("")}
              </div>
            `
            : ""
        }
        <div class="${isAdmin() ? "orders-card-shell" : "table-shell"}">
          ${renderProposalsTable(ordersPagination.items, isAdmin())}
        </div>
        ${renderPagination(isAdmin() ? "adminOrders" : "sellerOrders", ordersPagination)}
      </div>
    </section>
  `;
  wireOrders(view);
}

export function proposalTotal(proposal) {
  return (proposal.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.negotiated_price || 0), 0);
}

export function proposalNumber(proposal) {
  return proposal?.order_number || proposal?.id || "";
}

export function getProposalById(proposalId) {
  return (state.orders || []).find((proposal) => String(proposal.id) === String(proposalId)) ||
    (state.admin.proposals || []).find((proposal) => String(proposal.id) === String(proposalId)) ||
    null;
}

export function openTimelineModal(proposalId) {
  state.activeTimelineProposalId = String(proposalId);
  render();
}

export function closeTimelineModal() {
  state.activeTimelineProposalId = null;
  render();
}

export function timelineIcon(status) {
  if (status === "em_analise") return { cls: "search", svg: uiIcons.searchFile };
  if (status === "pedido_aprovado") return { cls: "check", svg: uiIcons.fileCheck };
  if (status === "recusado") return { cls: "stop", svg: uiIcons.fileX };
  if (status === "em_producao") return { cls: "factory", svg: uiIcons.factory };
  if (status === "faturado") return { cls: "doc", svg: uiIcons.file };
  if (status === "entregue") return { cls: "ok", svg: uiIcons.truck };
  return { cls: "box", svg: uiIcons.box };
}

export function timelineActorLabel(status, createdByName = "") {
  const labels = {
    em_analise: String(createdByName || "Representante comercial"),
    pedido_aprovado: "FPP",
    recusado: "FPP",
    em_producao: "PCP",
    faturado: "FPP",
    entregue: "Logistica & Transporte",
  };
  return labels[status] || String(createdByName || "HiperSales Web");
}

export function renderTimelineList(proposal) {
  const events = proposal?.timeline || [];
  if (!events.length) {
    return `<p class="empty-state compact">Nenhuma movimentacao registrada.</p>`;
  }
  return `
    <ol class="tracking-timeline">
      ${events
        .slice()
        .reverse()
        .map((event) => {
          const parsed = event.created_at ? new Date(event.created_at) : null;
          const day = parsed && !Number.isNaN(parsed.getTime())
            ? parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
            : "";
          const hour = parsed && !Number.isNaN(parsed.getTime())
            ? parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : "";
          const meta = statusInfo(event.status);
          const label = meta.name || event.title || event.status;
          const icon = timelineIcon(event.status);
          const actor = timelineActorLabel(event.status, event.created_by_name);
          const deliveryForecast = event.status === "pedido_aprovado" && proposal.delivery_forecast
            ? `<p class="tracking-delivery">Entrega prevista: <strong>${safe(date(proposal.delivery_forecast))}</strong></p>`
            : "";
          return `
            <li class="tracking-event">
              <div class="tracking-date">
                <strong>${safe(day)}</strong>
                <span>${safe(hour)}</span>
              </div>
              <div class="tracking-marker ${safe(icon.cls)}" style="--status-color:${safe(meta.color)};--status-soft:${safe(softStatusColor(meta.color))};">${icon.svg}</div>
              <div class="tracking-copy">
                <h3>${safe(label)}</h3>
                <p>${safe(event.notes || defaultTimelineText(event.status))}</p>
                ${deliveryForecast}
                <span>${safe(actor)}</span>
              </div>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

export function defaultTimelineText(status) {
  const texts = {
    em_analise: "Proposta enviada e aguardando analise.",
    pedido_aprovado: "A proposta foi aprovada e virou pedido.",
    recusado: "A proposta foi recusada.",
    em_producao: "Pedido em producao.",
    faturado: "Pedido faturado e pronto para rota.",
    entregue: "Pedido entregue.",
  };
  return texts[status] || "Movimentacao registrada.";
}

export function renderTimelineModal() {
  const proposal = state.activeTimelineProposalId ? getProposalById(state.activeTimelineProposalId) : null;
  if (!proposal) return "";
  return renderSettingsModalShell({
    modalKey: "timelineModal",
    eyebrow: "Linha do tempo",
    title: `Pedido #${proposalNumber(proposal)}`,
    wide: true,
    panelClass: "request-modal-md",
    body: `
      <div class="timeline-modal-head">
        <strong>${safe(proposal.customer_name)}</strong>
        <span>${safe(proposal.customer_cnpj || "")}</span>
      </div>
      ${renderTimelineList(proposal)}
      <div class="modal-footer split">
        <button type="button" class="secondary" data-close-timeline-modal>${uiIcons.close}<span>Fechar</span></button>
        ${!isAdmin() ? `<button type="button" class="secondary" data-proposal-share="${safe(proposal.id)}">${uiIcons.share}<span>Compartilhar</span></button>` : ""}
        <button type="button" data-proposal-pdf="${safe(proposal.id)}">${uiIcons.pdf}<span>Abrir PDF</span></button>
      </div>
    `,
  });
}

export function renderOccurrenceTimelineList(occurrence) {
  const events = occurrence?.timeline || [];
  if (!events.length) {
    return `<p class="empty-state compact">Nenhuma movimentacao registrada.</p>`;
  }
  return `
    <ol class="tracking-timeline">
      ${events
        .slice()
        .reverse()
        .map((event) => {
          const parsed = event.created_at ? parseAppDate(event.created_at) : null;
          const day = parsed && !Number.isNaN(parsed.getTime())
            ? parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
            : "";
          const hour = parsed && !Number.isNaN(parsed.getTime())
            ? parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : "";
          const status = normalizeOccurrenceStatus(event.status);
          const tone = occurrenceStatusTone(status);
          const icon = status === "solucionada" ? uiIcons.check : status === "recusada" ? uiIcons.fileX : status === "em_analise" ? uiIcons.searchFile : uiIcons.alert;
          return `
            <li class="tracking-event">
              <div class="tracking-date">
                <strong>${safe(day)}</strong>
                <span>${safe(hour)}</span>
              </div>
              <div class="tracking-marker ${safe(tone)}">${icon}</div>
              <div class="tracking-copy">
                <h3>${safe(event.title || occurrenceStatusLabel(status))}</h3>
                <p>${safe(event.notes || "Movimentacao registrada.")}</p>
                <span>${safe(event.created_by_name || "Retaguarda")}</span>
              </div>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

export function renderOccurrenceTimelineModal() {
  const occurrence = state.activeOccurrenceTimelineId ? getOccurrenceById(state.activeOccurrenceTimelineId) : null;
  if (!occurrence) return "";
  return renderSettingsModalShell({
    modalKey: "occurrenceTimelineModal",
    eyebrow: "Linha do tempo",
    title: `R.O. #${occurrence.id}`,
    wide: true,
    panelClass: "request-modal-md",
    body: `
      <div class="timeline-modal-head">
        <strong>${safe(occurrence.customer_name || "Cliente")}</strong>
        <span>${safe(occurrence.customer_cnpj || "")}</span>
      </div>
      ${renderOccurrenceTimelineList(occurrence)}
      <div class="modal-footer split">
        <button type="button" class="secondary" data-close-occurrence-timeline-modal>${uiIcons.close}<span>Fechar</span></button>
        <button type="button" data-occurrence-pdf="${safe(occurrence.id)}">${uiIcons.pdf}<span>Abrir PDF</span></button>
      </div>
    `,
  });
}

export function renderProposalViewModal() {
  const proposal = state.admin.activeProposalViewModal ? getProposalById(state.admin.activeProposalViewModal) : null;
  if (!proposal) return "";
  const canEdit = isAdmin();
  const orderType = proposal.order_type || "";
  const freightType = proposal.freight_type || "";
  const deliveryType = proposal.delivery_type || "";
  const invoiceType = proposal.invoice_type || "Com nota cheia";
  const taxOperatorInvoice = ["1", "true", "sim", "on"].includes(String(proposal.tax_operator_invoice ?? "0").trim().toLowerCase()) ? "1" : "0";
  const isBonus = isBonusOrderType(orderType);
  const paymentTerms = isBonus ? "" : (proposal.payment_terms || "");
  const discountOn = isBonus ? "Sem descontos" : (proposal.discount_on || "");
  const deliveryForecast = proposal.delivery_forecast || "";
  const scheduledDeliveryDate = proposal.scheduled_delivery_date || "";
  const total = proposalTotal(proposal);
  const editableItems = canEdit ? state.admin.proposalEditItems : (proposal.items || []);
  const editableTotal = editableItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.negotiated_price || 0),
    0
  );
  const availableProducts = (state.admin.products || []).filter(
    (product) => product.active && String(product.company_id) === String(proposal.company_id)
  );
  return renderSettingsModalShell({
    modalKey: "proposalViewModal",
    eyebrow: "Pedido",
    title: canEdit ? `Visualizar e editar pedido #${proposalNumber(proposal)}` : `Visualizar pedido #${proposalNumber(proposal)}`,
    wide: true,
    panelClass: "request-modal-md proposal-view-modal",
    body: `
      <form class="proposal-view-form" id="proposalViewForm" data-proposal-id="${safe(proposal.id)}" data-original-status="${safe(proposal.status)}">
        <div class="proposal-view-head">
          <div>
            <strong>${safe(proposal.customer_name)}</strong>
            <span>${safe(proposal.customer_trade_name || proposal.customer_cnpj || "")}</span>
          </div>
          <div class="proposal-view-actions">
            <button type="button" class="secondary icon-text-btn" data-proposal-pdf="${safe(proposal.id)}">${uiIcons.pdf}<span>Abrir PDF</span></button>
            <button type="button" class="secondary icon-text-btn" data-proposal-timeline="${safe(proposal.id)}">${uiIcons.timeline}<span>Linha do tempo</span></button>
            ${!canEdit ? `<button type="button" class="secondary icon-text-btn" data-proposal-share="${safe(proposal.id)}">${uiIcons.share}<span>Compartilhar</span></button>` : ""}
          </div>
        </div>

        <div class="proposal-summary-grid proposal-view-summary">
          <article class="proposal-summary-card">
            <span>Empresa</span>
            <strong>${safe(proposal.company_name)}</strong>
            <small>${safe(proposal.seller_name)}</small>
          </article>
          <article class="proposal-summary-card">
            <span>Status atual</span>
            <strong>${safe(statusInfo(proposal.status).name)}</strong>
            <small>${safe(date(proposal.created_at))}</small>
          </article>
        </div>

        ${
          canEdit
            ? `
          <section class="seller-order-card proposal-view-section">
            <div class="seller-order-card-head">
              <span class="step-badge">0</span>
              <h3>Ajustes administrativos</h3>
            </div>
            <div class="seller-order-grid readonly-grid">
              <label>
                Status
                <select data-proposal-id="${safe(proposal.id)}" data-proposal-status>
                  ${statusOptions(proposal.status)}
                </select>
              </label>
              <label>
                Entrega prevista
                <input type="date" value="${safe(deliveryForecast || "")}" data-delivery-forecast="${safe(proposal.id)}" />
              </label>
              <label>
                Pedido na indústria
                <input type="text" value="${safe(proposal.industry_order_number || "")}" data-industry-order-number="${safe(proposal.id)}" placeholder="Nº pedido indústria" autocomplete="off" />
              </label>
              <label>
                Nota fiscal
                <input type="text" value="${safe(proposal.invoice_number || "")}" data-invoice-number="${safe(proposal.id)}" placeholder="Nº nota fiscal" autocomplete="off" />
              </label>
              <label>
                Tipo de nota
                <select data-invoice-type="${safe(proposal.id)}">
                  ${invoiceTypeOptions.map((option) => `<option value="${safe(option)}" ${invoiceType === option ? "selected" : ""}>${safe(option)}</option>`).join("")}
                </select>
              </label>
            </div>
          </section>
        `
            : ""
        }

        <section class="seller-order-card proposal-view-section">
          <div class="seller-order-card-head">
            <span class="step-badge">1</span>
            <h3>Cabecalho</h3>
          </div>
          <div class="seller-order-grid readonly-grid">
            <label>
              Data e hora de emissao
              <input value="${safe(datetime(proposal.created_at))}" readonly />
            </label>
            <label>
              Empresa (Fornecedor)
              <input value="${safe(proposal.company_name || "")}" readonly />
            </label>
            <label class="span-2">
              Cliente
              <input value="${safe(`${proposal.customer_name || ""}${proposal.customer_cnpj ? ` - ${proposal.customer_cnpj}` : ""}`)}" readonly />
            </label>
            <label class="span-2">
              Nota Fiscal via Operador Fiscal?
              ${
                canEdit
                  ? `<select data-proposal-tax-operator-invoice="${safe(proposal.id)}">
                      ${taxOperatorOptions.map((option) => `<option value="${safe(option.value)}" ${taxOperatorInvoice === option.value ? "selected" : ""}>${safe(option.label)}</option>`).join("")}
                    </select>`
                  : `<input value="${safe(taxOperatorLabel(proposal.tax_operator_invoice))}" readonly />`
              }
            </label>
            <div class="span-2 tax-operator-alert compact">
              <strong>Atenção ao faturamento</strong>
              <span>Se for faturar a Nota Fiscal através de um Operador Fiscal, informe no campo de observações qual será o operador desta venda.</span>
            </div>
          </div>
        </section>

        <section class="seller-order-card proposal-view-section">
          <div class="seller-order-card-head">
            <span class="step-badge">2</span>
            <h3>Condicoes da proposta</h3>
          </div>
          <div class="seller-order-grid readonly-grid">
            <label>
              Natureza da Operacao
              <select data-proposal-order-type="${safe(proposal.id)}">
                <option value="Venda de Mercadoria" ${orderType === "Venda de Mercadoria" ? "selected" : ""}>Venda de Mercadoria</option>
                <option value="Bonificacao" ${orderType === "Bonificacao" ? "selected" : ""}>Bonificação</option>
              </select>
            </label>
            <label>
              Frete
              <select data-proposal-freight-type="${safe(proposal.id)}">
                <option value="CIF - Pago pela Industria" ${freightType === "CIF - Pago pela Industria" ? "selected" : ""}>CIF - Pago pela Industria</option>
                <option value="FOB - Pago pelo Cliente" ${freightType === "FOB - Pago pelo Cliente" ? "selected" : ""}>FOB - Pago pelo Cliente</option>
              </select>
            </label>
            <label>
              Tipo de Entrega
              <select data-proposal-delivery-type="${safe(proposal.id)}">
                <option value="Entrega Imediata" ${deliveryType === "Entrega Imediata" ? "selected" : ""}>Entrega Imediata</option>
                <option value="Entrega Programada" ${deliveryType === "Entrega Programada" ? "selected" : ""}>Entrega Programada</option>
              </select>
            </label>
            <label>
              Data Programada Entrega
              <input type="date" value="${safe(scheduledDeliveryDate || "")}" data-proposal-scheduled-delivery-date="${safe(proposal.id)}" ${deliveryType !== "Entrega Programada" ? "disabled" : ""} />
            </label>
            <label>
              Ordem de Compras Cliente
              <input type="text" value="${safe(proposal.purchase_order || "")}" data-proposal-purchase-order="${safe(proposal.id)}" autocomplete="off" />
            </label>
            <label>
              Forma de Pagamento
              <select data-proposal-payment-terms="${safe(proposal.id)}" ${isBonus ? "disabled" : ""}>
                <option value="" ${isBonus ? "selected" : ""}>Sem pagamento</option>
                ${paymentTermsOptions.map((option) => `<option value="${safe(option)}" ${paymentTerms === option ? "selected" : ""}>${safe(option)}</option>`).join("")}
              </select>
            </label>
            <label>
              %Desconto
              <input type="text" inputmode="decimal" autocomplete="off" value="${safe(formatPercentValue(isBonus ? 0 : (proposal.discount_percent || 0)))}" data-percent-input data-proposal-discount-percent="${safe(proposal.id)}" ${isBonus ? "disabled" : ""} />
              ${isBonus ? `<span class="field-help">Nao tem desconto em bonificacao.</span>` : ""}
            </label>
            <label>
              Desconto em
              <select data-proposal-discount-on="${safe(proposal.id)}" ${isBonus ? "disabled" : ""}>
                <option value="Sem descontos" ${discountOn === "Sem descontos" ? "selected" : ""}>Sem descontos</option>
                <option value="Boleto Bancario" ${discountOn === "Boleto Bancario" ? "selected" : ""}>Boleto Bancario</option>
                <option value="Nota Fiscal" ${discountOn === "Nota Fiscal" ? "selected" : ""}>Nota Fiscal</option>
              </select>
            </label>
            <label>
              %Comissao
              <input type="text" inputmode="decimal" autocomplete="off" value="${safe(formatPercentValue(isBonus ? 0 : (proposal.commission_percent || 0)))}" data-percent-input data-proposal-commission-percent="${safe(proposal.id)}" ${isBonus ? "disabled" : ""} />
              ${isBonus ? `<span class="field-help">Sem comissao em bonificacao.</span>` : ""}
            </label>
            <label class="span-2">
              Observacoes
              <textarea data-proposal-notes="${safe(proposal.id)}">${safe(proposal.notes || "")}</textarea>
            </label>
          </div>
        </section>

        <section class="seller-order-card proposal-view-section">
          <div class="seller-order-card-head">
            <span class="step-badge">3</span>
            <h3>Itens</h3>
          </div>
          <div class="proposal-items-shell proposal-view-items">
            ${
              editableItems.length
                ? `<div class="seller-items-list">
                    ${editableItems
                      .map(
                        (item, index) => `
                          <article class="seller-item-card ${canEdit ? "admin-edit-item-card" : "readonly-item-card"}">
                            <div class="seller-item-main">
                              <strong>${safe(item.name)}</strong>
                              <span>${safe(item.code)} • ${safe(item.unit || "UN")}</span>
                            </div>
                            ${canEdit ? `
                              <div class="seller-item-meta admin-item-fields">
                                <label class="admin-item-product-field">
                                  <b>Produto</b>
                                  <select data-admin-item-product="${index}">
                                    ${availableProducts.map((product) => `<option value="${safe(product.id)}" ${String(product.id) === String(item.product_id || item.id) ? "selected" : ""}>${safe(product.code)} - ${safe(product.name)}</option>`).join("")}
                                  </select>
                                </label>
                                <label><b>Quantidade</b><input type="number" min="0.01" step="0.01" inputmode="decimal" value="${safe(item.quantity)}" data-admin-item-quantity="${index}" /></label>
                                <label><b>Preco negociado</b><input type="text" inputmode="decimal" autocomplete="off" value="${safe(formatCurrencyValue(item.negotiated_price || 0))}" data-admin-item-price="${index}" /></label>
                                <span><b>Total</b>${safe(money(Number(item.quantity || 0) * Number(item.negotiated_price || 0)))}</span>
                              </div>
                              <div class="seller-item-actions">
                                <button type="button" class="secondary" data-admin-edit-proposal-item="${index}">${uiIcons.edit}<span>Editar item</span></button>
                                <button type="button" class="secondary danger-soft" data-admin-remove-proposal-item="${index}">${uiIcons.trash}<span>Excluir item</span></button>
                              </div>
                            ` : `
                              <div class="seller-item-meta">
                                <span><b>Qtd</b>${safe(item.quantity)}</span>
                                <span><b>Preco</b>${safe(money(item.negotiated_price))}</span>
                                <span><b>Total</b>${safe(money(Number(item.quantity || 0) * Number(item.negotiated_price || 0)))}</span>
                              </div>
                            `}
                          </article>
                        `
                      )
                      .join("")}
                  </div>
                  <div class="seller-order-total">
                    <span>Total do pedido</span>
                    <strong>${safe(money(canEdit ? editableTotal : total))}</strong>
                  </div>`
                : `<p class="empty-state compact">Nenhum item encontrado.</p>`
            }
          </div>
          ${canEdit ? `
            <div class="admin-add-proposal-item">
              <label>
                Incluir produto
                <select data-admin-add-product>
                  <option value="">Selecione um produto da empresa</option>
                  ${availableProducts.map((product) => `<option value="${safe(product.id)}">${safe(product.code)} - ${safe(product.name)}</option>`).join("")}
                </select>
              </label>
              <button type="button" class="secondary icon-text-btn" data-admin-add-proposal-item>${uiIcons.plus}<span>Adicionar produto</span></button>
            </div>
          ` : ""}
        </section>

        <section class="seller-order-card proposal-view-section">
          <div class="seller-order-card-head">
            <span class="step-badge">4</span>
            <h3>Linha do tempo</h3>
          </div>
          ${renderTimelineList(proposal)}
        </section>

        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-proposal-view-modal>${uiIcons.close}<span>Fechar</span></button>
          <div class="proposal-view-footer-actions">
            <div class="proposal-view-footer-actions-secondary">
              <button type="button" class="secondary" data-proposal-timeline="${safe(proposal.id)}">${uiIcons.timeline}<span>Linha do tempo</span></button>
              <button type="button" class="secondary" data-proposal-pdf="${safe(proposal.id)}">${uiIcons.pdf}<span>Abrir PDF</span></button>
              ${!canEdit ? `<button type="button" class="secondary" data-proposal-share="${safe(proposal.id)}">${uiIcons.share}<span>Compartilhar</span></button>` : ""}
            </div>
            ${canEdit ? `<div class="proposal-view-footer-actions-primary"><button type="submit" class="order-consult-btn save">${uiIcons.edit}<span>Salvar alterações</span></button></div>` : ""}
          </div>
        </div>
      </form>
    `,
  });
}

export function openProposalPdf(proposalId) {
  window.open(`/api/proposals/${encodeURIComponent(proposalId)}/pdf`, "_blank", "noopener");
}

export async function shareProposalPdf(proposalId) {
  const proposal = getProposalById(proposalId);
  const url = new URL(`/api/proposals/${encodeURIComponent(proposalId)}/pdf`, window.location.origin).toString();
  const title = `Pedido #${proposalNumber(proposal) || proposalId}`;
  const filename = `Pedido ${proposalNumber(proposal) || proposalId} - HiperSales Web.pdf`;
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Nao foi possivel baixar o PDF.");
    }
    const blob = await response.blob();
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title,
        text: `Documento do ${title} - HiperSales Web`,
        files: [file],
      });
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    setFlash("PDF baixado para compartilhar.");
  } catch (error) {
    setFlash("", "Nao foi possivel compartilhar o PDF agora.");
  }
}

export function openCustomerPerformancePdf(customerId) {
  window.open(`/api/admin/customers/${encodeURIComponent(customerId)}/performance/pdf`, "_blank", "noopener");
}

export function toDateInputValue(value) {
  if (!value) return "";
  const parsed = parseAppDate(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function orderStatusCounts(orders) {
  return orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
}

export function filteredAdminOrders() {
  const search = String(state.admin.orderSearch || "").trim().toLowerCase();
  const status = String(state.admin.orderStatusFilter || "all");
  const sellerId = String(state.admin.orderSellerFilter || "");
  const companyId = String(state.admin.orderCompanyFilter || "");
  const customerId = String(state.admin.orderCustomerFilter || "");
  const dateFrom = String(state.admin.orderDateFrom || "");
  const dateTo = String(state.admin.orderDateTo || "");
  const minTotal = Number(String(state.admin.orderMinTotal || "").replace(",", "."));
  const maxTotal = Number(String(state.admin.orderMaxTotal || "").replace(",", "."));

  return state.orders.filter((order) => {
    const total = proposalTotal(order);
    const createdDate = toDateInputValue(order.created_at);
    if (status !== "all" && order.status !== status) return false;
    if (sellerId && String(order.seller_id) !== sellerId) return false;
    if (companyId && String(order.company_id) !== companyId) return false;
    if (customerId && String(order.customer_id) !== customerId) return false;
    if (dateFrom && createdDate && createdDate < dateFrom) return false;
    if (dateTo && createdDate && createdDate > dateTo) return false;
    if (!Number.isNaN(minTotal) && String(state.admin.orderMinTotal || "").trim() && total < minTotal) return false;
    if (!Number.isNaN(maxTotal) && String(state.admin.orderMaxTotal || "").trim() && total > maxTotal) return false;
    if (search) {
      const itemText = (order.items || []).map((item) => `${item.code} ${item.name}`).join(" ");
      const haystack = [
        order.id,
        order.company_name,
        order.customer_name,
        order.seller_name,
        order.purchase_order,
        order.notes,
        order.payment_terms,
        itemText,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function renderAdminOrderFilters(orders) {
  const total = orders.reduce((sum, order) => sum + proposalTotal(order), 0);
  return `
    <div class="order-filter-panel">
      <div class="order-filter-head">
        <div>
          <strong>Filtros de trabalho</strong>
          <span>Busque por cliente, representante comercial, empresa, periodo, status, valor ou produto.</span>
        </div>
        <button type="button" class="secondary" data-reset-order-filters>Limpar filtros</button>
      </div>
      <div class="order-filter-grid">
        <label class="span-2">
          Busca geral
          ${searchActionField(`<input type="search" data-order-filter="orderSearch" value="${safe(state.admin.orderSearch)}" placeholder="Pedido, cliente, produto, OC, representante comercial..." />`)}
        </label>
        <label>
          Status
          <select data-order-filter="orderStatusFilter">
            <option value="all">Todos</option>
            ${Object.entries(statusMeta)
              .map(([value]) => {
                const meta = statusInfo(value);
                return `<option value="${safe(value)}" ${state.admin.orderStatusFilter === value ? "selected" : ""}>${safe(meta.name)}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>
          Representante comercial
          <select data-order-filter="orderSellerFilter">
            <option value="">Todos</option>
            ${sellerOptions(state.admin.orderSellerFilter)}
          </select>
        </label>
        <label>
          Empresa
          <select data-order-filter="orderCompanyFilter">
            <option value="">Todas</option>
            ${companyOptions(state.admin.orderCompanyFilter)}
          </select>
        </label>
        <label>
          Cliente
          <select data-order-filter="orderCustomerFilter">
            <option value="">Todos</option>
            ${customerOptions(state.admin.orderCustomerFilter)}
          </select>
        </label>
        <label>
          De
          <input type="date" data-order-filter="orderDateFrom" value="${safe(state.admin.orderDateFrom)}" />
        </label>
        <label>
          Ate
          <input type="date" data-order-filter="orderDateTo" value="${safe(state.admin.orderDateTo)}" />
        </label>
        <label>
          Valor minimo
          <input type="number" min="0" step="0.01" data-order-filter="orderMinTotal" value="${safe(state.admin.orderMinTotal)}" placeholder="0,00" />
        </label>
        <label>
          Valor maximo
          <input type="number" min="0" step="0.01" data-order-filter="orderMaxTotal" value="${safe(state.admin.orderMaxTotal)}" placeholder="0,00" />
        </label>
      </div>
      <div class="order-filter-summary">
        <span>${safe(orders.length)} pedido(s) encontrados</span>
        <strong>${safe(money(total))}</strong>
      </div>
    </div>
  `;
}

export function resetAdminOrderFilters() {
  state.admin.orderSearch = "";
  state.admin.orderStatusFilter = "all";
  state.admin.orderSellerFilter = "";
  state.admin.orderCompanyFilter = "";
  state.admin.orderCustomerFilter = "";
  state.admin.orderDateFrom = "";
  state.admin.orderDateTo = "";
  state.admin.orderMinTotal = "";
  state.admin.orderMaxTotal = "";
}

export function wireOrders(view) {
  wirePagination(view);
  if (isAdmin()) {
    view.querySelectorAll("[data-order-filter]").forEach((field) => {
      if (field.type === "search") return;
      field.addEventListener("change", () => {
        state.admin[field.dataset.orderFilter] = field.value;
        resetPage("adminOrders");
        render();
      });
    });
    wireSearchSubmit(view, "[data-order-filter='orderSearch']", (value) => {
      state.admin.orderSearch = value;
      resetPage("adminOrders");
      render();
    });
    view.querySelector("[data-reset-order-filters]")?.addEventListener("click", () => {
      resetAdminOrderFilters();
      resetPage("adminOrders");
      render();
    });
    view.querySelector("[data-open-order-modal]")?.addEventListener("click", openOrderModal);
  }

  wireProposalOrderControls(view);
}

export function wireProposalOrderControls(root) {
  root.querySelectorAll("[data-proposal-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteProposal(button.dataset.proposalDelete));
  });
  root.querySelectorAll("[data-proposal-view]").forEach((button) => {
    button.addEventListener("click", () => openProposalViewModal(button.dataset.proposalView));
  });
  root.querySelectorAll("[data-proposal-timeline]").forEach((button) => {
    button.addEventListener("click", () => openTimelineModal(button.dataset.proposalTimeline));
  });
  root.querySelectorAll("[data-proposal-pdf]").forEach((button) => {
    button.addEventListener("click", () => openProposalPdf(button.dataset.proposalPdf));
  });
  root.querySelectorAll("[data-proposal-share]").forEach((button) => {
    button.addEventListener("click", () => shareProposalPdf(button.dataset.proposalShare));
  });
  root.querySelectorAll("[data-proposal-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposalId = button.dataset.proposalSave;
      try {
        const saveRoot = button.closest(".proposal-view-form, .order-card, tr") || root;
        const result = await updateProposalStatus(proposalId, orderAdminPayload(saveRoot, proposalId));
        await loadRouteData("admin");
        if (state.admin.activeProposalViewModal === String(proposalId)) {
          state.admin.activeProposalViewModal = String(proposalId);
        }
        setFlash(result?.message || "Pedido atualizado.");
      } catch (error) {
        setFlash("", error.message);
      }
    });
  });
}
