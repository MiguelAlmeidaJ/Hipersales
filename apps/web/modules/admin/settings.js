import {
  openRequestModal,
} from "./catalog.js";

import {
  closeUserModal,
} from "./modals.js";

import {
  closeOrderModal,
} from "./orders.js";

import {
  api,
  boot,
  goToCustomersApprovals,
  loadRouteData,
  setFlash,
} from "../core/api.js";

import {
  render,
} from "../core/shell.js";

import { state} from "../core/state.js";

import {
  defaultAdminSettings,
  defaultPlaceholders,
  editPercentValue,
  formatPercentValue,
  isAdmin,
  orderStatusSettings,
  parseCurrencyValue,
  proposalStatusBadge,
  readableTextColor,
  safe,
  sectionBand,
  softStatusColor,
  statusInfo,
  syncCurrencyInput,
} from "../core/ui.js";

import {
  closeOccurrenceTimelineModal,
} from "../features/occurrences.js";

export let whatsappSettingsRefreshTimer = null;

export function clearWhatsAppSettingsRefresh() {
  if (whatsappSettingsRefreshTimer) {
    window.clearTimeout(whatsappSettingsRefreshTimer);
    whatsappSettingsRefreshTimer = null;
  }
}

export function sanitizeHexColor(value, fallback = "#0D6FD8") {
  const color = String(value ?? fallback).trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
}

export function normalizeTemplateEntry(templateValue, fallback = { subject: "", body: "" }) {
  const base = {
    subject: String(fallback.subject || "").trim(),
    body: String(fallback.body || "").trim(),
  };
  if (typeof templateValue === "string") {
    return {
      subject: base.subject,
      body: templateValue.trim() || base.body,
    };
  }
  if (templateValue && typeof templateValue === "object") {
    return {
      subject: String(templateValue.subject ?? base.subject).trim() || base.subject,
      body: String(templateValue.body ?? base.body).trim() || base.body,
    };
  }
  return base;
}

export function normalizeTemplateGroup(group, fallbackGroup, legacyGroup = {}) {
  const safeGroup = group && typeof group === "object" ? group : {};
  return {
    order_status_changed: normalizeTemplateEntry(
      safeGroup.order_status_changed ?? safeGroup.order_status ?? legacyGroup.order_status_changed ?? legacyGroup.order_status,
      fallbackGroup.order_status_changed
    ),
    customer_approved: normalizeTemplateEntry(
      safeGroup.customer_approved ?? safeGroup.order_approved ?? legacyGroup.customer_approved ?? legacyGroup.order_approved,
      fallbackGroup.customer_approved
    ),
  };
}

export function looksLikeHtmlTemplate(value) {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("<!doctype") || text.startsWith("<html") || text.includes("<table") || text.includes("<body");
}

