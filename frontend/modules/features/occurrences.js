import {
  api,
  fileToAttachment,
  formData,
  loadCommonData,
  loadOccurrencesData,
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
  dateInputValue,
  datetime,
  isAdmin,
  normalizeText,
  renderPagination,
  safe,
  searchActionField,
  sectionBand,
  uiIcons,
  wirePagination,
  wireSearchSubmit,
} from "../core/ui.js";

export function occurrenceStatusLabel(status) {
  const normalized = normalizeOccurrenceStatus(status);
  const labels = {
    aberta: "Aberta",
    em_analise: "Em análise",
    recusada: "Recusada",
    solucionada: "Solucionada",
  };
  return labels[normalized] || "Aberta";
}

export function normalizeOccurrenceStatus(status) {
  const value = String(status || "").trim();
  if (value === "tratada" || value === "encerrada" || value === "solucionado") return "solucionada";
  if (value === "em_tratamento") return "em_analise";
  if (["aberta", "em_analise", "recusada", "solucionada"].includes(value)) return value;
  return "aberta";
}

export function occurrenceStatusOptions(selected = "") {
  const current = normalizeOccurrenceStatus(selected);
  const options = [
    ["aberta", "Aberta"],
    ["em_analise", "Em análise"],
    ["recusada", "Recusada"],
    ["solucionada", "Solucionada"],
  ];
  return options.map(([value, label]) => `<option value="${safe(value)}" ${current === value ? "selected" : ""}>${safe(label)}</option>`).join("");
}

export function occurrenceStatusTone(status) {
  const normalized = normalizeOccurrenceStatus(status);
  if (normalized === "solucionada") return "ok";
  if (normalized === "recusada") return "danger";
  if (normalized === "em_analise") return "warn";
  return "brand";
}

export function occurrenceAttachmentIcon(attachment = {}) {
  const mime = String(attachment.mimetype || "").toLowerCase();
  const filename = String(attachment.filename || "").toLowerCase();
  if (mime.includes("pdf") || filename.endsWith(".pdf")) return uiIcons.pdf;
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(filename)) return uiIcons.image;
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|avi)$/i.test(filename)) return uiIcons.video;
  if (mime.startsWith("audio/") || /\.(mp3|ogg|wav|m4a)$/i.test(filename)) return uiIcons.music;
  return uiIcons.file;
}

export function getOccurrenceById(occurrenceId) {
  return (state.admin.occurrences || []).find((occurrence) => String(occurrence.id) === String(occurrenceId)) ||
    (state.occurrences || []).find((occurrence) => String(occurrence.id) === String(occurrenceId)) ||
    null;
}

export function openOccurrenceTimelineModal(occurrenceId) {
  state.activeOccurrenceTimelineId = String(occurrenceId);
  render();
}

export function closeOccurrenceTimelineModal() {
  state.activeOccurrenceTimelineId = null;
  render();
}

export function openOccurrencePdf(occurrenceId) {
  window.open(`/api/admin/occurrences/${encodeURIComponent(occurrenceId)}/pdf`, "_blank", "noopener");
}

export const occurrenceReasons = [
  "PRODUTO AVARIADO",
  "DIVERGÊNCIA DE PRODUTO",
  "FALTA DE PRODUTO NO PEDIDO",
  "DIVERGÊNCIA DE PREÇOS",
  "PROBLEMAS COM A NOTA FISCAL",
  "PROBLEMAS COM BOLETO",
  "PAGAMENTO DE VERBAS",
  "DESCONTOS NÃO CONCEDIDOS",
  "DEVOLUÇÃO DE MERCADORIA",
  "ATRASO NA ENTREGA",
  "CANCELAMENTO DE PEDIDO",
  "OUTROS",
];

export function occurrenceReasonOptions(selected = "") {
  return occurrenceReasons.map((reason) => `<option value="${safe(reason)}" ${selected === reason ? "selected" : ""}>${safe(reason)}</option>`).join("");
}

export function occurrenceReasonFilterOptions(selected = "all") {
  return `<option value="all" ${selected === "all" ? "selected" : ""}>Todos</option>${occurrenceReasonOptions(selected)}`;
}

