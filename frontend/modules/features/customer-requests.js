import {
  openRequestModal,
  wireCustomerAutofill,
} from "../admin/catalog.js";

import {
  pendingRequestCount,
  pendingRequests,
} from "../admin/modals.js";

import {
  renderRequestsTable,
} from "../admin/orders.js";

import {
  api,
  formData,
  goTo,
  setFlash,
} from "../core/api.js";

import {
  paginateItems,
  state,
} from "../core/state.js";

import {
  renderPagination,
  safe,
  sectionBand,
  wirePagination,
} from "../core/ui.js";

export function renderCustomerApprovals(view) {
  const pendingCount = pendingRequestCount();
  const pendingPagination = paginateItems("customerApprovals", pendingRequests());
  view.innerHTML = `
    <div class="admin-grid settings-grid">
      ${sectionBand({
        id: "customerApprovalsIntro",
        span: "span-12",
        eyebrow: "Clientes",
        title: "Aprovacao de clientes",
        action: `<button type="button" class="secondary" data-go-customers-list>Voltar para clientes</button>`,
        body: `
          <div class="settings-intro">
            <p class="lead">
              Aqui ficam as solicitações enviadas pelos representantes comerciais e aguardando análise.
              Abra cada cartão para revisar os dados e aprovar ou negar o cadastro.
            </p>
          </div>
        `,
      })}

      ${sectionBand({
        id: "requestPanel",
        span: "span-12",
        eyebrow: "Solicitacoes",
        title: `${pendingCount} ${pendingCount === 1 ? "solicitacao" : "solicitacoes"} pendente${pendingCount === 1 ? "" : "s"}`,
        action: `<span class="badge ${pendingCount ? "danger" : "ok"}">${safe(pendingCount)} aguardando</span>`,
        body: `
          <div class="products-summary">
            <span class="badge brand">${safe(pendingCount)} pendentes</span>
            <span class="badge ${pendingCount ? "danger" : "ok"}">${safe(state.admin.requests.length)} total</span>
          </div>
          <div class="request-panel-shell">
            ${pendingCount ? renderRequestsTable(pendingPagination.items, true) : `<p class="empty-state">Nenhum cliente aguardando aprovacao.</p>`}
            ${pendingCount ? renderPagination("customerApprovals", pendingPagination) : ""}
          </div>
        `,
      })}
    </div>
  `;

  view.querySelector("[data-go-customers-list]")?.addEventListener("click", () => goTo("customers"));
  view.querySelectorAll("[data-open-request-modal]").forEach((button) => {
    button.addEventListener("click", () => openRequestModal(button.dataset.openRequestModal));
  });
  wirePagination(view);
}

export function customerFields(customer = {}) {
  return `
    <label>
      CNPJ
      <input name="cnpj" inputmode="numeric" autocomplete="off" value="${safe(customer.cnpj || "")}" required />
      <div class="field-help-row">
        <button type="button" class="ghost" data-cnpj-lookup>Buscar CNPJ</button>
        <span class="field-help" data-cnpj-lookup-status>Aguarde o CNPJ para preencher automaticamente.</span>
      </div>
    </label>
    <label>
      Razao social
      <input name="legal_name" value="${safe(customer.legal_name || "")}" required />
    </label>
    <label>
      Nome fantasia
      <input name="trade_name" value="${safe(customer.trade_name || "")}" />
    </label>
    <label>
      Inscricao estadual
      <input name="state_registration" value="${safe(customer.state_registration || "")}" />
    </label>
    <label>
      Endereco
      <input name="address" value="${safe(customer.address || "")}" />
    </label>
    <label>
      Telefone
      <input name="phone" value="${safe(customer.phone || "")}" required />
    </label>
    <label>
      E-mail
      <input name="email" type="email" value="${safe(customer.email || "")}" />
    </label>
  `;
}

export function optionList(options, selectedValue, placeholder = "Selecione") {
  return [
    `<option value="">${safe(placeholder)}</option>`,
    ...options.map((option) => {
      if (typeof option === "string") {
        const selected = String(selectedValue || "") === option ? "selected" : "";
        return `<option value="${safe(option)}" ${selected}>${safe(option)}</option>`;
      }
      const value = String(option.value ?? option.label ?? "");
      const label = String(option.label ?? option.value ?? "");
      const selected = String(selectedValue || "") === value ? "selected" : "";
      return `<option value="${safe(value)}" ${selected}>${safe(label)}</option>`;
    }),
  ].join("");
}

export function yesNoOptions(selectedValue) {
  return optionList(
    [
      { value: "Sim", label: "Sim" },
      { value: "Nao", label: "Não" },
    ],
    selectedValue
  );
}

