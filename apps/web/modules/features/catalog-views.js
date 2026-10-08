import {
  renderCompaniesTable,
  renderProductsTable,
  wireCompanies,
  wireProducts,
} from "../admin/catalog.js";

import {
  paginateItems,
  state,
} from "../core/state.js";

import {
  companyOptions,
  renderPagination,
  safe,
  searchActionField,
  sectionBand,
  uiIcons,
} from "../core/ui.js";

export function renderProducts(view) {
  const search = String(state.admin.productSearch || "").trim().toLowerCase();
  const filteredProducts = state.admin.products.filter((product) => {
    if (state.admin.productFilterCompanyId && String(product.company_id) !== String(state.admin.productFilterCompanyId)) {
      return false;
    }
    if (state.admin.productActiveFilter === "active" && !product.active) {
      return false;
    }
    if (state.admin.productActiveFilter === "inactive" && product.active) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [product.company_name, product.code, product.name, product.unit, product.price]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  const productsPagination = paginateItems("adminProducts", filteredProducts);

  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "catalogPanel",
        span: "span-12",
        eyebrow: "Catalogo",
        title: "Produtos com busca, filtros e importacao",
        action: `
          <button type="button" class="secondary icon-text-btn" data-open-product-modal="create">${uiIcons.plus}<span>Adicionar produto</span></button>
          <button type="button" class="secondary icon-text-btn" data-open-product-import>${uiIcons.upload}<span>Importar CSV</span></button>
          <button type="button" class="secondary icon-text-btn" data-export-products>${uiIcons.download}<span>Exportar filtro</span></button>
        `,
        body: `
          <div class="products-toolbar">
            <div class="products-toolbar-copy">
              <p class="lead">Use busca, empresa e status para encontrar ou exportar o recorte certo da base.</p>
            </div>
            <div class="products-toolbar-filters">
              <label>
                Buscar
                ${searchActionField(`<input type="search" placeholder="Codigo, nome ou empresa" value="${safe(state.admin.productSearch || "")}" data-product-search />`)}
              </label>
              <label>
                Empresa
                <select data-product-company-filter>
                  <option value="">Todas</option>
                  ${companyOptions(state.admin.productFilterCompanyId)}
                </select>
              </label>
              <label>
                Status
                <select data-product-active-filter>
                  <option value="all" ${state.admin.productActiveFilter === "all" ? "selected" : ""}>Todos</option>
                  <option value="active" ${state.admin.productActiveFilter === "active" ? "selected" : ""}>Ativos</option>
                  <option value="inactive" ${state.admin.productActiveFilter === "inactive" ? "selected" : ""}>Inativos</option>
                </select>
              </label>
            </div>
          </div>
          <input type="file" accept=".csv,text/csv" class="is-hidden" data-product-import-file />
          <div class="products-summary">
            <span class="badge brand">${safe(filteredProducts.length)} itens visiveis</span>
            <span class="badge ok">${safe(state.admin.products.filter((product) => product.active).length)} ativos</span>
            <span class="badge danger">${safe(state.admin.products.filter((product) => !product.active).length)} inativos</span>
          </div>
          <div class="entity-card-shell products-list-shell">
            ${renderProductsTable(productsPagination.items)}
          </div>
          ${renderPagination("adminProducts", productsPagination)}
        `,
      })}
    </div>
  `;

  wireProducts(view);
}

export function renderCompanies(view) {
  const search = String(state.admin.companySearch || "").trim().toLowerCase();
  const filteredCompanies = state.admin.companies.filter((company) => {
    if (state.admin.companyActiveFilter === "active" && !company.active) {
      return false;
    }
    if (state.admin.companyActiveFilter === "inactive" && company.active) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [company.name, company.legal_name, company.product_count]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  const companiesPagination = paginateItems("adminCompanies", filteredCompanies);

  view.innerHTML = `
    <div class="admin-grid">
      ${sectionBand({
        id: "companiesPanel",
        span: "span-12",
        eyebrow: "Empresas",
        title: "Cadastro de empresas com busca e filtros",
        action: `
          <button type="button" class="secondary icon-text-btn" data-open-company-modal="create">${uiIcons.plus}<span>Nova empresa</span></button>
        `,
        body: `
          <div class="products-toolbar">
            <div class="products-toolbar-copy">
              <p class="lead">Organize as empresas no mesmo padrao dos produtos, com lista rapida e status visivel.</p>
            </div>
            <div class="products-toolbar-filters">
              <label>
                Buscar
                ${searchActionField(`<input type="search" placeholder="Empresa ou razao social" value="${safe(state.admin.companySearch || "")}" data-company-search />`)}
              </label>
              <label>
                Status
                <select data-company-active-filter>
                  <option value="all" ${state.admin.companyActiveFilter === "all" ? "selected" : ""}>Todos</option>
                  <option value="active" ${state.admin.companyActiveFilter === "active" ? "selected" : ""}>Ativos</option>
                  <option value="inactive" ${state.admin.companyActiveFilter === "inactive" ? "selected" : ""}>Inativos</option>
                </select>
              </label>
            </div>
          </div>
          <div class="products-summary">
            <span class="badge brand">${safe(filteredCompanies.length)} visiveis</span>
            <span class="badge ok">${safe(state.admin.companies.filter((company) => company.active).length)} ativos</span>
            <span class="badge danger">${safe(state.admin.companies.filter((company) => !company.active).length)} inativos</span>
          </div>
          <div class="entity-card-shell products-list-shell">
            ${renderCompaniesTable(companiesPagination.items)}
          </div>
          ${renderPagination("adminCompanies", companiesPagination)}
        `,
      })}
    </div>
  `;

  wireCompanies(view);
}
