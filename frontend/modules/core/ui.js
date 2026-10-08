import {
  sanitizeHexColor,
} from "../admin/settings.js";

import {
  render,
} from "./shell.js";

import {
  setPage,
  state,
} from "./state.js";

export function renderPagination(key, pagination) {
  if (!pagination || !pagination.totalItems) {
    return "";
  }
  const pages = [];
  const first = Math.max(1, pagination.page - 2);
  const last = Math.min(pagination.totalPages, pagination.page + 2);
  for (let page = first; page <= last; page += 1) {
    pages.push(page);
  }

  return `
    <nav class="pagination" aria-label="Paginacao">
      <span class="pagination-summary">
        ${safe(pagination.start + 1)}-${safe(pagination.end)} de ${safe(pagination.totalItems)}
      </span>
      <div class="pagination-actions">
        <button type="button" class="secondary" data-page-key="${safe(key)}" data-page="${safe(pagination.page - 1)}" ${pagination.page <= 1 ? "disabled" : ""}>Anterior</button>
        ${pages
          .map(
            (page) => `
              <button type="button" class="secondary pagination-page ${page === pagination.page ? "active" : ""}" data-page-key="${safe(key)}" data-page="${safe(page)}" aria-current="${page === pagination.page ? "page" : "false"}">
                ${safe(page)}
              </button>
            `
          )
          .join("")}
        <button type="button" class="secondary" data-page-key="${safe(key)}" data-page="${safe(pagination.page + 1)}" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Proxima</button>
      </div>
      <span class="pagination-summary">Pagina ${safe(pagination.page)} de ${safe(pagination.totalPages)}</span>
    </nav>
  `;
}

export function isStandalonePwa() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export async function promptInstallPwa() {
  if (!state.installPrompt) return;
  const promptEvent = state.installPrompt;
  state.installPrompt = null;
  render();
  promptEvent.prompt();
  try {
    await promptEvent.userChoice;
  } catch {}
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  render();
});

window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  render();
});

export function wirePagination(root, onChange = render) {
  root.querySelectorAll("[data-page-key][data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      setPage(button.dataset.pageKey, button.dataset.page);
      onChange();
    });
  });
}

export function hydrateResponsiveTables(root = document) {
  root.querySelectorAll(".table-shell table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
    if (!headers.length) return;
    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!cell.dataset.label && headers[index]) {
          cell.dataset.label = headers[index];
        }
      });
    });
  });
}

export const routeMeta = {
  dashboard: { eyebrow: "Dashboard", title: "Painel executivo" },
  requestCustomer: { eyebrow: "Clientes", title: "Solicitar cadastro" },
  customers: { eyebrow: "Clientes", title: "Consultar clientes" },
  activities: { eyebrow: "Atividades", title: "Minhas atividades" },
  occurrences: { eyebrow: "Ocorrencias", title: "Registro de ocorrencias" },
  reports: { eyebrow: "Relatorios", title: "Relatorios gerenciais" },
  goals: { eyebrow: "Metas", title: "Metas comerciais" },
  customerApprovals: { eyebrow: "Clientes", title: "Aprovacao de clientes" },
  companies: { eyebrow: "Empresas", title: "Cadastro de empresas" },
  products: { eyebrow: "Catalogo", title: "Produtos" },
  proposal: { eyebrow: "Vendas", title: "Enviar proposta" },
  orders: { eyebrow: "Pedidos", title: "Consultar pedidos" },
  users: { eyebrow: "Usuarios", title: "Cadastro de usuarios" },
  admin: { eyebrow: "Retaguarda", title: "Configuracoes" },
  superAdmin: { eyebrow: "Super admin", title: "Gestao de contas" },
};