export function buildEmailPreviewDoc(template) {
  const html = String(template || "");
  const logoMarkup = '<img src="/assets/logoweb.png" alt="Hipersales" style="width:190px;max-width:100%;height:auto;display:block;margin:0 auto;" />';
  const resolved = html.replace(/\{\{\s*logo_email\s*\}\}/g, logoMarkup);
  if (looksLikeHtmlTemplate(resolved)) {
    return resolved;
  }
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#eef4fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#102035;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #d9e3ef;border-radius:16px;padding:28px;">
      ${logoMarkup}
      <div style="margin-top:18px;white-space:pre-line;line-height:1.7;color:#617287;">${safe(resolved)}</div>
    </div>
  </body>
</html>`;
}

export function adminSettingsSnapshot() {
  const settings = state.admin.settings || defaultAdminSettings;
  const templates = settings.message_templates || {};
  const legacyTemplates = {
    order_status: templates.order_status ?? templates.order_status_changed ?? {},
    order_approved: templates.order_approved ?? templates.customer_approved ?? {},
  };
  return {
    customer_funnel: Array.isArray(settings.customer_funnel) && settings.customer_funnel.length
      ? settings.customer_funnel
      : defaultAdminSettings.customer_funnel,
    product_funnel: Array.isArray(settings.product_funnel) && settings.product_funnel.length
      ? settings.product_funnel
      : defaultAdminSettings.product_funnel,
    order_statuses: Array.isArray(settings.order_statuses) && settings.order_statuses.length
      ? orderStatusSettings()
      : defaultAdminSettings.order_statuses,
    smtp: {
      ...defaultAdminSettings.smtp,
      ...(settings.smtp || {}),
    },
    whatsapp: {
      ...defaultAdminSettings.whatsapp,
      ...(settings.whatsapp || {}),
    },
    message_templates: {
      email: normalizeTemplateGroup(templates.email, defaultAdminSettings.message_templates.email, legacyTemplates),
      whatsapp: normalizeTemplateGroup(templates.whatsapp, defaultAdminSettings.message_templates.whatsapp, legacyTemplates),
    },
  };
}

export function renderFunnelRow(stage, index, total) {
  const color = sanitizeHexColor(stage.color);
  return `
    <div class="funnel-row" data-stage-row style="--stage-color:${color}">
      <span class="funnel-index">${index + 1}</span>
      <label class="funnel-field">
        <span>Etapa</span>
        <input data-stage-name type="text" value="${safe(stage.name || "")}" placeholder="Nome da etapa" required />
      </label>
      <label class="funnel-field color">
        <span>Cor</span>
        <input data-stage-color type="color" value="${safe(color)}" />
      </label>
      <button type="button" class="ghost danger" data-remove-stage ${total <= 1 ? "disabled" : ""}>Remover</button>
    </div>
  `;
}

export function renderFunnelRows(sectionKey, stages) {
  const list = Array.isArray(stages) && stages.length ? stages : defaultAdminSettings[sectionKey] || [];
  return `
    <div class="funnel-list" data-funnel-list="${safe(sectionKey)}">
      ${list.map((stage, index) => renderFunnelRow(stage, index, list.length)).join("")}
    </div>
  `;
}

export function renderOrderStatusModal(statuses) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : orderStatusSettings();
  return renderSettingsModalShell({
    modalKey: "orderStatusesModal",
    eyebrow: "Pedidos",
    title: "Cores dos status",
    body: `
      <form class="settings-modal-form" id="orderStatusesForm" data-section="order_statuses">
        <div class="funnel-list order-status-config">
          ${list
            .map((status, index) => {
              const meta = statusInfo(status.key);
              const color = sanitizeHexColor(status.color || meta.color);
              return `
                <div class="funnel-row" data-order-status-row data-status-key="${safe(status.key)}" style="--stage-color:${safe(color)}">
                  <span class="funnel-index">${index + 1}</span>
                  <label class="funnel-field">
                    <span>Status</span>
                    <input data-status-name type="text" value="${safe(meta.name)}" readonly />
                  </label>
                  <label class="funnel-field color">
                    <span>Cor</span>
                    <input data-status-color type="color" value="${safe(color)}" />
                  </label>
                  ${proposalStatusBadge(status.key)}
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="modal-footer split">
          <button type="button" class="ghost" data-reset-order-statuses>Restaurar padrao</button>
          <div class="modal-actions-group">
            <button type="button" class="secondary" data-close-settings-modal>Fechar</button>
            <button type="submit">Salvar cores</button>
          </div>
        </div>
      </form>
    `,
  });
}

export function renderTemplateCard(channel, key, title, template, eyebrow, active = false) {
  const fallback = defaultAdminSettings.message_templates[channel]?.[key] || { subject: "", body: "" };
  const current = normalizeTemplateEntry(template, fallback);
  const isEmail = channel === "email";
  const bodyValue = isEmail && !looksLikeHtmlTemplate(current.body) ? fallback.body : current.body;
  const editorLabel = isEmail ? "Corpo do e-mail (HTML)" : "Mensagem";
  const preview = isEmail
    ? `
      <div class="email-preview-shell">
        <div class="email-preview-head">
          <strong>Previa</strong>
          <span>Renderizacao do HTML</span>
        </div>
        <iframe
          class="email-preview"
          data-email-preview
          data-preview-target="${safe(`${channel}_${key}`)}"
          title="Previa do e-mail"
          sandbox="allow-same-origin"
        ></iframe>
      </div>
    `
    : "";
  return `
    <article
      class="template-card ${isEmail ? "email-template-card" : ""}"
      data-template-card="${safe(`${channel}_${key}`)}"
      data-template-channel="${safe(channel)}"
      data-template-key="${safe(key)}"
      data-active-template="${active ? "true" : "false"}"
    >
      <div class="template-card-head">
        <div>
          <p class="eyebrow">${safe(eyebrow)}</p>
          <h3>${safe(title)}</h3>
        </div>
        ${isEmail ? '<span class="template-badge">HTML</span>' : ""}
      </div>
      <label>
        Assunto
        <input type="text" name="${safe(`${channel}_${key}_subject`)}" value="${safe(current.subject || "")}" />
      </label>
      <label>
        ${safe(editorLabel)}
        <textarea class="${isEmail ? "email-template-editor" : ""}" name="${safe(`${channel}_${key}_body`)}" data-template-body rows="${isEmail ? "18" : "10"}">${safe(bodyValue || "")}</textarea>
      </label>
      ${preview}
    </article>
  `;
}

export function renderPlaceholderToolbar(placeholders) {
  return `
    <div class="placeholder-toolbar">
      ${placeholders
        .map(
          (placeholder) => `
            <button
              type="button"
              class="placeholder-chip"
              data-placeholder-token="${safe(placeholder.token)}"
              aria-label="Inserir ${safe(placeholder.token)}"
            >
              <strong>${safe(placeholder.label)}</strong>
              <span>${safe(placeholder.token)}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

export function readFormValues(form) {
  const result = {};
  Array.from(form.elements).forEach((element) => {
    if (!element.name || element.disabled) {
      return;
    }
    if (element.type === "checkbox") {
      result[element.name] = element.checked;
      return;
    }
    if (element.type === "radio") {
      if (element.checked) {
        result[element.name] = element.value;
      }
      return;
    }
    result[element.name] = element.value;
  });
  return result;
}

document.addEventListener(
  "focusin",
  (event) => {
    const input = event.target.closest?.("[data-percent-input]");
    if (!input) return;
    input.value = editPercentValue(input.value);
  },
  true
);

document.addEventListener(
  "focusout",
  (event) => {
    const input = event.target.closest?.("[data-percent-input]");
    if (!input) return;
    input.value = formatPercentValue(input.value);
  },
  true
);

document.addEventListener(
  "focusin",
  (event) => {
    const input = event.target.closest?.("[data-currency-input]");
    if (!input) return;
    if (!input.dataset.currencyRaw) {
      const numeric = Math.max(0, Math.round(parseCurrencyValue(input.value) * 100));
      input.dataset.currencyRaw = String(numeric);
    }
    syncCurrencyInput(input);
  },
  true
);

document.addEventListener(
  "beforeinput",
  (event) => {
    const input = event.target.closest?.("[data-currency-input]");
    if (!input) return;
    event.preventDefault();

    let raw = String(input.dataset.currencyRaw || "").replace(/\D/g, "");
    if (!raw) raw = "0";

    if (event.inputType === "deleteContentBackward" || event.inputType === "deleteContentForward") {
      raw = raw.length > 1 ? raw.slice(0, -1) : "0";
    } else if (event.inputType === "insertFromPaste") {
      const pasted = String(event.dataTransfer?.getData("text") || event.data || "").replace(/\D/g, "");
      if (pasted) {
        raw = pasted;
      }
    } else {
      const inserted = String(event.data || "").replace(/\D/g, "");
      if (inserted) {
        raw = raw === "0" ? inserted : `${raw}${inserted}`;
      }
    }

    input.dataset.currencyRaw = raw || "0";
    syncCurrencyInput(input);
  },
  true
);

document.addEventListener(
  "focusout",
  (event) => {
    const input = event.target.closest?.("[data-currency-input]");
    if (!input) return;
    if (!input.dataset.currencyRaw) {
      input.dataset.currencyRaw = String(Math.max(0, Math.round(parseCurrencyValue(input.value) * 100)));
    }
    syncCurrencyInput(input);
  },
  true
);

export function collectFunnelData(form) {
  return Array.from(form.querySelectorAll("[data-stage-row]"))
    .map((row) => {
      const nameField = row.querySelector("[data-stage-name]");
      const colorField = row.querySelector("[data-stage-color]");
      return {
        name: String(nameField?.value || "").trim(),
        color: sanitizeHexColor(colorField?.value),
      };
    })
    .filter((stage) => stage.name);
}

export function collectOrderStatusData(form) {
  return Array.from(form.querySelectorAll("[data-order-status-row]")).map((row) => {
    const key = row.dataset.statusKey;
    const meta = statusInfo(key);
    const colorField = row.querySelector("[data-status-color]");
    return {
      key,
      name: meta.name,
      color: sanitizeHexColor(colorField?.value || meta.color),
    };
  });
}

export async function saveAdminSettingsSection(section, data, options = {}) {
  const result = await api("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ section, data }),
  });
  await loadRouteData("admin");
  if (options.closeModal) {
    state.admin.activeSettingsModal = null;
  }
  setFlash(result.message);
}

export function openSettingsModal(modalKey) {
  state.admin.activeSettingsModal = modalKey;
  render();
}

export function closeSettingsModal() {
  state.admin.activeSettingsModal = null;
  clearWhatsAppSettingsRefresh();
  render();
}

export function scheduleWhatsAppSettingsRefresh() {
  clearWhatsAppSettingsRefresh();
  if (!isAdmin() || state.route !== "admin" || state.admin.activeSettingsModal !== "whatsapp") {
    return;
  }
  whatsappSettingsRefreshTimer = window.setTimeout(async () => {
    if (!isAdmin() || state.route !== "admin" || state.admin.activeSettingsModal !== "whatsapp") {
      return;
    }
    try {
      const result = await api("/api/admin/settings", { skipCache: true });
      state.admin.settings = result.settings;
      state.admin.placeholders = result.placeholders || [];
      render();
    } catch {
      scheduleWhatsAppSettingsRefresh();
    }
  }, 4000);
}

export function insertPlaceholderToken(card, token) {
  const activeField = card.dataset.activeField || "";
  const namedTarget = activeField ? card.querySelector(`[name="${activeField}"]`) : null;
  const target =
    namedTarget && ["INPUT", "TEXTAREA"].includes(namedTarget.tagName)
      ? namedTarget
      : card.querySelector("[data-template-body]") || card.querySelector("textarea") || card.querySelector("input");
  if (!target) {
    return;
  }

  const currentValue = target.value || "";
  const start = target.selectionStart ?? currentValue.length;
  const end = target.selectionEnd ?? currentValue.length;
  target.value = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
  const next = start + token.length;
  target.focus();
  if (typeof target.setSelectionRange === "function") {
    target.setSelectionRange(next, next);
  }
}

export function refreshEmailPreview(card) {
  if (card.dataset.templateChannel !== "email") {
    return;
  }
  const preview = card.querySelector("[data-email-preview]");
  const field = card.querySelector("[data-template-body]");
  if (!preview || !field) {
    return;
  }
  preview.srcdoc = buildEmailPreviewDoc(field.value);
}

export function renderSettingsModalShell({ modalKey, eyebrow, title, body, wide = false, closable = true, panelClass = "" }) {
  return `
    <div class="settings-modal" data-settings-modal="${safe(modalKey)}" role="dialog" aria-modal="true" aria-labelledby="${safe(modalKey)}-title">
      <section class="settings-modal-panel ${wide ? "wide" : ""} ${safe(panelClass)}">
        <header class="settings-modal-head">
          <div>
            <p class="eyebrow">${safe(eyebrow)}</p>
            <h2 id="${safe(modalKey)}-title">${safe(title)}</h2>
          </div>
          ${closable ? `<button type="button" class="icon-button secondary" data-close-settings-modal aria-label="Fechar">&times;</button>` : ""}
        </header>
        <div class="settings-modal-body">
          ${body}
        </div>
      </section>
    </div>
  `;
}

export function renderFunnelModal(modalKey, title, eyebrow, sectionKey, stages) {
  return renderSettingsModalShell({
    modalKey,
    eyebrow,
    title,
    body: `
      <form class="settings-modal-form" id="${safe(`${sectionKey}Form`)}" data-section="${safe(sectionKey)}">
        ${renderFunnelRows(sectionKey, stages)}
        <div class="modal-footer split">
          <div class="modal-actions-group">
            <button type="button" class="secondary" data-add-stage="${safe(sectionKey)}">Adicionar etapa</button>
            <button type="button" class="ghost" data-reset-section="${safe(sectionKey)}">Restaurar padrao</button>
          </div>
          <div class="modal-actions-group">
            <button type="button" class="secondary" data-close-settings-modal>Fechar</button>
            <button type="submit">Salvar funil</button>
          </div>
        </div>
      </form>
    `,
  });
}

export function renderSmtpModal(smtp) {
  return renderSettingsModalShell({
    modalKey: "smtpSettingsModal",
    eyebrow: "Conexoes",
    title: "Configuracao SMTP",
    body: `
      <form class="settings-modal-form" id="smtpSettingsForm" data-section="smtp">
        <div class="form-grid two">
          <label>
            Servidor SMTP
            <input name="host" value="${safe(smtp.host || "")}" />
          </label>
          <label>
            Porta
            <input name="port" type="number" min="1" max="65535" value="${safe(smtp.port || 587)}" />
          </label>
          <label>
            Usuario
            <input name="username" value="${safe(smtp.username || "")}" />
          </label>
          <label>
            Senha
            <input name="password" type="password" value="${safe(smtp.password || "")}" />
          </label>
          <label>
            Nome do remetente
            <input name="from_name" value="${safe(smtp.from_name || "")}" />
          </label>
          <label>
            E-mail remetente
            <input name="from_email" type="email" value="${safe(smtp.from_email || "")}" />
          </label>
          <div class="toggle-row span-2">
            <label class="check-field">
              <input name="use_tls" type="checkbox" ${smtp.use_tls ? "checked" : ""} />
              Usar TLS
            </label>
            <label class="check-field">
              <input name="use_ssl" type="checkbox" ${smtp.use_ssl ? "checked" : ""} />
              Usar SSL
            </label>
          </div>
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" id="smtpTestButton">Testar conexao</button>
          <div class="modal-actions-group">
            <button type="button" class="secondary" data-close-settings-modal>Fechar</button>
            <button type="submit">Salvar SMTP</button>
          </div>
        </div>
      </form>
    `,
  });
}

export function renderWhatsappModal(whatsapp) {
  return renderSettingsModalShell({
    modalKey: "whatsappSettingsModal",
    eyebrow: "Conexoes",
    title: "Conexao WhatsApp",
    body: `
      <form class="settings-modal-form" id="whatsappSettingsForm" data-section="whatsapp">
        <input name="enabled" type="hidden" value="true" />
        <input name="connection_name" type="hidden" value="${safe(whatsapp.connection_name || "Hipersales Alerts")}" />
        <input name="alert_phone" type="hidden" value="${safe(whatsapp.alert_phone || "")}" />
        <input name="instance_id" type="hidden" value="${safe(whatsapp.instance_id || "")}" />
        <div class="whatsapp-qr">
          <div class="qr-preview">
            ${
              whatsapp.qr_image_url
                ? `<img src="${safe(whatsapp.qr_image_url)}" alt="QR code do WhatsApp" />`
                : `<span>${whatsapp.connected ? "WhatsApp conectado." : "Clique em Gerar QR e escaneie pelo WhatsApp."}</span>`
            }
          </div>
          <div class="whatsapp-meta">
            <p class="lead">Status: ${safe(whatsapp.status_label || "Aguardando QR")}</p>
            ${whatsapp.last_error ? `<small class="danger-text">${safe(whatsapp.last_error)}</small>` : ""}
          </div>
        </div>
        <div class="whatsapp-auto-reply">
          <label class="check-field whatsapp-auto-reply-toggle">
            <input name="unavailable_reply_enabled" type="checkbox" ${whatsapp.unavailable_reply_enabled ? "checked" : ""} />
            <span>
              <strong>Ativar mensagem de indisponibilidade</strong>
              <small>Qualquer mensagem recebida nesse WhatsApp recebe uma resposta automatica.</small>
            </span>
          </label>
          <label>
            Mensagem de indisponibilidade
            <textarea name="unavailable_reply_message" rows="4">${safe(whatsapp.unavailable_reply_message || "")}</textarea>
          </label>
        </div>
        <div class="modal-footer split">
          <div class="modal-actions-group">
            <button type="submit">Salvar regra</button>
            <button type="button" class="secondary" id="whatsappQrButton">${whatsapp.qr_image_url ? "Gerar de novo" : "Gerar QR"}</button>
            <button type="button" class="ghost danger" id="whatsappDisconnectButton">Desconectar</button>
          </div>
          <div class="modal-actions-group">
            <button type="button" class="secondary" data-close-settings-modal>Fechar</button>
          </div>
        </div>
      </form>
    `,
  });
}

export function renderMessageTemplatesModal(channel, templates, placeholders) {
  const channelLabel = channel === "email" ? "E-mail" : "WhatsApp";
  const activeTitle = channel === "email" ? "Mensagens de e-mail" : "Mensagens de WhatsApp";
  const modalPlaceholders = channel === "email"
    ? [
        { token: "{{logo_email}}", label: "Logo do e-mail" },
        ...placeholders.filter((placeholder) => placeholder.token !== "{{logo_email}}"),
      ]
    : placeholders.filter((placeholder) => placeholder.token !== "{{logo_email}}");
  return renderSettingsModalShell({
    modalKey: `${channel}MessagesModal`,
    eyebrow: "Mensagens",
    title: activeTitle,
    wide: true,
    body: `
      <form class="settings-modal-form" id="${safe(`${channel}TemplatesForm`)}" data-section="message_templates" data-channel="${safe(channel)}">
        <div class="template-grid modal-template-grid">
          ${renderTemplateCard(channel, "order_status_changed", "Status do pedido alterado", templates.order_status_changed, channelLabel, true)}
          ${renderTemplateCard(channel, "customer_approved", "Cliente aprovado", templates.customer_approved, channelLabel, false)}
        </div>
        <div class="settings-placeholder-help">
          <p class="lead">Clique em um campo antes de inserir um placeholder. O chip entra no item em foco.</p>
          ${renderPlaceholderToolbar(modalPlaceholders)}
        </div>
        <div class="modal-footer split">
          <button type="button" class="secondary" data-close-settings-modal>Fechar</button>
          <button type="submit">Salvar mensagens</button>
        </div>
      </form>
    `,
  });
}

export function renderSettingsModal(settings, placeholders) {
  const active = state.admin.activeSettingsModal;
  if (!active) {
    return "";
  }

  switch (active) {
    case "customer_funnel":
      return renderFunnelModal("customerFunnelModal", "Funil de aprovacao", "Fluxo de clientes", "customer_funnel", settings.customer_funnel);
    case "product_funnel":
      return renderFunnelModal("productFunnelModal", "Funil de producao", "Fluxo de produtos", "product_funnel", settings.product_funnel);
    case "order_statuses":
      return renderOrderStatusModal(settings.order_statuses);
    case "smtp":
      return renderSmtpModal(settings.smtp);
    case "whatsapp":
      return renderWhatsappModal(settings.whatsapp);
    case "email_messages":
      return renderMessageTemplatesModal("email", settings.message_templates.email, placeholders);
    case "whatsapp_messages":
      return renderMessageTemplatesModal("whatsapp", settings.message_templates.whatsapp, placeholders);
    default:
      return "";
  }
}

export function wireAdminSettings(view) {
  const close = () => closeSettingsModal();

  const syncFunnelRows = (list) => {
    const rows = Array.from(list.querySelectorAll("[data-stage-row]"));
    rows.forEach((row, index) => {
      const label = row.querySelector(".funnel-index");
      if (label) {
        label.textContent = String(index + 1);
      }
      const removeButton = row.querySelector("[data-remove-stage]");
      if (removeButton) {
        removeButton.disabled = rows.length <= 1;
        removeButton.onclick = () => {
          if (rows.length <= 1) {
            return;
          }
          row.remove();
          syncFunnelRows(list);
        };
      }
    });
  };

  const setActiveTemplateCard = (card) => {
    const modal = card.closest("[data-settings-modal]");
    if (!modal) {
      return;
    }
    modal.querySelectorAll("[data-template-card]").forEach((entry) => {
      entry.dataset.activeTemplate = entry === card ? "true" : "false";
      if (entry !== card) {
        delete entry.dataset.activeField;
      }
    });
  };

  view.querySelectorAll("[data-open-settings-modal]").forEach((button) => {
    button.addEventListener("click", () => openSettingsModal(button.dataset.openSettingsModal));
  });

  view.querySelectorAll("[data-close-settings-modal]").forEach((button) => {
    button.addEventListener("click", close);
  });

  view.querySelectorAll("[data-settings-modal]").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });
  });

  view.querySelectorAll("[data-funnel-list]").forEach(syncFunnelRows);

  view.querySelectorAll("[data-add-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.addStage;
      const form = button.closest("form");
      const list = form?.querySelector(`[data-funnel-list="${section}"]`) || form?.querySelector("[data-funnel-list]");
      if (!list || !section) {
        return;
      }
      const index = list.querySelectorAll("[data-stage-row]").length;
      list.insertAdjacentHTML("beforeend", renderFunnelRow({ name: "", color: "#0D6FD8" }, index, index + 1));
      syncFunnelRows(list);
      const rows = list.querySelectorAll("[data-stage-row]");
      const lastRow = rows[rows.length - 1];
      const nameField = lastRow?.querySelector("[data-stage-name]");
      if (nameField) {
        nameField.focus();
      }
    });
  });

  view.querySelectorAll("[data-open-request-modal]").forEach((button) => {
    button.addEventListener("click", () => openRequestModal(button.dataset.openRequestModal));
  });

  view.querySelectorAll("[data-reset-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.resetSection;
      const form = button.closest("form");
      const list = form?.querySelector(`[data-funnel-list="${section}"]`) || form?.querySelector("[data-funnel-list]");
      if (!list || !section) {
        return;
      }
      const stages = defaultAdminSettings[section] || [];
      list.innerHTML = stages.map((stage, index) => renderFunnelRow(stage, index, stages.length)).join("");
      syncFunnelRows(list);
    });
  });

  view.querySelectorAll("[data-status-color]").forEach((field) => {
    field.addEventListener("input", () => {
      const row = field.closest("[data-order-status-row]");
      const color = sanitizeHexColor(field.value);
      row?.style.setProperty("--stage-color", color);
      const badge = row?.querySelector(".status-badge");
      if (badge) {
        badge.style.setProperty("--status-color", color);
        badge.style.setProperty("--status-soft", softStatusColor(color));
        badge.style.setProperty("--status-text", readableTextColor(color));
      }
    });
  });
  view.querySelector(".order-status-config")?.addEventListener("input", (event) => {
    const field = event.target.closest("[data-status-color]");
    if (!field) {
      return;
    }
    const row = field.closest("[data-order-status-row]");
    const color = sanitizeHexColor(field.value);
    row?.style.setProperty("--stage-color", color);
    const badge = row?.querySelector(".status-badge");
    if (badge) {
      badge.style.setProperty("--status-color", color);
      badge.style.setProperty("--status-soft", softStatusColor(color));
      badge.style.setProperty("--status-text", readableTextColor(color));
    }
  });

  view.querySelector("[data-reset-order-statuses]")?.addEventListener("click", () => {
    const form = view.querySelector("#orderStatusesForm");
    const list = form?.querySelector(".order-status-config");
    if (!list) {
      return;
    }
    list.innerHTML = defaultAdminSettings.order_statuses
      .map((status, index) => {
        const color = sanitizeHexColor(status.color);
        return `
          <div class="funnel-row" data-order-status-row data-status-key="${safe(status.key)}" style="--stage-color:${safe(color)}">
            <span class="funnel-index">${index + 1}</span>
            <label class="funnel-field">
              <span>Status</span>
              <input data-status-name type="text" value="${safe(status.name)}" readonly />
            </label>
            <label class="funnel-field color">
              <span>Cor</span>
              <input data-status-color type="color" value="${safe(color)}" />
            </label>
            <span class="badge status-badge" style="--status-color:${safe(color)};--status-soft:${safe(softStatusColor(color))};--status-text:${safe(readableTextColor(color))};">${safe(status.name)}</span>
          </div>
        `;
      })
      .join("");
  });

  view.querySelectorAll("[data-placeholder-token]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.dataset.placeholderToken;
      const modal = button.closest("[data-settings-modal]");
      const card =
        modal?.querySelector("[data-template-card][data-active-template='true']") ||
        modal?.querySelector("[data-template-card]");
      if (!card || !token) {
        return;
      }
      insertPlaceholderToken(card, token);
      refreshEmailPreview(card);
    });
  });

  const templateCards = Array.from(view.querySelectorAll("[data-template-card]"));
  if (templateCards.length && !templateCards.some((card) => card.dataset.activeTemplate === "true")) {
    templateCards[0].dataset.activeTemplate = "true";
  }
  templateCards.forEach((card) => {
    card.addEventListener("focusin", () => setActiveTemplateCard(card));
    refreshEmailPreview(card);
    card.querySelectorAll("input, textarea").forEach((field) => {
      field.addEventListener("focus", () => {
        card.dataset.activeField = field.name;
        setActiveTemplateCard(card);
      });
      field.addEventListener("input", () => {
        card.dataset.activeField = field.name;
        refreshEmailPreview(card);
      });
    });
  });

  const funnelForms = view.querySelectorAll("form[data-section='customer_funnel'], form[data-section='product_funnel']");
  funnelForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveAdminSettingsSection(form.dataset.section, collectFunnelData(event.target), { closeModal: true });
      } catch (error) {
        setFlash("", error.message);
      }
    });
  });

  const orderStatusesForm = view.querySelector("#orderStatusesForm");
  if (orderStatusesForm) {
    orderStatusesForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveAdminSettingsSection("order_statuses", collectOrderStatusData(event.target), { closeModal: true });
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const smtpForm = view.querySelector("#smtpSettingsForm");
  if (smtpForm) {
    smtpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveAdminSettingsSection("smtp", readFormValues(event.target), { closeModal: true });
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const smtpTestButton = view.querySelector("#smtpTestButton");
  if (smtpTestButton && smtpForm) {
    smtpTestButton.addEventListener("click", async () => {
      try {
        const result = await api("/api/admin/settings/smtp/test", {
          method: "POST",
          body: JSON.stringify(readFormValues(smtpForm)),
        });
        setFlash(result.message);
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const whatsappForm = view.querySelector("#whatsappSettingsForm");
  if (whatsappForm) {
    whatsappForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveAdminSettingsSection("whatsapp", readFormValues(event.target), { closeModal: true });
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const whatsappQrButton = view.querySelector("#whatsappQrButton");
  if (whatsappQrButton && whatsappForm) {
    whatsappQrButton.addEventListener("click", async () => {
      try {
        const result = await api("/api/admin/settings/whatsapp/connect", {
          method: "POST",
          body: JSON.stringify(readFormValues(whatsappForm)),
        });
        await loadRouteData("admin");
        setFlash(result.message);
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const whatsappDisconnectButton = view.querySelector("#whatsappDisconnectButton");
  if (whatsappDisconnectButton) {
    whatsappDisconnectButton.addEventListener("click", async () => {
      try {
        const result = await api("/api/admin/settings/whatsapp/disconnect", {
          method: "POST",
        });
        await loadRouteData("admin");
        setFlash(result.message);
      } catch (error) {
        setFlash("", error.message);
      }
    });
  }

  const messageForms = view.querySelectorAll("form[data-section='message_templates']");
  messageForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const channel = form.dataset.channel;
      if (!channel) {
        return;
      }
      try {
        const values = readFormValues(event.target);
        await saveAdminSettingsSection(
          "message_templates",
          {
            [channel]: {
              order_status_changed: {
                subject: String(values[`${channel}_order_status_changed_subject`] || ""),
                body: String(values[`${channel}_order_status_changed_body`] || ""),
              },
              customer_approved: {
                subject: String(values[`${channel}_customer_approved_subject`] || ""),
                body: String(values[`${channel}_customer_approved_body`] || ""),
              },
            },
          },
          { closeModal: true }
        );
      } catch (error) {
        setFlash("", error.message);
      }
    });
  });

  if (state.admin.activeSettingsModal === "whatsapp") {
    scheduleWhatsAppSettingsRefresh();
  } else {
    clearWhatsAppSettingsRefresh();
  }
}

export function renderAdmin(view) {
  const settings = adminSettingsSnapshot();
  const placeholders = state.admin.placeholders?.length ? state.admin.placeholders : defaultPlaceholders;

  view.innerHTML = `
    <div class="admin-grid settings-grid">
      ${sectionBand({
        id: "settingsIntro",
        span: "span-12",
        eyebrow: "Retaguarda",
        title: "Configuracoes",
        body: `
          <div class="settings-intro">
            <p class="lead">
              A tela ficou organizada em modais para manter o painel leve. Abra o bloco que precisa,
              ajuste a configuracao e salve sem carregar dashboard.
            </p>
          </div>
        `,
      })}

      ${sectionBand({
        id: "funnelsLauncher",
        span: "span-12",
        eyebrow: "Funis",
        title: "Aprovacao de clientes e producao de produtos",
        body: `
          <div class="settings-launcher-row">
            <div class="settings-launcher-copy">
              <p class="lead">Cada funil abre em um modal proprio com etapas, cores e ordem dos status.</p>
            </div>
            <div class="settings-launcher-actions">
              <button type="button" class="secondary" data-open-settings-modal="customer_funnel">Clientes</button>
              <button type="button" class="secondary" data-open-settings-modal="product_funnel">Produtos</button>
              <button type="button" class="secondary" data-open-settings-modal="order_statuses">Pedidos</button>
            </div>
          </div>
        `,
      })}

      ${sectionBand({
        id: "connectionsLauncher",
        span: "span-12",
        eyebrow: "Conexoes",
        title: "SMTP e WhatsApp",
        body: `
          <div class="settings-launcher-row">
            <div class="settings-launcher-copy">
              <p class="lead">Conexoes separadas para e-mail e WhatsApp, com teste de SMTP e QR de vinculo.</p>
            </div>
            <div class="settings-launcher-actions">
              <button type="button" class="secondary" data-open-settings-modal="smtp">SMTP</button>
              <button type="button" class="secondary" data-open-settings-modal="whatsapp">WhatsApp</button>
            </div>
          </div>
        `,
      })}

      ${sectionBand({
        id: "messagesLauncher",
        span: "span-12",
        eyebrow: "Mensagens",
        title: "Modelos de alerta",
        body: `
          <div class="settings-launcher-row">
            <div class="settings-launcher-copy">
              <p class="lead">Edite os modelos de e-mail e WhatsApp para pedido atualizado e cliente aprovado.</p>
            </div>
            <div class="settings-launcher-actions">
              <button type="button" class="secondary" data-open-settings-modal="email_messages">E-mail</button>
              <button type="button" class="secondary" data-open-settings-modal="whatsapp_messages">WhatsApp</button>
            </div>
          </div>
        `,
      })}

      ${renderSettingsModal(settings, placeholders)}
    </div>
  `;

  wireAdminSettings(view);
  view.querySelectorAll("[data-open-request-modal]").forEach((button) => {
    button.addEventListener("click", () => openRequestModal(button.dataset.openRequestModal));
  });
  const goApprovals = view.querySelector("[data-go-customers-approvals]");
  if (goApprovals) {
    goApprovals.addEventListener("click", goToCustomersApprovals);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.user && isAdmin() && state.admin.activeSettingsModal) {
    closeSettingsModal();
    return;
  }
  if (event.key === "Escape" && state.user && state.admin.activeUserModal) {
    closeUserModal();
    return;
  }
  if (event.key === "Escape" && state.user && state.admin.activeOrderModal) {
    closeOrderModal();
    return;
  }
  if (event.key === "Escape" && state.user && state.activeOccurrenceTimelineId) {
    closeOccurrenceTimelineModal();
  }
});

boot();
