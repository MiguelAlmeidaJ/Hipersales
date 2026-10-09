export const STATUS_LABELS: Record<string, string> = {
  em_analise: "Em analise",
  pedido_aprovado: "Pedido aprovado",
  recusado: "Proposta recusada",
  em_producao: "Em producao",
  faturado: "Faturado",
  entregue: "Pedido entregue",
};

export const PLACEHOLDERS = [
  ["{{pedido_id}}", "Pedido"], ["{{solicitacao_id}}", "Solicitacao"],
  ["{{logo_email}}", "Logo do e-mail"], ["{{cliente}}", "Cliente"],
  ["{{cliente_email}}", "E-mail do cliente"], ["{{empresa}}", "Empresa"],
  ["{{vendedor}}", "Representante comercial"], ["{{vendedor_email}}", "Usuario do representante comercial"],
  ["{{cnpj}}", "CNPJ"], ["{{status}}", "Status"], ["{{status_label}}", "Status legivel"],
  ["{{total}}", "Total"], ["{{observacoes}}", "Observacoes"], ["{{oc}}", "Ordem de compra"],
  ["{{data}}", "Data"], ["{{apto_novos_pedidos}}", "Aviso de base"],
].map(([token, label]) => ({ token, label }));

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  customer_funnel: [
    { name: "Solicitado", color: "#0D6FD8" }, { name: "Em validacao", color: "#E0AD2F" },
    { name: "Aprovado", color: "#5ABF43" }, { name: "Recusado", color: "#B42318" },
  ],
  product_funnel: [
    { name: "Cadastro", color: "#0D6FD8" }, { name: "Em producao", color: "#15A4D7" },
    { name: "Liberado", color: "#5ABF43" }, { name: "Arquivado", color: "#617287" },
  ],
  order_statuses: Object.entries(STATUS_LABELS).map(([key, name]) => ({ key, name, color: "#0D6FD8" })),
  smtp: { host: "", port: 587, username: "", password: "", from_name: "Hipersales", from_email: "", use_tls: true, use_ssl: false },
  whatsapp: {
    enabled: false, connected: false, connection_name: "Hipersales Alerts", alert_phone: "", instance_id: "",
    qr_payload: "", qr_token: "", last_qr_at: null, last_error: "", connected_at: null,
    provider: "evolution", qr_image_url: "", unavailable_reply_enabled: false,
    unavailable_reply_message: "Esse canal e exclusivo para status do HiperSales Web. Qualquer comunicacao deve ser feita pelo canal oficial. Sua mensagem nao sera vista por aqui.",
  },
  message_templates: {
    email: {
      order_status_changed: { subject: "Status do pedido #{{pedido_id}} atualizado", body: "<html><body>Status do pedido #{{pedido_id}}: {{status_label}}</body></html>" },
      customer_approved: { subject: "Cliente {{cliente}} aprovado", body: "<html><body>Cliente {{cliente}} aprovado.</body></html>" },
    },
    whatsapp: {
      order_status_changed: { subject: "Status do pedido", body: "Pedido #{{pedido_id}}: {{status_label}}" },
      customer_approved: { subject: "Cliente aprovado", body: "Cliente {{cliente}} aprovado." },
    },
  },
};
