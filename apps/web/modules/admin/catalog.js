import {
  readFormValues,
  renderSettingsModalShell,
} from "./settings.js";

import {
  api,
  formData,
  loadCompanyAssignments,
  loadCustomerAssignments,
  loadRouteData,
  setFlash,
} from "../core/api.js";

import {
  render,
} from "../core/shell.js";

import {
  resetPage,
  state,
} from "../core/state.js";

import {
  companyOptions,
  date,
  money,
  safe,
  uiIcons,
  wirePagination,
  wireSearchSubmit,
} from "../core/ui.js";

import {
  renderCompanies,
  renderProducts,
} from "../features/catalog-views.js";

import {
  customerFormSnapshot,
  registrationFormFields,
} from "../features/customer-requests.js";

import {
  renderCustomers,
} from "../features/customers.js";

import {
  getProposalById,
  proposalNumber,
} from "../features/proposals.js";

export function renderProductsTable(products) {
  if (!products.length) {
    return `<p class="empty-state compact">Nenhum produto para o filtro escolhido.</p>`;
  }

  return `
    <div class="entity-card-list product-card-list">
      ${products
        .map(
          (product) => `
            <article class="entity-card ${product.active ? "" : "is-disabled"}">
              <header class="entity-card-head">
                <div class="entity-card-title">
                  <span class="entity-avatar">${safe((product.code || "?").slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${safe(product.name)}</strong>
                    <small>${safe(product.company_name)} • codigo ${safe(product.code)}</small>
                  </div>
                </div>
                ${product.active ? '<span class="badge ok">Ativo</span>' : '<span class="badge danger">Inativo</span>'}
              </header>
              <div class="entity-card-grid">
                <div><span>Empresa</span><strong>${safe(product.company_name)}</strong></div>
                <div><span>Codigo</span><strong>${safe(product.code)}</strong></div>
                <div><span>Unidade</span><strong>${safe(product.unit || "UN")}</strong></div>
                <div><span>Preco</span><strong>${safe(money(product.price))}</strong></div>
              </div>
              <footer class="entity-card-actions">
                <button type="button" class="secondary icon-text-btn" data-product-edit="${safe(product.id)}">${uiIcons.edit}<span>Editar</span></button>
                <button type="button" class="danger ghost icon-text-btn" data-product-delete="${safe(product.id)}">${uiIcons.trash}<span>Excluir</span></button>
              </footer>
            </article>
          `
        )
        .join("")}
    </div>
  `; 
}

export function getAdminCompany(companyId) {
  return state.admin.companies.find((company) => String(company.id) === String(companyId)) || null;
}

export function renderCompaniesTable(companies) {
  if (!companies.length) {
    return `<p class="empty-state compact">Nenhuma empresa para o filtro escolhido.</p>`;
  }

  return `
    <div class="entity-card-list">
      ${companies
        .map(
          (company) => `
            <article class="entity-card ${company.active ? "" : "is-disabled"}">
              <header class="entity-card-head">
                <div class="entity-card-title">
                  <span class="entity-avatar">${safe((company.name || "?").slice(0, 1).toUpperCase())}</span>
                  <div>
                    <strong>${safe(company.name)}</strong>
                    <small>${safe(company.legal_name || "Sem razao social")}</small>
                  </div>
                </div>
                ${company.active ? '<span class="badge ok">Ativo</span>' : '<span class="badge danger">Inativo</span>'}
              </header>
              <div class="entity-card-grid">
                <div><span>Empresa</span><strong>${safe(company.name)}</strong></div>
                <div><span>Razao social</span><strong>${safe(company.legal_name || "Nao informada")}</strong></div>
                <div><span>Produtos</span><strong>${safe(company.product_count || 0)} cadastrado(s)</strong></div>
              </div>
              <footer class="entity-card-actions">
                <label class="switch" title="${safe(company.active ? "Desabilitar empresa" : "Habilitar empresa")}">
                  <input type="checkbox" data-company-active-toggle data-company-id="${safe(company.id)}" ${company.active ? "checked" : ""} />
                  <span class="switch-track"></span>
                </label>
                <button type="button" class="secondary icon-text-btn" data-company-edit="${safe(company.id)}">${uiIcons.edit}<span>Editar</span></button>
                <button type="button" class="danger ghost icon-text-btn" data-company-delete="${safe(company.id)}">${uiIcons.trash}<span>Excluir</span></button>
              </footer>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function normalizeCsvHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseDelimitedText(text) {
  const raw = String(text || "").replace(/\r/g, "");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return { delimiter: ",", headers: [], rows: [] };
  }
  const headerLine = lines[0];
  const delimiterScores = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    score: splitDelimitedLine(headerLine, delimiter).length,
  }));
  const delimiter = delimiterScores.sort((a, b) => b.score - a.score)[0]?.delimiter || ",";
  const headers = splitDelimitedLine(headerLine, delimiter);
  const rows = lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
  return { delimiter, headers, rows };
}