export function iconSvg(content) {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      ${content}
    </svg>
  `;
}

export const uiIcons = {
  pdf: iconSvg(`
    <path d="M7 3.5h7l3 3V20.5H7z"></path>
    <path d="M14 3.5v3h3"></path>
    <path d="M8.8 14.8h6.4"></path>
    <path d="M8.8 17h4.4"></path>
    <path d="M9 10.8h1.4a1.2 1.2 0 0 0 0-2.4H9v4.8"></path>
  `),
  timeline: iconSvg(`
    <path d="M6 5.5h12"></path>
    <path d="M6 12h12"></path>
    <path d="M6 18.5h12"></path>
    <circle cx="6" cy="5.5" r="2"></circle>
    <circle cx="6" cy="12" r="2"></circle>
    <circle cx="6" cy="18.5" r="2"></circle>
  `),
  truck: iconSvg(`
    <path d="M3.5 7h10v9h-10z"></path>
    <path d="M13.5 10h3l3 3v3h-6z"></path>
    <circle cx="7" cy="18" r="1.8"></circle>
    <circle cx="17" cy="18" r="1.8"></circle>
  `),
  check: iconSvg(`
    <circle cx="12" cy="12" r="9"></circle>
    <path d="m8.5 12.2 2.2 2.2 4.8-5"></path>
  `),
  file: iconSvg(`
    <path d="M7 3.5h7l3 3v14H7z"></path>
    <path d="M14 3.5v3h3"></path>
    <path d="M9 11h6"></path>
    <path d="M9 14h6"></path>
    <path d="M9 17h4"></path>
  `),
  image: iconSvg(`
    <rect x="4" y="5" width="16" height="14" rx="1.8"></rect>
    <circle cx="9" cy="10" r="1.6"></circle>
    <path d="m5.8 17 4.2-4 3 2.7 2.2-2.1 3 3.4"></path>
  `),
  video: iconSvg(`
    <rect x="4" y="6" width="12" height="12" rx="1.8"></rect>
    <path d="m16 10 4-2.4v8.8L16 14"></path>
    <path d="m9 10 3.3 2L9 14z"></path>
  `),
  music: iconSvg(`
    <path d="M9 18V6l9-2v12"></path>
    <circle cx="6.5" cy="18" r="2.5"></circle>
    <circle cx="15.5" cy="16" r="2.5"></circle>
  `),
  searchFile: iconSvg(`
    <path d="M7 3.5h7l3 3v14H7z"></path>
    <path d="M14 3.5v3h3"></path>
    <circle cx="10.2" cy="12" r="2.1"></circle>
    <path d="m12 13.8 1.8 1.8"></path>
  `),
  fileCheck: iconSvg(`
    <path d="M7 3.5h7l3 3v14H7z"></path>
    <path d="M14 3.5v3h3"></path>
    <path d="m9.1 13.2 1.8 1.8 3.9-4.1"></path>
  `),
  fileX: iconSvg(`
    <path d="M7 3.5h7l3 3v14H7z"></path>
    <path d="M14 3.5v3h3"></path>
    <path d="m9.2 11.5 4.8 4.8"></path>
    <path d="m14 11.5-4.8 4.8"></path>
  `),
  factory: iconSvg(`
    <path d="M4 20V9l5 3V9l5 3V7l6 3v10z"></path>
    <path d="M7 20v-4h3v4"></path>
    <path d="M14 20v-3h3v3"></path>
  `),
  box: iconSvg(`
    <path d="M4 8.5 12 4l8 4.5-8 4.5z"></path>
    <path d="M4 8.5v7L12 20l8-4.5v-7"></path>
    <path d="M12 13v7"></path>
  `),
  alert: iconSvg(`
    <path d="M12 4 3.8 18h16.4z"></path>
    <path d="M12 9v4"></path>
    <path d="M12 16h.01"></path>
  `),
  close: iconSvg(`
    <path d="M18 6 6 18"></path>
    <path d="m6 6 12 12"></path>
  `),
  eye: iconSvg(`
    <path d="M2.8 12s3.2-6 9.2-6 9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6z"></path>
    <circle cx="12" cy="12" r="2.6"></circle>
  `),
  edit: iconSvg(`
    <path d="M4 20h4.8L19 9.8 14.2 5 4 15.2z"></path>
    <path d="m13.2 6 4.8 4.8"></path>
  `),
  trash: iconSvg(`
    <path d="M4 7h16"></path>
    <path d="M9 7V4h6v3"></path>
    <path d="m7 7 1 13h8l1-13"></path>
    <path d="M10.5 11v5"></path>
    <path d="M13.5 11v5"></path>
  `),
  plus: iconSvg(`
    <path d="M12 5v14"></path>
    <path d="M5 12h14"></path>
  `),
  search: iconSvg(`
    <circle cx="10.5" cy="10.5" r="6.5"></circle>
    <path d="m15.5 15.5 4 4"></path>
  `),
  upload: iconSvg(`
    <path d="M12 16V4"></path>
    <path d="m7 9 5-5 5 5"></path>
    <path d="M4 20h16"></path>
  `),
  download: iconSvg(`
    <path d="M12 4v12"></path>
    <path d="m7 11 5 5 5-5"></path>
    <path d="M4 20h16"></path>
  `),
  install: iconSvg(`
    <path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v12A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V5A1.5 1.5 0 0 1 7 3.5z"></path>
    <path d="M12 8v6"></path>
    <path d="M9 11h6"></path>
    <path d="M9 15h6"></path>
  `),
  chart: iconSvg(`
    <path d="M4 19V5"></path>
    <path d="M4 19h17"></path>
    <path d="M8 16v-5"></path>
    <path d="M12 16V8"></path>
    <path d="M16 16v-3"></path>
    <path d="M20 16V6"></path>
  `),
  wallet: iconSvg(`
    <path d="M4 7.5h15a1.5 1.5 0 0 1 1.5 1.5v10H5.5A2.5 2.5 0 0 1 3 16.5v-10A2.5 2.5 0 0 0 5.5 9H20"></path>
    <path d="M16 14h.01"></path>
  `),
  clipboard: iconSvg(`
    <path d="M8 4h8l1 2h2v17H5V6h2z"></path>
    <path d="M9 4h6"></path>
    <path d="M8.5 11h7"></path>
    <path d="M8.5 15h7"></path>
    <path d="M8.5 19h4"></path>
  `),
  users: iconSvg(`
    <circle cx="9" cy="8" r="3"></circle>
    <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0"></path>
    <circle cx="17" cy="9" r="2.3"></circle>
    <path d="M14.8 18.5a4 4 0 0 1 6.4 0"></path>
  `),
  share: iconSvg(`
    <circle cx="18" cy="5" r="2.5"></circle>
    <circle cx="6" cy="12" r="2.5"></circle>
    <circle cx="18" cy="19" r="2.5"></circle>
    <path d="m8.4 10.8 9.2-5.2"></path>
    <path d="m8.4 13.2 9.2 5.2"></path>
  `),
};

export const sellerIcons = {
  proposal: iconSvg(`
    <path d="M6 3.5h9l3 3V20.5H6z"></path>
    <path d="M15 3.5v3h3"></path>
    <path d="m9 14 2 2 4.5-5"></path>
    <path d="M9 8.5h5"></path>
  `),
  orders: iconSvg(`
    <path d="M4 6.5h16"></path>
    <path d="M6.5 4h11L19 20H5z"></path>
    <path d="M9 11h6"></path>
    <path d="M9 15h6"></path>
  `),
  requestCustomer: iconSvg(`
    <circle cx="9.5" cy="8" r="3"></circle>
    <path d="M4 19a5.5 5.5 0 0 1 11 0"></path>
    <path d="M18.5 10.5v7"></path>
    <path d="M15 14h7"></path>
  `),
  customers: iconSvg(`
    <path d="M4 6.5h16v13H4z"></path>
    <path d="M7.5 10h4"></path>
    <path d="M7.5 13h7"></path>
    <path d="M7.5 16h5"></path>
    <circle cx="17" cy="11" r="1.4"></circle>
  `),
  activities: iconSvg(`
    <path d="M4 19V5"></path>
    <path d="M4 19h17"></path>
    <path d="m7 15 3-3 3 2 5-7"></path>
    <path d="M18 7h-4"></path>
    <path d="M18 7v4"></path>
  `),
};

export function sellerActionCard(route, icon, title, subtitle = "") {
  return `
    <button type="button" class="seller-action" data-route="${route}" aria-label="${safe(title)}">
      <span class="seller-action-icon">${icon}</span>
      <span class="seller-action-copy">
        <strong>${safe(title)}</strong>
        ${subtitle ? `<span>${safe(subtitle)}</span>` : ""}
      </span>
    </button>
  `;
}

export function sellerActionButton(icon, title, subtitle = "", attrs = "") {
  return `
    <button type="button" class="seller-action" ${attrs} aria-label="${safe(title)}">
      <span class="seller-action-icon">${icon}</span>
      <span class="seller-action-copy">
        <strong>${safe(title)}</strong>
        ${subtitle ? `<span>${safe(subtitle)}</span>` : ""}
      </span>
    </button>
  `;
}

export const statusMeta = {
  em_analise: { label: "Em analise", tone: "warn", color: "#E0AD2F" },
  pedido_aprovado: { label: "Pedido aprovado", tone: "ok", color: "#5ABF43" },
  recusado: { label: "Proposta recusada", tone: "danger", color: "#B42318" },
  em_producao: { label: "Em producao", tone: "warn", color: "#15A4D7" },
  faturado: { label: "Faturado", tone: "ok", color: "#0D6FD8" },
  entregue: { label: "Pedido entregue", tone: "ok", color: "#128475" },
};

export const paymentTermsOptions = [
  "Pagamento Antecipado",
  "Boleto 7 Dias",
  "Boleto 7/14 Dias",
  "Boleto 7/14/21 Dias",
  "Boleto 14 Dias",
  "Boleto 14/21 Dias",
  "Boleto 14/21/28 Dias",
  "Boleto 14/21/28/35 Dias",
  "Boleto 21 Dias",
  "Boleto 21/28 Dias",
  "Boleto 21/28/35 Dias",
  "Boleto 21/28/35/42 Dias",
  "Boleto 21/28/35/42/49 Dias",
  "Boleto 28 Dias",
  "Boleto 28/35 Dias",
  "Boleto 28/35/42 Dias",
  "Boleto 28/35/42/49 Dias",
  "Boleto 35 Dias",
  "Boleto 35/42/49 Dias",
  "Boleto 42 Dias",
  "Boleto 45 Dias",
  "Boleto 49 Dias",
  "Boleto 56 Dias",
  "Boleto 60 Dias",
  "Boleto 90 Dias",
];

export const invoiceTypeOptions = [
  "Com nota cheia",
  "Meia nota",
  "Nota parcial",
  "Nota baixa",
  "Sem nota",
];

export const taxOperatorOptions = [
  { value: "0", label: "NÃO, DIRETO DA FÁBRICA" },
  { value: "1", label: "SIM, VIA OPERADOR FISCAL" },
];

export function taxOperatorLabel(value) {
  return ["1", "true", "sim", "on"].includes(String(value ?? "").trim().toLowerCase())
    ? "SIM, VIA OPERADOR FISCAL"
    : "NÃO, DIRETO DA FÁBRICA";
}

export const requestStatusMeta = {
  pendente: { label: "Pendente", tone: "warn" },
  aprovada: { label: "Aprovada", tone: "ok" },
  recusada: { label: "Recusada", tone: "danger" },
};

export const defaultAdminSettings = {
  customer_funnel: [
    { name: "Solicitado", color: "#0D6FD8" },
    { name: "Em validacao", color: "#E0AD2F" },
    { name: "Aprovado", color: "#5ABF43" },
    { name: "Recusado", color: "#B42318" },
  ],
  product_funnel: [
    { name: "Cadastro", color: "#0D6FD8" },
    { name: "Em producao", color: "#15A4D7" },
    { name: "Liberado", color: "#5ABF43" },
    { name: "Arquivado", color: "#617287" },
  ],
  order_statuses: Object.entries(statusMeta).map(([key, meta]) => ({ key, name: meta.label, color: meta.color })),
  smtp: {
    host: "",
    port: 587,
    username: "",
    password: "",
    from_name: "Hipersales",
    from_email: "",
    use_tls: true,
    use_ssl: false,
  },
  whatsapp: {
    enabled: false,
    connected: false,
    connection_name: "Hipersales Alerts",
    alert_phone: "",
    instance_id: "",
    qr_token: "",
    last_qr_at: null,
    last_error: "",
    connected_at: null,
    qr_payload: "",
    qr_image_url: "",
    status_label: "Aguardando QR",
  },
  message_templates: {
    email: {
      order_status_changed: {
        subject: "Status do pedido #{{pedido_id}} atualizado",
        body: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#eef4fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#102035;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d9e3ef;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(13,47,107,0.08);">
      <tr>
        <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#08142b 0%,#0b3d8f 45%,#0d8c80 100%);text-align:center;">
          <div style="margin-bottom:14px;">{{logo_email}}</div>
          <div style="color:rgba(255,255,255,0.88);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">Atualização do pedido</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 18px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0d6fd8;font-weight:800;">Pedido #{{pedido_id}}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#0b2a63;">Status do pedido atualizado</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#617287;">Olá, {{cliente}}. Seu pedido foi movimentado no fluxo interno e agora segue com o status abaixo.</p>
          <div style="padding:18px 20px;border-radius:14px;background:#f5f9ff;border:1px solid #d9e3ef;margin-bottom:18px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#617287;margin-bottom:10px;">Status atual</div>
            <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#e7f7ec;color:#0f9f8a;font-weight:800;">{{status_label}}</div>
            <div style="margin-top:14px;font-size:14px;line-height:1.7;color:#102035;white-space:pre-line;">{{observacoes}}</div>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;width:34%;font-size:13px;">Empresa</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{empresa}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">Representante comercial</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{vendedor}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">Ordem de compra</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{oc}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#617287;font-size:13px;">Total</td>
              <td style="padding:10px 0;font-weight:700;">{{total}}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;">
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e8eef6;font-size:12px;line-height:1.7;color:#617287;">
            Mensagem gerada automaticamente pelo sistema Hipersales.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      },
      customer_approved: {
        subject: "Cliente {{cliente}} aprovado",
        body: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#eef4fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#102035;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d9e3ef;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(13,47,107,0.08);">
      <tr>
        <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#08142b 0%,#0b3d8f 45%,#0d8c80 100%);text-align:center;">
          <div style="margin-bottom:14px;">{{logo_email}}</div>
          <div style="color:rgba(255,255,255,0.88);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">Cliente aprovado</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 18px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0d6fd8;font-weight:800;">Solicitação #{{solicitacao_id}}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#0b2a63;">Cadastro liberado</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#617287;">O cliente <strong>{{cliente}}</strong> foi aprovado e já pode seguir para as próximas etapas comerciais.</p>
          <div style="padding:18px 20px;border-radius:14px;background:#f5f9ff;border:1px solid #d9e3ef;margin-bottom:18px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#617287;margin-bottom:10px;">Situação</div>
            <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#e7f7ec;color:#0f9f8a;font-weight:800;">{{status_label}}</div>
            <div style="margin-top:14px;font-size:14px;line-height:1.7;color:#102035;white-space:pre-line;">{{observacoes}}</div>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;width:34%;font-size:13px;">Cliente</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{cliente}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">CNPJ</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{cnpj}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;color:#617287;font-size:13px;">Representante comercial</td>
              <td style="padding:10px 0;border-bottom:1px solid #e8eef6;font-weight:700;">{{vendedor}}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#617287;font-size:13px;">E-mail do cliente</td>
              <td style="padding:10px 0;font-weight:700;">{{cliente_email}}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;">
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e8eef6;font-size:12px;line-height:1.7;color:#617287;">
            Mensagem gerada automaticamente pelo sistema Hipersales.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      },
    },
    whatsapp: {
      order_status_changed: {
        subject: "Atualizacao do pedido #{{pedido_id}}",
        body: "Olá, {{vendedor}} 😀\n\nEstamos fornecendo de forma automática uma informação diretamente do HiperSales Web.\nO pedido nº #{{pedido_id}} referente ao cliente {{cliente}} + {{cnpj}} teve uma atualização em seu status.\n\nSeu pedido encontra-se {{status_label}}\n\nVocê poderá acompanhar a atualização dos seus pedidos através do Software HiperSales Web - selecionando a opção \"consultar pedidos\" na tela inicial.\n\nEm breve volto com mais atualizações sobre seus pedidos!\nÓtimas vendas, até mais {{vendedor}}!",
      },
      customer_approved: {
        subject: "Cliente aprovado",
        body: "Cliente {{cliente}} aprovado. Solicitacao #{{solicitacao_id}}.\nRepresentante comercial: {{vendedor}}\nCNPJ: {{cnpj}}\n{{observacoes}}",
      },
    },
  },
};

export const defaultPlaceholders = [
  { token: "{{pedido_id}}", label: "Pedido" },
  { token: "{{solicitacao_id}}", label: "Solicitacao" },
  { token: "{{logo_email}}", label: "Logo do e-mail" },
  { token: "{{cliente}}", label: "Cliente" },
  { token: "{{cliente_email}}", label: "E-mail do cliente" },
  { token: "{{empresa}}", label: "Empresa" },
  { token: "{{vendedor}}", label: "Representante comercial" },
  { token: "{{vendedor_email}}", label: "Usuario do representante comercial" },
  { token: "{{cnpj}}", label: "CNPJ" },
  { token: "{{status}}", label: "Status" },
  { token: "{{status_label}}", label: "Status legivel" },
  { token: "{{total}}", label: "Total" },
  { token: "{{observacoes}}", label: "Observacoes" },
  { token: "{{oc}}", label: "Ordem de compra" },
  { token: "{{data}}", label: "Data" },
];

export const app = document.querySelector("#app");

export function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function date(value) {
  if (!value) return "—";
  const parsed = parseAppDate(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("pt-BR");
}

export function datetime(value) {
  if (!value) return "—";
  const parsed = parseAppDate(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-BR");
}

export function dateInputValue(value) {
  if (!value) return "";
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = parseAppDate(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowForInput() {
  return new Date().toLocaleString("pt-BR");
}

export function isAdmin() {
  return state.user?.role === "admin";
}

export function isSuperAdmin() {
  return state.user?.role === "super_admin" || state.user?.is_super_admin;
}

export function parseAppDate(value) {
  if (value instanceof Date) return value;
  const raw = String(value || "").trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(raw);
}

export function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isBonusOrderType(value) {
  return normalizeText(value).includes("bonificacao") || normalizeText(value).includes("bonificação");
}

export function defaultRouteForUser(user) {
  if (user?.role === "super_admin" || user?.is_super_admin) return "superAdmin";
  return "dashboard";
}

export function routeTitle() {
  if (isSuperAdmin()) return routeMeta[state.route]?.title || "Gestao de contas";
  if (!isAdmin()) {
    if (state.route === "dashboard") return `Seja bem vindo ${state.user?.name || "representante comercial"}`;
    if (state.route === "proposal") return "Enviar nova proposta";
    if (state.route === "orders") return "Consultar pedidos";
    if (state.route === "customers") return "Minha Carteira de Clientes";
    if (state.route === "requestCustomer") return "Solicitar cadastro de cliente";
    if (state.route === "activities") return "Minhas atividades";
    if (state.route === "occurrences") return "Registro de ocorrencias";
  }
  if (state.route === "orders" && isAdmin()) return "Pedidos";
  if (state.route === "customers" && isAdmin()) return "Clientes";
  if (state.route === "customerApprovals" && isAdmin()) return "Aprovacao de clientes";
  if (state.route === "products" && isAdmin()) return "Produtos";
  if (state.route === "users") return "Cadastro de usuarios";
  if (state.route === "admin") return "Configuracoes";
  return routeMeta[state.route]?.title || "Hipersales";
}

export function routeEyebrow() {
  if (isSuperAdmin()) return routeMeta[state.route]?.eyebrow || "Super admin";
  if (!isAdmin()) {
    if (state.route === "dashboard") return "Portal mobile";
    if (state.route === "proposal") return "Vendas";
    if (state.route === "orders") return "Pedidos";
    if (state.route === "requestCustomer") return "Clientes";
    if (state.route === "customers") return "CLIENTES";
    if (state.route === "activities") return "Performance";
    if (state.route === "occurrences") return "R.O.";
  }
  if (state.route === "orders" && isAdmin()) return "Aprovacao";
  if (state.route === "customers" || state.route === "products" || state.route === "users" || state.route === "admin") {
    return "Retaguarda";
  }
  if (state.route === "customerApprovals" && isAdmin()) return "Clientes";
  return routeMeta[state.route]?.eyebrow || "Hipersales";
}

export function flashMarkup() {
  if (!state.message && !state.error) return "";
  return `
    <div class="flash-stack">
      ${state.message ? `<div class="flash success">${safe(state.message)}</div>` : ""}
      ${state.error ? `<div class="flash error">${safe(state.error)}</div>` : ""}
    </div>
  `;
}

export function proposalSubmissionBanner() {
  if (!state.proposalLastSubmission) return "";
  const submission = state.proposalLastSubmission;
  return `
    <div class="proposal-sent-banner">
      <strong>Proposta enviada para análise</strong>
      <span>
        Pedido #${safe(submission.orderNumber || submission.id || "")}
        ${submission.company ? ` • ${safe(submission.company)}` : ""}
        ${submission.customer ? ` • ${safe(submission.customer)}` : ""}
      </span>
    </div>
  `;
}

export function buildOptions(items, selectedValue, valueGetter, labelGetter) {
  return items
    .map((item) => {
      const value = String(valueGetter(item));
      const label = safe(labelGetter(item));
      return `<option value="${safe(value)}" ${value === String(selectedValue) ? "selected" : ""}>${label}</option>`;
    })
    .join("");
}

export function customerOptions(selectedValue = "") {
  return buildOptions(
    state.common.customers,
    selectedValue,
    (customer) => customer.id,
    (customer) => `${customer.legal_name} - ${customer.cnpj}`
  );
}

export function companyOptions(selectedValue = "") {
  return buildOptions(
    state.common.companies,
    selectedValue,
    (company) => company.id,
    (company) => company.name
  );
}

export function sellerOptions(selectedValue = "") {
  return buildOptions(
    state.admin.users.filter((user) => user.role === "seller"),
    selectedValue,
    (user) => user.id,
    (user) => `${user.name} (${user.email})`
  );
}

export function productOptions(products, selectedValue = "") {
  return buildOptions(
    products,
    selectedValue,
    (product) => product.id,
    (product) => `${product.code} - ${product.name}`
  );
}

export function orderStatusSettings() {
  const settings = state.admin.settings?.order_statuses || defaultAdminSettings.order_statuses;
  const byKey = new Map((Array.isArray(settings) ? settings : []).map((item) => [String(item.key), item]));
  return Object.entries(statusMeta).map(([key, meta]) => {
    const configured = byKey.get(key) || {};
    return {
      key,
      name: meta.label,
      color: sanitizeHexColor(configured.color || meta.color),
      tone: meta.tone,
    };
  });
}

export function statusInfo(status) {
  return orderStatusSettings().find((item) => item.key === status) || {
    key: status,
    name: statusMeta[status]?.label || status,
    color: statusMeta[status]?.color || "#0D6FD8",
    tone: statusMeta[status]?.tone || "brand",
  };
}

export function readableTextColor(hexColor) {
  const color = sanitizeHexColor(hexColor).slice(1);
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? "#12305a" : "#ffffff";
}

export function softStatusColor(hexColor) {
  const color = sanitizeHexColor(hexColor).slice(1);
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.14)`;
}