export function renderOccurrenceCustomerCard(customer) {
  if (!customer) {
    return `<p class="empty-state compact">Selecione um cliente para conferir os dados cadastrais.</p>`;
  }
  return `
    <article class="proposal-customer-card occurrence-customer-card">
      <div class="proposal-customer-copy">
        <p class="eyebrow">Cliente selecionado</p>
        <h3>${safe(customer.legal_name || "Cliente")}</h3>
        <p>${safe(customer.trade_name || "Sem nome fantasia")} | ${safe(customer.cnpj || "")}</p>
      </div>
      <div class="proposal-customer-meta">
        <span><strong>IE</strong>${safe(customer.state_registration || "Nao informada")}</span>
        <span><strong>Telefone</strong>${safe(customer.phone || "Nao informado")}</span>
        <span><strong>E-mail</strong>${safe(customer.email || "Nao informado")}</span>
        <span><strong>Endereco</strong>${safe(customer.address || "Nao informado")}</span>
      </div>
    </article>
  `;
}

export function renderOccurrenceCard(occurrence, adminMode = false) {
  const attachmentNames = Array.isArray(occurrence.attachment_names) ? occurrence.attachment_names : [];
  const attachments = Array.isArray(occurrence.attachments) ? occurrence.attachments : [];
  const attachmentLinks = attachments.length
    ? attachments.map((attachment) => `
        <a href="/api/occurrences/${encodeURIComponent(occurrence.id)}/attachments/${encodeURIComponent(attachment.id)}" target="_blank" rel="noopener" class="occurrence-attachment-link" title="${safe(attachment.filename || "Anexo")}">
          ${occurrenceAttachmentIcon(attachment)}
          <span>${safe(attachment.filename || "Anexo")}</span>
        </a>
      `).join("")
    : "";
  const attachmentContent = attachmentLinks
    ? `<div class="occurrence-attachment-list">${attachmentLinks}</div>`
    : `<strong>${safe(occurrence.attachments_expired ? "Anexos removidos apos 30 dias da solucao" : attachmentNames.length ? attachmentNames.join(", ") : "Sem anexos")}</strong>`;

  if (adminMode) {
    const status = normalizeOccurrenceStatus(occurrence.status);
    return `
      <article class="occurrence-monitor-card">
        <form class="occurrence-monitor-form" data-occurrence-form="${safe(occurrence.id)}">
          <aside class="occurrence-register-panel">
            <h3>Registro de Ocorrência</h3>
            <div class="occurrence-readonly-box ro-number">R.O. #${safe(occurrence.id)}</div>
            <div class="occurrence-readonly-box">
              <span>Criada em</span>
              <strong>${safe(datetime(occurrence.created_at))}</strong>
            </div>
            <div class="occurrence-readonly-box occurrence-attachments-panel">
              <span>Anexos <small>Visualize ou baixe os arquivos</small></span>
              ${attachmentContent}
            </div>
            <div class="occurrence-card-actions">
              <button type="button" class="secondary danger-soft icon-text-btn" data-occurrence-pdf="${safe(occurrence.id)}">${uiIcons.pdf}<span>Abrir PDF</span></button>
              <button type="button" class="secondary icon-text-btn timeline" data-occurrence-timeline="${safe(occurrence.id)}">${uiIcons.timeline}<span>Linha do tempo</span></button>
            </div>
          </aside>

          <div class="occurrence-detail-panel">
            <label>
              <span>Motivo da Ocorrência</span>
              <input value="${safe(occurrence.reason || "-")}" readonly />
            </label>
            <label class="occurrence-client-field">
              <span>Cliente</span>
              <input value="${safe(`${occurrence.customer_name || "Cliente"}${occurrence.customer_cnpj ? ` | ${occurrence.customer_cnpj}` : ""}`)}" readonly />
            </label>
            <label>
              <span>Representante Comercial</span>
              <input value="${safe(occurrence.seller_name || "-")}" readonly />
            </label>
            <label class="span-full">
              <span>Relato</span>
              <textarea readonly>${safe(occurrence.description || "-")}</textarea>
            </label>
            <label>
              <span>Status da Ocorrência</span>
              <select name="status" class="occurrence-status-select ${safe(occurrenceStatusTone(status))}">
                ${occurrenceStatusOptions(status)}
              </select>
            </label>
            <label>
              <span>Data da Resolução</span>
              <input name="resolved_at" type="date" value="${safe(dateInputValue(occurrence.resolved_at))}" />
            </label>
            <label class="occurrence-resolution-field">
              <span>Parecer sobre a ocorrência <small>Aqui ficará escrito qual foi a ação tomada para a resolução da ocorrência</small></span>
              <textarea name="resolution">${safe(occurrence.resolution || "")}</textarea>
            </label>
            <div class="occurrence-admin-actions span-full">
              <button type="submit" class="success-soft icon-text-btn">${uiIcons.edit}<span>Salvar</span></button>
              <button type="button" class="danger ghost icon-text-btn" data-occurrence-delete="${safe(occurrence.id)}">${uiIcons.trash}<span>Excluir</span></button>
            </div>
          </div>
        </form>
      </article>
    `;
  }

  return `
    <article class="occurrence-card">
      <header class="occurrence-card-head">
        <div>
          <span class="badge brand">R.O. #${safe(occurrence.id)}</span>
          <h3>${safe(occurrence.reason)}</h3>
          <p>${safe(occurrence.customer_name || "Cliente")} ${occurrence.customer_cnpj ? `| ${safe(occurrence.customer_cnpj)}` : ""}</p>
        </div>
        <span class="badge ${safe(occurrenceStatusTone(occurrence.status))}">${safe(occurrenceStatusLabel(occurrence.status))}</span>
      </header>
      <div class="occurrence-card-grid">
        <div><span>Representante comercial</span><strong>${safe(occurrence.seller_name || "-")}</strong></div>
        <div><span>E-mail</span><strong>${safe(occurrence.seller_email || "-")}</strong></div>
        <div><span>Criada em</span><strong>${safe(datetime(occurrence.created_at))}</strong></div>
        <div class="occurrence-attachments"><span>Anexos enviados</span>${attachmentContent}</div>
      </div>
      <div class="occurrence-text">
        <strong>Relato</strong>
        <p>${safe(occurrence.description || "-")}</p>
      </div>
      ${
        adminMode
          ? ""
          : occurrence.resolution
            ? `<div class="occurrence-text occurrence-resolution"><strong>Parecer</strong><p>${safe(occurrence.resolution)}</p></div>`
            : ""
      }
    </article>
  `;
}