export function buildProductImportMapping(headers) {
  const normalized = headers.map((header) => ({ header, key: normalizeCsvHeader(header) }));
  const findHeader = (...needles) => {
    const match = normalized.find((entry) => needles.some((needle) => entry.key.includes(needle)));
    return match ? match.header : "";
  };
  return {
    company_id: findHeader("empresa", "company"),
    code: findHeader("codigo", "codigoproduto", "code", "sku"),
    name: findHeader("produto", "nome", "descricao", "name"),
    unit: findHeader("unidade", "unit"),
    price: findHeader("preco", "valor", "price"),
    active: findHeader("ativo", "status", "active"),
  };
}

export function parseBooleanLike(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["1", "true", "sim", "yes", "ativo", "active", "s"].includes(text);
}

export function resolveCompanyId(value, fallbackId = "") {
  const text = String(value || "").trim();
  if (!text) {
    return String(fallbackId || "");
  }
  const numeric = Number(text);
  if (!Number.isNaN(numeric)) {
    const byId = state.admin.companies.find((company) => String(company.id) === String(numeric));
    if (byId) {
      return String(byId.id);
    }
  }
  const normalized = text.toLowerCase();
  const match = state.admin.companies.find((company) => {
    return [company.name, company.legal_name]
      .filter(Boolean)
      .some((candidate) => String(candidate).trim().toLowerCase() === normalized);
  });
  return match ? String(match.id) : String(fallbackId || "");
}

export function renderProductEditorModal() {
  const modal = state.admin.activeProductModal;
  if (!modal || !["create", "edit"].includes(modal.mode)) {
    return "";
  }
  const product = modal.mode === "edit" ? state.admin.products.find((entry) => String(entry.id) === String(modal.productId)) : null;
  if (modal.mode === "edit" && !product) {
    return "";
  }
  return renderSettingsModalShell({
    modalKey: "productEditorModal",
    eyebrow: "Catalogo",
    title: modal.mode === "edit" ? "Editar produto" : "Novo produto",
    closable: false,
    body: `
      <form class="settings-modal-form" id="productModalForm" data-product-mode="${safe(modal.mode)}" ${product ? `data-product-id="${safe(product.id)}"` : ""}>
        <div class="form-grid two">
          <label class="span-2">
            Empresa
            <select name="company_id" required>
              <option value="">Selecione</option>
              ${companyOptions(product?.company_id || modal.companyId || state.admin.productFilterCompanyId)}
            </select>
          </label>
          <label>
            Codigo
            <input name="code" required value="${safe(product?.code || "")}" />
          </label>
          <label>
            Nome do produto
            <input name="name" required value="${safe(product?.name || "")}" />
          </label>
          <label>
            Unidade
            <input name="unit" value="${safe(product?.unit || "UN")}" />
          </label>
          <label>
            Preco base
            <input name="price" type="number" min="0" step="0.01" value="${safe(product?.price ?? 0)}" />
          </label>
          <label class="check-field span-2">
            <input name="active" type="checkbox" ${product ? (product.active ? "checked" : "") : "checked"} />
            Produto ativo
          </label>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-product-modal>Cancelar</button>
          <button type="submit">${modal.mode === "edit" ? "Salvar alterações" : "Salvar produto"}</button>
        </div>
      </form>
    `,
  });
}