export const orderStatusRank = {
  em_analise: 0,
  pedido_aprovado: 1,
  recusado: 1,
  em_producao: 2,
  faturado: 3,
  entregue: 4,
};

export function statusOptions(selectedValue = "") {
  const currentRank = orderStatusRank[selectedValue] ?? -1;
  return orderStatusSettings()
    .map((status) => {
      const textColor = readableTextColor(status.color);
      const statusRank = orderStatusRank[status.key] ?? currentRank;
      const disabled = status.key !== selectedValue && statusRank < currentRank;
      return `<option value="${safe(status.key)}" ${status.key === selectedValue ? "selected" : ""} ${disabled ? "disabled" : ""} style="background:${safe(status.color)};color:${safe(textColor)};">${safe(status.name)}</option>`;
    })
    .join("");
}

export function requestStatusBadge(status) {
  const meta = requestStatusMeta[status] || requestStatusMeta.pendente;
  return `<span class="badge ${meta.tone}">${safe(meta.label)}</span>`;
}

export function proposalStatusBadge(status) {
  const meta = statusInfo(status);
  return `<span class="badge status-badge" style="--status-color:${safe(meta.color)};--status-soft:${safe(softStatusColor(meta.color))};--status-text:${safe(readableTextColor(meta.color))};">${safe(meta.name)}</span>`;
}