export function renderOccurrences(view) {
  const adminMode = isAdmin();
  const customers = (adminMode ? state.admin.customers : state.common.customers).filter((customer) => customer.active !== false && customer.active !== 0);
  const customerSearch = normalizeText(state.occurrenceCustomerSearch);
  const visibleCustomers = customers.filter((customer) => {
    if (!customerSearch) return true;
    return normalizeText([customer.legal_name, customer.trade_name, customer.cnpj].join(" ")).includes(customerSearch);
  });
  const selectedCustomer = customers.find((customer) => String(customer.id) === String(state.occurrenceCustomerId)) || null;
  const occurrenceSearch = normalizeText(state.admin.occurrenceSearch || "");
  const occurrenceStatusFilter = String(state.admin.occurrenceStatusFilter || "all");
  const occurrenceReasonFilter = String(state.admin.occurrenceReasonFilter || "all");
  const occurrenceSellerFilter = String(state.admin.occurrenceSellerFilter || "");
  const occurrenceDateFrom = String(state.admin.occurrenceDateFrom || "");
  const occurrenceDateTo = String(state.admin.occurrenceDateTo || "");
  const adminSellers = (state.admin.users || []).filter((user) => user.role === "seller");
  const occurrences = (adminMode ? state.admin.occurrences : state.occurrences).filter((occurrence) => {
    if (adminMode) {
      if (occurrenceSellerFilter && String(occurrence.seller_id) !== occurrenceSellerFilter) return false;
      if (occurrenceStatusFilter !== "all" && normalizeOccurrenceStatus(occurrence.status) !== occurrenceStatusFilter) return false;
      if (occurrenceReasonFilter !== "all" && String(occurrence.reason || "") !== occurrenceReasonFilter) return false;
      if (occurrenceDateFrom && dateInputValue(occurrence.created_at) < occurrenceDateFrom) return false;
      if (occurrenceDateTo && dateInputValue(occurrence.created_at) > occurrenceDateTo) return false;
    }
    if (!occurrenceSearch) return true;
    return normalizeText([occurrence.customer_name, occurrence.customer_trade_name, occurrence.customer_cnpj, occurrence.seller_name, occurrence.reason, occurrence.status].join(" ")).includes(occurrenceSearch);
  });
  const pagination = paginateItems(adminMode ? "adminOccurrences" : "sellerOccurrences", occurrences);

  view.innerHTML = `
    <div class="admin-grid">
      ${
        adminMode
          ? ""
          : sectionBand({
              id: "newOccurrence",
              span: "span-12",
              eyebrow: "R.O.",
              title: "Nova ocorrência",
              body: `
                <form class="occurrence-form" id="occurrenceForm">
                  <section class="seller-order-card">
                    <div class="seller-order-card-head">
                      <span class="step-badge">1</span>
                      <h3>Solicitante</h3>
                    </div>
                    <div class="seller-order-grid">
                      <label>
                        Nome do representante
                        <input value="${safe(state.user?.name || "")}" readonly />
                      </label>
                      <label>
                        E-mail do representante
                        <input value="${safe(state.user?.communication_email || state.user?.email || "")}" readonly />
                      </label>
                    </div>
                  </section>
                  <section class="seller-order-card">
                    <div class="seller-order-card-head">
                      <span class="step-badge">2</span>
                      <h3>Cliente</h3>
                    </div>
                    <div class="seller-order-grid">
                      <label class="span-2">
                        Buscar cliente
                        ${searchActionField(`<input type="search" data-occurrence-customer-search placeholder="Razao social, fantasia ou CNPJ" value="${safe(state.occurrenceCustomerSearch || "")}" />`, "Filtrar")}
                      </label>
                      <label class="span-2">
                        Cliente
                        <select name="customer_id" data-occurrence-customer-select required>
                          <option value="">Selecione</option>
                          ${visibleCustomers.map((customer) => `<option value="${safe(customer.id)}" ${String(customer.id) === String(state.occurrenceCustomerId) ? "selected" : ""}>${safe(customer.legal_name)} - ${safe(customer.trade_name || "Sem fantasia")} - ${safe(customer.cnpj || "")}</option>`).join("")}
                        </select>
                      </label>
                    </div>
                    <div class="proposal-customer-preview">${renderOccurrenceCustomerCard(selectedCustomer)}</div>
                  </section>
                  <section class="seller-order-card">
                    <div class="seller-order-card-head">
                      <span class="step-badge">3</span>
                      <h3>Ocorrência</h3>
                    </div>
                    <div class="seller-order-grid">
                      <label class="span-2">
                        Motivo da ocorrência
                        <select name="reason" required>${occurrenceReasonOptions()}</select>
                      </label>
                      <label class="span-2">
                        Relate o ocorrido
                        <textarea name="description" required placeholder="Descreva com clareza o que aconteceu, produto, pedido, nota fiscal ou contexto necessário."></textarea>
                      </label>
                      <label class="span-2">
                        Anexar arquivos
                        <input type="file" name="attachments" multiple />
                        <span class="field-help">Fotos, videos e documentos ficam disponíveis no monitor e são removidos 30 dias após a ocorrência ser solucionada.</span>
                      </label>
                    </div>
                  </section>
                  <div class="form-actions">
                    <button type="submit" class="icon-text-btn">${uiIcons.check}<span>Registrar ocorrência</span></button>
                  </div>
                </form>
              `,
            })
      }
      ${sectionBand({
        id: "occurrencesList",
        span: "span-12",
        eyebrow: "Ocorrencias",
        title: adminMode ? "Monitor de ocorrências" : "Consultar ocorrências",
        body: `
          ${
            adminMode
              ? `<div class="occurrence-monitor-filters">
                  <label>
                    Representante comercial
                    <select data-occurrence-seller-filter>
                      <option value="">Todos</option>
                      ${adminSellers.map((seller) => `<option value="${safe(seller.id)}" ${occurrenceSellerFilter === String(seller.id) ? "selected" : ""}>${safe(seller.name)}</option>`).join("")}
                    </select>
                  </label>
                  <label>
                    Status
                    <select data-occurrence-status-filter>
                      <option value="all" ${occurrenceStatusFilter === "all" ? "selected" : ""}>Todos</option>
                      ${occurrenceStatusOptions(occurrenceStatusFilter)}
                    </select>
                  </label>
                  <label>
                    Motivo
                    <select data-occurrence-reason-filter>
                      ${occurrenceReasonFilterOptions(occurrenceReasonFilter)}
                    </select>
                  </label>
                  <label>
                    Buscar Cliente
                    ${searchActionField(`<input type="search" data-occurrence-search placeholder="Razao social, fantasia" value="${safe(state.admin.occurrenceSearch || "")}" />`)}
                  </label>
                  <label>
                    De
                    <input type="date" data-occurrence-date-from value="${safe(occurrenceDateFrom)}" />
                  </label>
                  <label>
                    Ate
                    <input type="date" data-occurrence-date-to value="${safe(occurrenceDateTo)}" />
                  </label>
                </div>`
              : `<p class="lead">Acompanhe o andamento das ocorrências registradas por você.</p>`
          }
          <div class="occurrence-list">
            ${pagination.items.length ? pagination.items.map((occurrence) => renderOccurrenceCard(occurrence, adminMode)).join("") : `<p class="empty-state">Nenhuma ocorrência encontrada.</p>`}
          </div>
          ${renderPagination(adminMode ? "adminOccurrences" : "sellerOccurrences", pagination)}
        `,
      })}
    </div>
  `;

  wireOccurrences(view, adminMode);
}