export function safe_json_parse(value, fallback = {}) {
  if (!value) {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function requestFormSnapshot(request = {}) {
  const payload = safe_json_parse(request.form_payload);
  return {
    representative_name: payload.representative_name || request.representative_name || request.seller_name || "",
    representative_email: payload.representative_email || request.representative_email || request.seller_email || "",
    legal_name: payload.legal_name || request.legal_name || "",
    trade_name: payload.trade_name || request.trade_name || "",
    cnpj: payload.cnpj || request.cnpj || "",
    state_registration: payload.state_registration || request.state_registration || "",
    address: payload.address || payload.street || payload.delivery_address || request.address || "",
    city: payload.city || "",
    state: payload.state || "",
    zip_code: payload.zip_code || "",
    neighborhood: payload.neighborhood || payload.bairro || payload.bairro_distrito || "",
    contact_person: payload.contact_person || payload.buyer_name || payload.finance_name || payload.logistics_name || "",
    phone_1: payload.phone_1 || payload.buyer_phone_1 || payload.finance_phone_1 || payload.logistics_phone_1 || payload.phone || request.phone || "",
    phone_2: payload.phone_2 || payload.buyer_phone_2 || payload.finance_phone_2 || payload.logistics_phone_2 || "",
    purchase_email: payload.purchase_email || payload.buyer_email || payload.email || request.email || "",
    billing_email: payload.billing_email || payload.finance_email || payload.copy_emails || "",
    xml_email: payload.xml_email || "",
    delivery_scheduled: payload.delivery_scheduled || payload.scheduling || "",
    schedule_method: payload.schedule_method || payload.scheduling_how || payload.receiving_days || "",
    delivery_warnings: payload.delivery_warnings || payload.additional_delivery_observation || payload.notes || request.notes || "",
    notes: payload.notes || request.notes || "",
  };
}

export function customerFormSnapshot(customer = {}) {
  const payload = safe_json_parse(customer.form_payload);
  return {
    representative_name: payload.representative_name || "",
    representative_email: payload.representative_email || "",
    legal_name: payload.legal_name || customer.legal_name || "",
    trade_name: payload.trade_name || customer.trade_name || "",
    cnpj: payload.cnpj || customer.cnpj || "",
    state_registration: payload.state_registration || customer.state_registration || "",
    address: payload.address || payload.street || payload.delivery_address || customer.address || "",
    city: payload.city || "",
    state: payload.state || "",
    zip_code: payload.zip_code || "",
    neighborhood: payload.neighborhood || payload.bairro || payload.bairro_distrito || "",
    contact_person: payload.contact_person || payload.buyer_name || payload.finance_name || payload.logistics_name || "",
    phone_1: payload.phone_1 || payload.buyer_phone_1 || payload.finance_phone_1 || payload.logistics_phone_1 || payload.phone || customer.phone || "",
    phone_2: payload.phone_2 || payload.buyer_phone_2 || payload.finance_phone_2 || payload.logistics_phone_2 || "",
    purchase_email: payload.purchase_email || payload.buyer_email || payload.email || customer.email || "",
    billing_email: payload.billing_email || payload.finance_email || payload.copy_emails || "",
    xml_email: payload.xml_email || "",
    delivery_scheduled: payload.delivery_scheduled || payload.scheduling || "",
    schedule_method: payload.schedule_method || payload.scheduling_how || payload.receiving_days || "",
    delivery_warnings: payload.delivery_warnings || payload.additional_delivery_observation || payload.notes || customer.notes || "",
    notes: payload.notes || customer.notes || "",
  };
}

export function registrationFormFields(values = {}, options = {}) {
  const ufOptions = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ];
  const text = (key) => safe(values[key] || "");
  const representativeLocked = Boolean(options.lockRepresentative);
  const representativeReadonly = representativeLocked ? "readonly aria-readonly=\"true\"" : "";
  const representativeRequired = options.requireRepresentative === false ? "" : "required";
  const yesNo = (value) => `
    <option value="" ${!value ? "selected" : ""}>Selecione</option>
    <option value="Sim" ${String(value || "") === "Sim" ? "selected" : ""}>Sim</option>
    <option value="Nao" ${String(value || "") === "Nao" ? "selected" : ""}>Nao</option>
  `;
  return `
    <section class="registration-section">
      <header class="registration-section-head">
        <div>
          <p class="eyebrow">Consulta inicial</p>
          <h3>Localize o cliente pelo CNPJ</h3>
        </div>
      </header>
      <div class="form-grid two">
        <label class="span-2">
          CNPJ *
          <input name="cnpj" inputmode="numeric" autocomplete="off" value="${text("cnpj")}" required />
          <div class="field-help-row">
            <button type="button" class="ghost" data-cnpj-lookup>Buscar CNPJ</button>
            <span class="field-help" data-cnpj-lookup-status>Aguarde o CNPJ para preencher automaticamente.</span>
          </div>
        </label>
      </div>
    </section>
    <section class="registration-section">
      <header class="registration-section-head">
        <div>
          <p class="eyebrow">Solicitante</p>
          <h3>Dados do representante</h3>
        </div>
      </header>
      <div class="form-grid two">
        <label class="span-2">
          Nome do representante *
          <input name="representative_name" value="${text("representative_name")}" ${representativeReadonly} ${representativeRequired} />
        </label>
        <label class="span-2">
          E-mail do representante *
          <input name="representative_email" type="email" value="${text("representative_email")}" ${representativeReadonly} ${representativeRequired} />
          ${representativeLocked ? `<span class="field-help">Preenchido automaticamente pelo cadastro do usuário.</span>` : ""}
        </label>
      </div>
    </section>
    <section class="registration-section">
      <header class="registration-section-head">
        <div>
          <p class="eyebrow">Dados básicos</p>
          <h3>Cadastro do cliente</h3>
        </div>
      </header>
      <div class="form-grid two">
        <label class="span-2">
          Razão social *
          <input name="legal_name" value="${text("legal_name")}" required />
        </label>
        <label class="span-2">
          Nome fantasia / fachada estabelecimento
          <input name="trade_name" value="${text("trade_name")}" />
        </label>
        <label>
          Insc. estadual
          <input name="state_registration" value="${text("state_registration")}" />
        </label>
        <label class="span-2">
          Endereço
          <input name="address" value="${text("address")}" />
        </label>
        <label>
          Bairro
          <input name="neighborhood" value="${text("neighborhood")}" />
        </label>
        <label>
          Cidade
          <input name="city" value="${text("city")}" />
        </label>
        <label>
          UF
          <select name="state">${optionList(ufOptions, values.state, "Selecione UF")}</select>
        </label>
        <label>
          CEP
          <input name="zip_code" value="${text("zip_code")}" />
        </label>
      </div>
    </section>
    <section class="registration-section">
      <header class="registration-section-head">
        <div>
          <p class="eyebrow">Contatos</p>
          <h3>Pessoas e e-mails do cliente</h3>
        </div>
      </header>
      <div class="form-grid two">
        <label class="span-2">
          Pessoa de contato *
          <input name="contact_person" value="${text("contact_person")}" required />
        </label>
        <label>
          Telefone 1 *
          <input name="phone_1" value="${text("phone_1")}" required />
        </label>
        <label>
          Telefone 2
          <input name="phone_2" value="${text("phone_2")}" />
        </label>
        <label class="span-2">
          E-mail compras *
          <input name="purchase_email" type="email" value="${text("purchase_email")}" required />
        </label>
        <label class="span-2">
          E-mail boletos
          <input name="billing_email" type="email" value="${text("billing_email")}" />
        </label>
        <label class="span-2">
          E-mail XML
          <input name="xml_email" type="email" value="${text("xml_email")}" />
        </label>
      </div>
    </section>
    <section class="registration-section">
      <header class="registration-section-head">
        <div>
          <p class="eyebrow">Entrega</p>
          <h3>Condições de recebimento</h3>
        </div>
      </header>
      <div class="form-grid two">
        <label class="span-2">
          Entrega agendada
          <select name="delivery_scheduled">${yesNo(values.delivery_scheduled)}</select>
        </label>
        <label class="span-2">
          Como agendar
          <input name="schedule_method" value="${text("schedule_method")}" />
        </label>
        <label class="span-2">
          Advertências para recebimento
          <textarea name="delivery_warnings">${text("delivery_warnings")}</textarea>
        </label>
      </div>
    </section>
  `;
}

export function renderCustomerRequest(view) {
  const userEmail = state.user?.communication_email || (String(state.user?.email || "").includes("@") ? state.user.email : "");
  const defaults = {
    representative_name: state.user?.name || "",
    representative_email: userEmail,
  };
  view.innerHTML = `
    <section class="section-band span-12">
      <header class="section-head">
        <div>
          <p class="eyebrow">Clientes</p>
          <h2>Solicitar cadastro de cliente</h2>
        </div>
      </header>
      <div class="section-body">
        <form class="registration-form" id="customerRequestForm">
          ${registrationFormFields(defaults, { lockRepresentative: true })}
          <div class="form-actions span-2">
            <button type="submit">Solicitar cadastro</button>
          </div>
        </form>
      </div>
    </section>
  `;

  document.querySelector("#customerRequestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/customer-requests", {
        method: "POST",
        body: JSON.stringify(formData(event.target)),
      });
      event.target.reset();
      setFlash(result.message);
    } catch (error) {
      setFlash("", error.message);
    }
  });

  wireCustomerAutofill(document.querySelector("#customerRequestForm"));
}