export function searchActionField(inputHtml, buttonText = "Buscar") {
  return `
    <div class="search-action-field">
      ${inputHtml}
      <button type="button" class="secondary icon-text-btn" data-search-submit>${uiIcons.search}<span>${safe(buttonText)}</span></button>
    </div>
  `;
}

export function wireSearchSubmit(root, inputSelector, callback) {
  const input = root.querySelector(inputSelector);
  if (!input) return;
  const submit = () => callback(input.value);
  input.closest(".search-action-field")?.querySelector("[data-search-submit]")?.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
}

export function parsePercentValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const compact = raw.replace(/\s+/g, "").replace(/%/g, "");
  let cleaned = compact;
  if (compact.includes(",") && compact.includes(".")) {
    cleaned = compact.replace(/\./g, "").replace(",", ".");
  } else if (compact.includes(",")) {
    cleaned = compact.replace(",", ".");
  }
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatPercentValue(value) {
  const numeric = parsePercentValue(value);
  return `${numeric.toFixed(2).replace(".", ",")}%`;
}

export function resetPercentInputs(root) {
  root.querySelectorAll("[data-percent-input]").forEach((input) => {
    input.value = "0,00%";
  });
}

export function editPercentValue(value) {
  const numeric = parsePercentValue(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "";
  }
  return String(numeric).replace(".", ",");
}