export function wireOccurrences(view, adminMode) {
  wirePagination(view);
  if (adminMode) {
    wireSearchSubmit(view, "[data-occurrence-search]", (value) => {
      state.admin.occurrenceSearch = value;
      resetPage("adminOccurrences");
      render();
    });
    view.querySelector("[data-occurrence-seller-filter]")?.addEventListener("change", (event) => {
      state.admin.occurrenceSellerFilter = event.target.value || "";
      resetPage("adminOccurrences");
      render();
    });
    view.querySelector("[data-occurrence-status-filter]")?.addEventListener("change", (event) => {
      state.admin.occurrenceStatusFilter = event.target.value || "all";
      resetPage("adminOccurrences");
      render();
    });
    view.querySelector("[data-occurrence-reason-filter]")?.addEventListener("change", (event) => {
      state.admin.occurrenceReasonFilter = event.target.value || "all";
      resetPage("adminOccurrences");
      render();
    });
    view.querySelector("[data-occurrence-date-from]")?.addEventListener("change", (event) => {
      state.admin.occurrenceDateFrom = event.target.value || "";
      resetPage("adminOccurrences");
      render();
    });
    view.querySelector("[data-occurrence-date-to]")?.addEventListener("change", (event) => {
      state.admin.occurrenceDateTo = event.target.value || "";
      resetPage("adminOccurrences");
      render();
    });
    view.querySelectorAll("[data-occurrence-form]").forEach((form) => {
      form.addEventListener("submit", submitOccurrenceResolution);
    });
    view.querySelectorAll("[data-occurrence-pdf]").forEach((button) => {
      button.addEventListener("click", () => openOccurrencePdf(button.dataset.occurrencePdf));
    });
    view.querySelectorAll("[data-occurrence-timeline]").forEach((button) => {
      button.addEventListener("click", () => openOccurrenceTimelineModal(button.dataset.occurrenceTimeline));
    });
    view.querySelectorAll("[data-occurrence-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteOccurrence(button.dataset.occurrenceDelete));
    });
    return;
  }

  wireSearchSubmit(view, "[data-occurrence-customer-search]", (value) => {
    state.occurrenceCustomerSearch = value;
    state.occurrenceCustomerId = "";
    resetPage("sellerOccurrences");
    render();
  });
  view.querySelector("[data-occurrence-customer-select]")?.addEventListener("change", (event) => {
    state.occurrenceCustomerId = event.target.value || "";
    render();
  });
  view.querySelector("#occurrenceForm")?.addEventListener("submit", submitOccurrence);
}