export function renderProductImportModal() {
  const modal = state.admin.activeProductModal;
  if (!modal || modal.mode !== "import-config") {
    return "";
  }
  const headers = modal.headers || [];
  const rows = modal.rows || [];
  const mapping = modal.mapping || {};
  const sampleRows = rows.slice(0, 3);
  const mappingOptions = (selected) =>
    [`<option value="">Nao importar</option>`]
      .concat(headers.map((header) => `<option value="${safe(header)}" ${String(selected) === String(header) ? "selected" : ""}>${safe(header)}</option>`))
      .join("");
  const companyOptionsForImport = [
    `<option value="">Selecione</option>`,
    ...state.admin.companies.map((company) => `<option value="${safe(company.id)}" ${String(modal.defaultCompanyId || "") === String(company.id) ? "selected" : ""}>${safe(company.name)}</option>`),
  ].join("");

  return renderSettingsModalShell({
    modalKey: "productImportModal",
    eyebrow: "Catalogo",
    title: "Configurar importacao",
    wide: true,
    closable: false,
    body: `
      <form class="settings-modal-form" id="productImportForm">
        <div class="products-import-summary">
          <div class="import-badge">Arquivo: <strong>${safe(modal.fileName || "planilha.csv")}</strong></div>
          <div class="import-badge">Linhas: <strong>${safe(rows.length)}</strong></div>
          <div class="import-badge">Colunas: <strong>${safe(headers.length)}</strong></div>
        </div>
        <div class="form-grid two">
          <label class="span-2">
            Empresa padrao
            <select name="default_company_id" required>
              ${companyOptionsForImport}
            </select>
          </label>
          <label>
            Coluna da empresa
            <select name="map_company_id">
              ${mappingOptions(mapping.company_id)}
            </select>
          </label>
          <label>
            Coluna do codigo
            <select name="map_code" required>
              ${mappingOptions(mapping.code)}
            </select>
          </label>
          <label>
            Coluna do nome
            <select name="map_name" required>
              ${mappingOptions(mapping.name)}
            </select>
          </label>
          <label>
            Coluna da unidade
            <select name="map_unit">
              ${mappingOptions(mapping.unit)}
            </select>
          </label>
          <label>
            Coluna do preco
            <select name="map_price">
              ${mappingOptions(mapping.price)}
            </select>
          </label>
          <label>
            Coluna do status
            <select name="map_active">
              ${mappingOptions(mapping.active)}
            </select>
          </label>
        </div>
        <div class="import-preview">
          <table>
            <thead>
              <tr>
                ${headers.map((header) => `<th>${safe(header)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${sampleRows
                .map(
                  (row) => `
                    <tr>
                      ${headers.map((header) => `<td>${safe(row[header] ?? "")}</td>`).join("")}
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-product-modal>Cancelar</button>
          <button type="submit">Importar produtos</button>
        </div>
      </form>
    `,
  });
}

export function renderCustomerModal() {
  const modal = state.admin.activeCustomerModal;
  if (!modal) {
    return "";
  }
  const customer = modal.mode === "edit" ? state.admin.customers.find((item) => String(item.id) === String(modal.customerId)) : null;
  if (modal.mode === "edit" && !customer) {
    return "";
  }
  const snapshot = customerFormSnapshot(customer || {});
  return renderSettingsModalShell({
    modalKey: "customerModal",
    eyebrow: "Clientes",
    title: modal.mode === "edit" ? "Editar cliente" : "Novo cliente",
    wide: true,
    closable: false,
    body: `
      <div class="customer-edit-shell">
        <div class="request-modal-hero">
          <div class="request-modal-hero-copy">
            <p class="eyebrow">${modal.mode === "edit" ? "Editar cliente" : "Novo cliente"}</p>
            <h3>${safe(customer?.legal_name || "Cadastro de cliente")}</h3>
            <p class="request-modal-subtitle">
              ${safe(customer?.trade_name || "Sem nome fantasia")} | ${safe(customer?.cnpj || "CNPJ nao informado")}
            </p>
          </div>
          <div class="request-modal-hero-badges">
            <span class="badge ${customer ? (customer.active ? "ok" : "danger") : "brand"}">${customer ? (customer.active ? "Ativo" : "Inativo") : "Novo"}</span>
            <span class="badge">${safe(customer?.seller_count || 0)} ${Number(customer?.seller_count || 0) === 1 ? "representante comercial" : "representantes comerciais"}</span>
          </div>
        </div>

        <div class="request-modal-summary-grid">
          <article class="request-modal-summary-card accent">
            <span>Representante comercial vinculado</span>
            <strong>${safe(customer?.seller_names || customer?.seller_name || "Sem vinculo")}</strong>
            <small>${safe(customer?.seller_email || "Sem usuario vinculado")}</small>
          </article>
          <article class="request-modal-summary-card">
            <span>Status</span>
            <strong>${customer ? (customer.active ? "Ativo" : "Inativo") : "Cadastro novo"}</strong>
            <small>${safe(customer?.form_payload ? "Cadastro com dados completos" : "Cadastro simples")}</small>
          </article>
          <article class="request-modal-summary-card">
            <span>Contato</span>
            <strong>${safe(customer?.phone || "Nao informado")}</strong>
            <small>${safe(customer?.email || "Sem e-mail")}</small>
          </article>
          <article class="request-modal-summary-card">
            <span>Endereco</span>
            <strong>${safe(customer?.address || "Nao informado")}</strong>
            <small>${safe(customer?.state_registration || "IE nao informada")}</small>
          </article>
        </div>

        <form class="settings-modal-form customer-modal-form registration-form" id="customerModalForm" data-customer-mode="${safe(modal.mode)}" ${customer ? `data-customer-id="${safe(customer.id)}"` : ""} data-customer-autofill="admin">
          ${registrationFormFields(snapshot, { requireRepresentative: false })}
          <label class="check-field span-2">
            <input name="active" type="checkbox" ${customer ? (customer.active ? "checked" : "") : "checked"} />
            Cliente ativo
          </label>
          <div class="modal-footer split">
            <button type="button" class="secondary" data-close-customer-modal>Cancelar</button>
            <button type="submit">${modal.mode === "edit" ? "Salvar cliente" : "Cadastrar cliente"}</button>
          </div>
        </form>
      </div>
    `,
  });
}

export function renderCustomerViewModal() {
  const customerId = state.admin.activeCustomerViewModal;
  if (!customerId) {
    return "";
  }
  const customer = getAdminCustomer(customerId);
  if (!customer) {
    return "";
  }
  return renderSettingsModalShell({
    modalKey: "customerViewModal",
    eyebrow: "Clientes",
    title: "Visualizar cliente",
    wide: true,
    closable: false,
    body: `
      <div class="customer-view-shell">
        <div class="request-modal-hero">
          <div class="request-modal-hero-copy">
            <p class="eyebrow">Cliente #${safe(customer.id)}</p>
            <h3>${safe(customer.legal_name)}</h3>
            <p class="request-modal-subtitle">${safe(customer.trade_name || "Sem nome fantasia")} | ${safe(customer.cnpj)}</p>
          </div>
          <div class="request-modal-hero-badges">
            <span class="badge ${customer.active ? "ok" : "danger"}">${customer.active ? "Ativo" : "Inativo"}</span>
            <span class="badge">${safe(customer.seller_count || 0)} ${Number(customer.seller_count || 0) === 1 ? "representante comercial" : "representantes comerciais"}</span>
          </div>
        </div>

        <div class="request-modal-layout">
          <aside class="request-modal-sidebar">
            <div class="request-modal-summary-grid">
              <article class="request-modal-summary-card accent">
                <span>Representante comercial vinculado</span>
                <strong>${safe(customer.seller_names || customer.seller_name || "Nenhum representante comercial vinculado")}</strong>
                <small>${safe(customer.seller_email || "Sem usuario vinculado")}</small>
              </article>
              <article class="request-modal-summary-card">
                <span>Telefone</span>
                <strong>${safe(customer.phone || "Nao informado")}</strong>
                <small>${safe(customer.email || "Sem e-mail")}</small>
              </article>
              <article class="request-modal-summary-card">
                <span>Endereco</span>
                <strong>${safe(customer.address || "Nao informado")}</strong>
                <small>${safe(customer.state_registration || "IE nao informada")}</small>
              </article>
              <article class="request-modal-summary-card">
                <span>Status</span>
                <strong>${customer.active ? "Ativo" : "Inativo"}</strong>
                <small>${safe(customer.notes ? "Com observacoes internas" : "Sem observacoes internas")}</small>
              </article>
            </div>
          </aside>

          <section class="request-modal-section">
            <div class="request-modal-section-head">
              <div>
                <p class="eyebrow">Informacoes</p>
                <h4>Dados completos do cadastro</h4>
              </div>
              <p class="lead">Tudo em modo de leitura para consulta rapida.</p>
            </div>
            <div class="form-grid two customer-view-grid">
              <label class="span-2">
                Razao social
                <input value="${safe(customer.legal_name || "")}" readonly />
              </label>
              <label>
                Nome fantasia
                <input value="${safe(customer.trade_name || "")}" readonly />
              </label>
              <label>
                CNPJ
                <input value="${safe(customer.cnpj || "")}" readonly />
              </label>
              <label>
                Inscricao estadual
                <input value="${safe(customer.state_registration || "")}" readonly />
              </label>
              <label class="span-2">
                Endereco
                <input value="${safe(customer.address || "")}" readonly />
              </label>
              <label>
                Telefone
                <input value="${safe(customer.phone || "")}" readonly />
              </label>
              <label>
                E-mail
                <input value="${safe(customer.email || "")}" readonly />
              </label>
              <label class="span-2">
                Representante comercial vinculado
                <input value="${safe(customer.seller_names || customer.seller_name || "Nenhum representante comercial vinculado")}" readonly />
              </label>
              <label class="span-2">
                Observacoes
                <textarea readonly>${safe(customer.notes || "")}</textarea>
              </label>
            </div>
          </section>
        </div>

        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-customer-view-modal>Fechar</button>
          <div class="proposal-view-footer-actions">
            <div class="proposal-view-footer-actions-secondary">
              <button type="button" class="secondary" data-customer-performance-pdf="${safe(customer.id)}">${uiIcons.pdf}<span>Análise PDF</span></button>
            </div>
            <div class="proposal-view-footer-actions-primary">
              <button type="button" data-customer-view-edit="${safe(customer.id)}">${uiIcons.edit}<span>Editar cliente</span></button>
            </div>
          </div>
        </div>
      </div>
    `,
  });
}

export function renderCompanyModal() {
  const modal = state.admin.activeCompanyModal;
  if (!modal) {
    return "";
  }
  const company = modal.mode === "edit" ? getAdminCompany(modal.companyId) : null;
  if (modal.mode === "edit" && !company) {
    return "";
  }
  return renderSettingsModalShell({
    modalKey: "companyModal",
    eyebrow: "Empresas",
    title: modal.mode === "edit" ? "Editar empresa" : "Nova empresa",
    closable: false,
    body: `
      <form class="settings-modal-form" id="companyModalForm" data-company-mode="${safe(modal.mode)}" ${company ? `data-company-id="${safe(company.id)}"` : ""}>
        <div class="form-grid two">
          <label class="span-2">
            Nome da empresa
            <input name="name" required value="${safe(company?.name || "")}" placeholder="Nome usado na operacao" />
          </label>
          <label class="span-2">
            Razao social
            <input name="legal_name" value="${safe(company?.legal_name || "")}" placeholder="Razao social completa" />
          </label>
          <label class="check-field span-2">
            <input name="active" type="checkbox" ${company ? (company.active ? "checked" : "") : "checked"} />
            Empresa ativa
          </label>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-company-modal>Cancelar</button>
          <button type="submit">${modal.mode === "edit" ? "Salvar empresa" : "Cadastrar empresa"}</button>
        </div>
      </form>
    `,
  });
}

export function renderOutboxTable(outbox) {
  if (!outbox.length) {
    return `<p class="empty-state">Ainda nao ha mensagens registradas.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Destinatarios</th>
          <th>Assunto</th>
          <th>Status</th>
          <th>Mensagem</th>
        </tr>
      </thead>
      <tbody>
        ${outbox
          .map(
            (entry) => `
              <tr>
                <td>${safe(date(entry.created_at))}</td>
                <td>${safe(entry.kind)}</td>
                <td>${safe(entry.recipients)}</td>
                <td>${safe(entry.subject)}</td>
                <td>
                  ${
                    entry.sent_at
                      ? `<span class="badge ok">Enviado</span>`
                      : entry.error
                        ? `<span class="badge danger">Erro</span><small>${safe(entry.error)}</small>`
                        : `<span class="badge warn">Pendente</span>`
                  }
                </td>
                <td>
                  <details class="detail-list">
                    <summary>Ver texto</summary>
                    <pre>${safe(entry.body)}</pre>
                  </details>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function normalizeCnpj(value) {
  return String(value || "").replace(/\D+/g, "").slice(0, 14);
}

export function formatCnpj(value) {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) {
    return digits;
  }
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export async function lookupCnpjData(cnpj, excludeCustomerId = "") {
  const clean = normalizeCnpj(cnpj);
  if (clean.length !== 14) {
    throw new Error("Informe um CNPJ valido.");
  }
  const suffix = excludeCustomerId ? `&exclude_customer_id=${encodeURIComponent(excludeCustomerId)}` : "";
  const result = await api(`/api/integrations/cnpj?cnpj=${encodeURIComponent(clean)}${suffix}`, { method: "GET" });
  return result;
}

export function applyCustomerLookup(form, data) {
  const fields = {
    legal_name: data.legal_name,
    trade_name: data.trade_name,
    cnpj: data.cnpj,
    state_registration: data.state_registration,
    address: data.address_line || data.address,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    zip_code: data.zip_code,
    phone_1: data.phone,
    purchase_email: data.email,
  };
  Object.entries(fields).forEach(([name, value]) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (!field || String(field.value || "").trim()) {
      return;
    }
    field.value = value || "";
  });
  const status = form.querySelector("[data-cnpj-lookup-status]");
  if (status) {
    status.textContent = data.legal_name ? "Dados carregados pela consulta de CNPJ." : "Consulta concluida.";
  }
}

export function wireCustomerAutofill(form) {
  if (!form) {
    return;
  }
  const cnpjField = form.querySelector('[name="cnpj"]');
  const lookupButton = form.querySelector("[data-cnpj-lookup]");
  const status = form.querySelector("[data-cnpj-lookup-status]");
  const excludeCustomerId = form.dataset.customerId || "";
  let lookupTimer = null;
  const triggerLookup = async () => {
    const cnpj = normalizeCnpj(cnpjField?.value || "");
    if (cnpj.length !== 14) {
      if (status) {
        status.textContent = "Digite os 14 digitos do CNPJ para preencher automaticamente.";
      }
      return;
    }
    if (status) {
      status.textContent = "Consultando CNPJ...";
    }
    try {
      const data = await lookupCnpjData(cnpj, excludeCustomerId);
      applyCustomerLookup(form, data);
      if (status) {
        status.textContent = "Consulta concluida. Ajuste apenas o que faltar.";
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      } else {
        setFlash("", error.message);
      }
    }
  };

  if (cnpjField) {
    cnpjField.addEventListener("input", () => {
      cnpjField.value = formatCnpj(cnpjField.value);
      clearTimeout(lookupTimer);
      lookupTimer = window.setTimeout(() => {
        triggerLookup();
      }, 700);
    });
    cnpjField.addEventListener("blur", triggerLookup);
  }
  if (lookupButton) {
    lookupButton.addEventListener("click", triggerLookup);
  }
}

export function getAdminCustomer(customerId) {
  return state.admin.customers.find((customer) => String(customer.id) === String(customerId)) || null;
}

export function getAdminRequest(requestId) {
  return state.admin.requests.find((request) => String(request.id) === String(requestId)) || null;
}

export async function openCustomerAssignmentModal() {
  if (!state.admin.customerAssignmentSellerId) {
    return;
  }
  state.admin.customerAssignmentSearch = "";
  state.admin.customerAssignmentFilter = "all";
  state.admin.activeAssignmentModal = {
    sellerId: String(state.admin.customerAssignmentSellerId),
  };
  state.admin.activeCustomerModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeCompanyModal = null;
  state.admin.activeRequestModal = null;
  render();
  try {
    await loadCustomerAssignments(state.admin.customerAssignmentSellerId);
  } catch (error) {
    setFlash("", error.message);
    return;
  }
  render();
}

export function closeCustomerAssignmentModal() {
  state.admin.activeAssignmentModal = null;
  render();
}

export async function openCompanyAssignmentModal() {
  if (!state.admin.customerAssignmentSellerId) return;
  state.admin.companyAssignmentSearch = "";
  state.admin.companyAssignmentFilter = "all";
  state.admin.activeCompanyAssignmentModal = {
    sellerId: String(state.admin.customerAssignmentSellerId),
  };
  state.admin.activeAssignmentModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeCompanyModal = null;
  render();
  try {
    await loadCompanyAssignments(state.admin.customerAssignmentSellerId);
  } catch (error) {
    setFlash("", error.message);
  }
  render();
}

export function closeCompanyAssignmentModal() {
  state.admin.activeCompanyAssignmentModal = null;
  render();
}

export function openCustomerModal(mode, customerId = null) {
  state.admin.activeCustomerModal = {
    mode,
    customerId: customerId ? String(customerId) : null,
  };
  state.admin.activeCompanyModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeAssignmentModal = null;
  state.admin.activeCustomerViewModal = null;
  render();
}

export function closeCustomerModal() {
  state.admin.activeCustomerModal = null;
  render();
}

export function openCustomerViewModal(customerId) {
  state.admin.activeCustomerViewModal = String(customerId);
  state.admin.activeCustomerModal = null;
  state.admin.activeCompanyModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeAssignmentModal = null;
  render();
}

export function closeCustomerViewModal() {
  state.admin.activeCustomerViewModal = null;
  render();
}

export function openRequestModal(requestId) {
  state.admin.activeRequestModal = String(requestId);
  state.admin.activeCustomerModal = null;
  state.admin.activeCustomerViewModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeProductModal = null;
  state.admin.activeCompanyModal = null;
  state.admin.activeAssignmentModal = null;
  render();
}

export function closeRequestModal() {
  state.admin.activeRequestModal = null;
  render();
}

export function wireCustomers(view) {
  wirePagination(view);
  view.querySelectorAll("[data-open-customer-modal]").forEach((button) => {
    button.addEventListener("click", () => openCustomerModal(button.dataset.openCustomerModal));
  });

  view.querySelectorAll("[data-customer-edit]").forEach((button) => {
    button.addEventListener("click", () => openCustomerModal("edit", button.dataset.customerEdit));
  });

  view.querySelectorAll("[data-customer-view]").forEach((button) => {
    button.addEventListener("click", () => openCustomerViewModal(button.dataset.customerView));
  });

  view.querySelectorAll("[data-customer-active-toggle]").forEach((control) => {
    control.addEventListener("change", () => toggleCustomerActive(control.dataset.customerId, control.checked));
  });
  view.querySelectorAll("[data-customer-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomer(button.dataset.customerDelete));
  });

  const searchInput = view.querySelector("[data-customer-search]");
  if (searchInput) {
    wireSearchSubmit(view, "[data-customer-search]", (value) => {
      state.admin.customerSearch = value;
      resetPage("adminCustomers");
      renderCustomers(view);
    });
  }

  const activeFilter = view.querySelector("[data-customer-active-filter]");
  if (activeFilter) {
    activeFilter.addEventListener("change", () => {
      state.admin.customerActiveFilter = activeFilter.value;
      resetPage("adminCustomers");
      renderCustomers(view);
    });
  }
}

export async function submitCustomerModal(event) {
  event.preventDefault();
  const form = event.target;
  const values = formData(form);
  const mode = form.dataset.customerMode || "create";
  const customerId = form.dataset.customerId;
  const endpoint = mode === "edit" && customerId ? `/api/admin/customers/${customerId}` : "/api/admin/customers";
  const method = mode === "edit" && customerId ? "PATCH" : "POST";
  try {
    const result = await api(endpoint, {
      method,
      body: JSON.stringify(values),
    });
    await loadRouteData("customers");
    state.admin.activeCustomerModal = null;
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function toggleCustomerActive(customerId, active) {
  const customer = getAdminCustomer(customerId);
  if (!customer) {
    return;
  }
  try {
    const result = await api(`/api/admin/customers/${customerId}`, {
      method: "PATCH",
      body: JSON.stringify({
        legal_name: customer.legal_name,
        trade_name: customer.trade_name,
        cnpj: customer.cnpj,
        state_registration: customer.state_registration,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        active,
      }),
    });
    await loadRouteData("customers");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function deleteCustomer(customerId) {
  const customer = getAdminCustomer(customerId);
  const name = customer?.legal_name || "este cliente";
  if (!window.confirm(`Excluir ${name}? Esta acao nao pode ser desfeita.`)) {
    return;
  }
  try {
    const result = await api(`/api/admin/customers/${customerId}`, { method: "DELETE" });
    await loadRouteData("customers");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitAdminCustomer(event) {
  event.preventDefault();
  try {
    const result = await api("/api/admin/customers", {
      method: "POST",
      body: JSON.stringify(formData(event.target)),
    });
    await loadRouteData("admin");
    event.target.reset();
    state.message = result.message;
    state.error = "";
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function toggleCustomerAssignment(customerId, assigned) {
  const sellerId = state.admin.customerAssignmentSellerId;
  if (!sellerId) {
    return;
  }
  try {
    const result = await api("/api/admin/customer-assignments", {
      method: "PATCH",
      body: JSON.stringify({
        customer_id: customerId,
        seller_id: sellerId,
        assigned,
      }),
    });
    await loadCustomerAssignments(sellerId);
    setFlash(result.message);
    render();
  } catch (error) {
    setFlash("", error.message);
    await loadCustomerAssignments(sellerId).catch(() => {});
    render();
  }
}

export async function toggleCompanyAssignment(companyId, assigned) {
  const sellerId = state.admin.customerAssignmentSellerId;
  if (!sellerId) return;
  try {
    const result = await api("/api/admin/company-assignments", {
      method: "PATCH",
      body: JSON.stringify({ company_id: companyId, seller_id: sellerId, assigned }),
    });
    await loadCompanyAssignments(sellerId);
    setFlash(result.message);
    render();
  } catch (error) {
    setFlash("", error.message);
    await loadCompanyAssignments(sellerId).catch(() => {});
    render();
  }
}

export async function submitCompany(event) {
  event.preventDefault();
  try {
    const result = await api("/api/admin/companies", {
      method: "POST",
      body: JSON.stringify(formData(event.target)),
    });
    await loadRouteData("admin");
    event.target.reset();
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitProduct(event) {
  event.preventDefault();
  try {
    const result = await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(formData(event.target)),
    });
    await loadRouteData("admin");
    event.target.reset();
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export function openProductModal(mode, payload = {}) {
  state.admin.activeProductModal = { mode, ...payload };
  state.admin.activeUserModal = null;
  state.admin.activeAssignmentModal = null;
  render();
}

export function closeProductModal() {
  state.admin.activeProductModal = null;
  render();
}

export function openCompanyModal(mode, companyId = null) {
  state.admin.activeCompanyModal = {
    mode,
    companyId: companyId ? String(companyId) : null,
  };
  state.admin.activeProductModal = null;
  state.admin.activeUserModal = null;
  state.admin.activeAssignmentModal = null;
  render();
}

export function closeCompanyModal() {
  state.admin.activeCompanyModal = null;
  render();
}

export function wireCompanies(view) {
  wirePagination(view);
  view.querySelectorAll("[data-open-company-modal]").forEach((button) => {
    button.addEventListener("click", () => openCompanyModal(button.dataset.openCompanyModal));
  });

  view.querySelectorAll("[data-company-edit]").forEach((button) => {
    button.addEventListener("click", () => openCompanyModal("edit", button.dataset.companyEdit));
  });

  view.querySelectorAll("[data-company-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCompany(button.dataset.companyDelete));
  });

  view.querySelectorAll("[data-company-active-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => toggleCompanyActive(toggle.dataset.companyId, toggle.checked));
  });

  const searchInput = view.querySelector("[data-company-search]");
  if (searchInput) {
    wireSearchSubmit(view, "[data-company-search]", (value) => {
      state.admin.companySearch = value;
      resetPage("adminCompanies");
      renderCompanies(view);
    });
  }

  const activeFilter = view.querySelector("[data-company-active-filter]");
  if (activeFilter) {
    activeFilter.addEventListener("change", () => {
      state.admin.companyActiveFilter = activeFilter.value;
      resetPage("adminCompanies");
      renderCompanies(view);
    });
  }
}

export function wireProducts(view) {
  wirePagination(view);
  view.querySelectorAll("[data-open-product-modal]").forEach((button) => {
    button.addEventListener("click", () => openProductModal(button.dataset.openProductModal, { companyId: state.admin.productFilterCompanyId }));
  });
  view.querySelectorAll("[data-product-edit]").forEach((button) => {
    button.addEventListener("click", () => openProductModal("edit", { productId: button.dataset.productEdit }));
  });
  view.querySelectorAll("[data-product-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteProduct(button.dataset.productDelete));
  });

  const importButton = view.querySelector("[data-open-product-import]");
  const importInput = view.querySelector("[data-product-import-file]");
  if (importButton && importInput) {
    importButton.addEventListener("click", () => {
      importInput.value = "";
      importInput.click();
    });
    importInput.addEventListener("change", handleProductImportFile);
  }

  const exportButton = view.querySelector("[data-export-products]");
  if (exportButton) {
    exportButton.addEventListener("click", exportFilteredProducts);
  }

  const searchInput = view.querySelector("[data-product-search]");
  if (searchInput) {
    wireSearchSubmit(view, "[data-product-search]", (value) => {
      state.admin.productSearch = value;
      resetPage("adminProducts");
      renderProducts(view);
    });
  }

  const companyFilter = view.querySelector("[data-product-company-filter]");
  if (companyFilter) {
    companyFilter.addEventListener("change", () => {
      state.admin.productFilterCompanyId = companyFilter.value;
      resetPage("adminProducts");
      renderProducts(view);
    });
  }

  const activeFilter = view.querySelector("[data-product-active-filter]");
  if (activeFilter) {
    activeFilter.addEventListener("change", () => {
      state.admin.productActiveFilter = activeFilter.value;
      resetPage("adminProducts");
      renderProducts(view);
    });
  }
}

export async function submitProductModal(event) {
  event.preventDefault();
  const form = event.target;
  const mode = form.dataset.productMode || "create";
  const productId = form.dataset.productId;
  const endpoint = mode === "edit" && productId ? `/api/admin/products/${productId}` : "/api/admin/products";
  const method = mode === "edit" && productId ? "PATCH" : "POST";
  try {
    const result = await api(endpoint, {
      method,
      body: JSON.stringify(formData(form)),
    });
    await loadRouteData("products");
    state.admin.activeProductModal = null;
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function deleteProduct(productId) {
  const product = state.admin.products.find((entry) => String(entry.id) === String(productId));
  const name = product?.name || "este produto";
  if (!window.confirm(`Excluir ${name}? Esta acao nao pode ser desfeita.`)) {
    return;
  }
  try {
    const result = await api(`/api/admin/products/${productId}`, { method: "DELETE" });
    await loadRouteData("products");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitCompanyModal(event) {
  event.preventDefault();
  const form = event.target;
  const values = readFormValues(form);
  const companyId = form.dataset.companyId;
  const mode = form.dataset.companyMode || "create";
  const endpoint = mode === "edit" && companyId ? `/api/admin/companies/${companyId}` : "/api/admin/companies";
  const method = mode === "edit" && companyId ? "PATCH" : "POST";
  try {
    const result = await api(endpoint, {
      method,
      body: JSON.stringify(values),
    });
    await loadRouteData("companies");
    state.admin.activeCompanyModal = null;
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function handleProductImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  const parsed = parseDelimitedText(text);
  if (!parsed.headers.length) {
    setFlash("", "Nao foi possivel ler o cabecalho do CSV.");
    return;
  }
  state.admin.activeProductModal = {
    mode: "import-config",
    fileName: file.name,
    headers: parsed.headers,
    rows: parsed.rows,
    mapping: buildProductImportMapping(parsed.headers),
    defaultCompanyId: state.admin.productFilterCompanyId || state.admin.companies[0]?.id || "",
  };
  state.admin.activeUserModal = null;
  render();
}

export async function toggleCompanyActive(companyId, active) {
  const company = getAdminCompany(companyId);
  if (!company) {
    return;
  }
  try {
    const result = await api(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: company.name,
        legal_name: company.legal_name,
        active,
      }),
    });
    await loadRouteData("companies");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function deleteCompany(companyId) {
  const company = getAdminCompany(companyId);
  const name = company?.name || "esta empresa";
  if (
    !window.confirm(
      `Excluir ${name}? Esta acao remove a empresa, seus produtos e os pedidos vinculados a ela. Nao sera possivel desfazer.`
    )
  ) {
    return;
  }
  try {
    const result = await api(`/api/admin/companies/${companyId}`, { method: "DELETE" });
    await loadRouteData("companies");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitProductImportModal(event) {
  event.preventDefault();
  const form = event.target;
  const modal = state.admin.activeProductModal;
  if (!modal || modal.mode !== "import-config") {
    return;
  }
  const values = readFormValues(form);
  const defaultCompanyId = String(values.default_company_id || "").trim();
  if (!defaultCompanyId) {
    setFlash("", "Selecione uma empresa padrao.");
    return;
  }

  const mappedRows = (modal.rows || [])
    .map((row) => {
      const companyValue = values.map_company_id ? row[values.map_company_id] : defaultCompanyId;
      const companyId = resolveCompanyId(companyValue, defaultCompanyId);
      const code = String(values.map_code ? row[values.map_code] : "").trim();
      const name = String(values.map_name ? row[values.map_name] : "").trim();
      if (!companyId || !code || !name) {
        return null;
      }
      const unit = values.map_unit ? String(row[values.map_unit] || "UN").trim() : "UN";
      const priceRaw = values.map_price ? String(row[values.map_price] || "0").trim() : "0";
      const activeRaw = values.map_active ? row[values.map_active] : "1";
      return {
        company_id: companyId,
        code,
        name,
        unit: unit || "UN",
        price: Number(String(priceRaw).replace(",", ".")) || 0,
        active: values.map_active ? parseBooleanLike(activeRaw) : true,
      };
    })
    .filter(Boolean);

  if (!mappedRows.length) {
    setFlash("", "Nao encontramos linhas validas para importar.");
    return;
  }

  try {
    const result = await api("/api/admin/products/import", {
      method: "POST",
      body: JSON.stringify({ rows: mappedRows }),
    });
    await loadRouteData("admin");
    state.admin.activeProductModal = null;
    setFlash(`${result.message} ${result.created || 0} novos e ${result.updated || 0} atualizados.`);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function exportFilteredProducts() {
  const params = new URLSearchParams();
  if (state.admin.productFilterCompanyId) {
    params.set("company_id", state.admin.productFilterCompanyId);
  }
  if (state.admin.productSearch) {
    params.set("q", state.admin.productSearch);
  }
  if (state.admin.productActiveFilter) {
    params.set("active", state.admin.productActiveFilter);
  }
  try {
    const result = await api(`/api/admin/products/export?${params.toString()}`, { method: "GET" });
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename || "produtos.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFlash("Exportacao concluida.");
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function updateRequestStatus(requestId, status) {
  try {
    const result = await api(`/api/admin/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadRouteData(state.route);
    closeRequestModal();
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitRequestModal(event) {
  event.preventDefault();
  const form = event.target;
  const requestId = form.dataset.requestId;
  if (!requestId) {
    return;
  }
  try {
    const result = await api(`/api/admin/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...formData(form),
      }),
    });
    await loadRouteData("admin");
    setFlash(result.message);
    render();
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitRequestModalAction(form, status) {
  const requestId = form.dataset.requestId;
  if (!requestId) {
    return;
  }
  try {
    const result = await api(`/api/admin/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...formData(form),
        status,
      }),
    });
    await loadRouteData("admin");
    closeRequestModal();
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function updateProposalStatus(proposalId, payloadOrStatus, deliveryForecast = "") {
  const payload = typeof payloadOrStatus === "object"
    ? payloadOrStatus
    : { status: payloadOrStatus, delivery_forecast: deliveryForecast };
  return api(`/api/admin/proposals/${proposalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProposal(proposalId) {
  const proposal = getProposalById(proposalId);
  const confirmed = window.confirm(`Excluir definitivamente o pedido #${proposalNumber(proposal) || proposalId}? Essa acao nao pode ser desfeita.`);
  if (!confirmed) return;
  try {
    const result = await api(`/api/admin/proposals/${proposalId}`, {
      method: "DELETE",
    });
    await loadRouteData("admin");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}