export function parseCurrencyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const compact = raw.replace(/\s+/g, "").replace(/R\$/g, "");
  let cleaned = compact;
  if (compact.includes(",") && compact.includes(".")) {
    cleaned = compact.replace(/\./g, "").replace(",", ".");
  } else if (compact.includes(",")) {
    cleaned = compact.replace(",", ".");
  }
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatCurrencyValue(value) {
  const numeric = parseCurrencyValue(value);
  return numeric.toFixed(2).replace(".", ",");
}

export function syncCurrencyInput(input) {
  if (!input) return;
  const raw = String(input.dataset.currencyRaw || "").replace(/\D/g, "");
  if (!raw) {
    input.value = "0,00";
    return;
  }
  const cents = Number(raw);
  if (!Number.isFinite(cents)) {
    input.value = "0,00";
    return;
  }
  input.value = (cents / 100).toFixed(2).replace(".", ",");
}

export function resetCurrencyInputs(root) {
  root.querySelectorAll("[data-currency-input]").forEach((input) => {
    delete input.dataset.currencyRaw;
    input.value = "0,00";
  });
}

export function metricCard(label, value, note, tone) {
  return `
    <article class="metric metric-${tone}">
      <span class="metric-label">${safe(label)}</span>
      <strong>${safe(value)}</strong>
      ${note ? `<p>${safe(note)}</p>` : ""}
    </article>
  `;
}

export function sectionBand({ id, eyebrow, title, action = "", body, span = "span-12" }) {
  return `
    <section class="section-band ${span}" id="${id}">
      <header class="section-head">
        <div>
          <p class="eyebrow">${safe(eyebrow)}</p>
          <h2>${safe(title)}</h2>
        </div>
        ${action ? `<div class="section-action">${action}</div>` : ""}
      </header>
      <div class="section-body">
        ${body}
      </div>
    </section>
  `;
}