export async function submitOccurrence(event) {
  event.preventDefault();
  const form = event.target;
  const files = Array.from(form.querySelector("input[type='file']")?.files || []);
  try {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      throw new Error("Os anexos ultrapassam 25 MB. Envie arquivos menores.");
    }
    const payload = formData(form);
    payload.attachments = await Promise.all(files.map(fileToAttachment));
    const result = await api("/api/occurrences", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.occurrenceCustomerId = "";
    state.occurrenceCustomerSearch = "";
    await Promise.all([loadCommonData(), loadOccurrencesData()]);
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function submitOccurrenceResolution(event) {
  event.preventDefault();
  const form = event.target;
  const occurrenceId = form.dataset.occurrenceForm;
  try {
    const result = await api(`/api/admin/occurrences/${encodeURIComponent(occurrenceId)}`, {
      method: "PATCH",
      body: JSON.stringify(formData(form)),
    });
    await loadRouteData("occurrences");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}

export async function deleteOccurrence(occurrenceId) {
  const occurrence = getOccurrenceById(occurrenceId);
  const confirmed = window.confirm(`Excluir definitivamente a ocorrência R.O. #${occurrence?.id || occurrenceId}? Essa ação não pode ser desfeita.`);
  if (!confirmed) return;
  try {
    const result = await api(`/api/admin/occurrences/${encodeURIComponent(occurrenceId)}`, {
      method: "DELETE",
    });
    await loadRouteData("occurrences");
    setFlash(result.message);
  } catch (error) {
    setFlash("", error.message);
  }
}
