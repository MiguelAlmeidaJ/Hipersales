import data from "@/mocks/api-data.json";

type ApiOptions = RequestInit & { timeoutMs?: number };
type MockRecord = Record<string, any>;

const orders: MockRecord[] = structuredClone(data.orders);
const notifications: MockRecord[] = structuredClone(data.notifications);
const occurrences: MockRecord[] = structuredClone(data.occurrences);
const goalRecords: MockRecord[] = structuredClone(data.goals);
const idempotentOrders = new Map<string, MockRecord>();
const demoCustomerNames = ["Armazém Central", "Supermercado Horizonte", "Mercado Boa Praça", "Empório Imperial", "Rede Econômica", "Comercial Avenida", "Mercado São Lucas", "Supermercado União", "Distribuidora Ideal", "Mercado Primavera", "Empório da Serra", "Comercial Bom Preço", "Mercado Nacional", "Supermercado Estrela", "Atacado Mineiro", "Mercado Santa Clara", "Comercial Vitória", "Empório das Gerais", "Mercado Central Park", "Supermercado Imperial", "Comercial Nova Era"];
const demoPortfolioCustomers = demoCustomerNames.map((name, index) => ({ id: 600 + index, legal_name: `${name} Ltda`, trade_name: name, cnpj: `9000000000${String(index + 1).padStart(4, "0")}`, phone: `3299000${String(1000 + index)}`, email: `compras${index + 1}@carteira.demo`, address: `Rua Comercial, ${100 + index} — Juiz de Fora/MG`, active: true, statusCadastro: "APROVADO" }));
const mockCustomers: MockRecord[] = [...structuredClone(data.customers), ...demoPortfolioCustomers];
let currentMockUser = { id: data.login.representante.id, name: data.login.representante.nome, admin: false };

const wait = () => new Promise((resolve) => setTimeout(resolve, 250));
const bodyOf = (options: ApiOptions) => options.body ? JSON.parse(String(options.body)) as MockRecord : {};
const queryOf = (path: string) => new URLSearchParams(path.split("?")[1] || "");
const pathnameOf = (path: string) => path.split("?")[0];
const methodOf = (options: ApiOptions) => String(options.method || "GET").toUpperCase();
const normalized = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const brDateValue = (value: unknown) => { const [day, month, year] = String(value || "").split("/").map(Number); return year && month && day ? new Date(year, month - 1, day).getTime() : 0; };
const nowText = () => new Date().toLocaleString("pt-BR");

function pageOf<T>(rows: T[], path: string) {
  const query = queryOf(path), pagina = Math.max(1, Number(query.get("pagina") || query.get("page") || 1)), tamanho = Math.min(200, Math.max(1, Number(query.get("tamanho") || query.get("size") || 50)));
  return { total: rows.length, pagina, tamanho, itens: rows.slice((pagina - 1) * tamanho, pagina * tamanho) };
}
function ordersInPeriod(path: string) {
  const query = queryOf(path), start = brDateValue(query.get("de")), end = brDateValue(query.get("ate")), status = normalized(query.get("status"));
  return orders.filter((order) => { const value = brDateValue(order.dataPedido); return (!start || value >= start) && (!end || value <= end) && (!status || normalized(order.status) === status); });
}
function progress(goal: unknown, realized: unknown) { const target = goal == null ? null : Number(goal), done = Number(realized || 0); return { enabled: target != null && target > 0, goal: target, realized: done, missing: target == null ? 0 : Math.max(0, target - done), percent: target && target > 0 ? (done / target) * 100 : 0 }; }
function performance(record: MockRecord | undefined) { return record ? { sales: progress(record.sales_goal, record.sales_realized), new_customers: progress(record.new_customers_goal, record.new_customers_realized), customer_positivation: progress(record.positivation_goal, record.positivation_realized), portfolio: { customers: Number(record.portfolio_customers || 0), attended: Number(record.portfolio_attended || 0) } } : undefined; }

function toProposal(order: MockRecord) {
  return {
    id: Number(order.idPedido), order_number: Number(order.idPedido), status: normalized(order.status).replace(/\s+/g, "_"), company_id: Number(order.idEmpresa), company_name: String(order.empresaNome), customer_name: String(order.clienteRazaoSocial), customer_trade_name: order.clienteNomeFantasia,
    customer_cnpj: order.clienteDocumento, seller_name: currentMockUser.name, order_type: String(order.tipoPedido), created_at: String(order.dataPedido), payment_terms: order.condPagtoDescricao, freight_type: order.frete, delivery_type: order.formatoEntrega, scheduled_delivery_date: order.dataProgramada,
    delivery_forecast: order.entregaPrevista, lead_time_days: order.leadTimeDias, purchase_order: order.nroPedidoCliente, industry_order_number: order.nroPedidoEmpresa, invoice_number: order.nfNumero, billing_date: order.dtFaturamento, delivered_date: order.dtEntrega, notes: order.observacoes,
    discount_percent: order.descontoPercentual, discount_on: order.descontoEm, tax_operator_invoice: order.operadorFiscal, invoice_type: order.faturamentoPercentual === 0 ? "Sem Nota" : `${order.faturamentoPercentual}% Nota`, has_invoice_pdf: Boolean(order.nfNumero), gross_value: order.valorBruto, net_value: order.valorLiquido,
    items: (order.itens || []).map((item: MockRecord) => ({ id: item.idItem, product_id: item.idProduto, name: item.descricao, code: data.products.find((product) => product.idTabela === order.idTabela && product.idProduto === item.idProduto)?.codigo || String(item.idProduto), unit: item.unidade, quantity: item.quantidade, negotiated_price: item.precoUnitario })),
  };
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/([\\()])/g, "\\$1");
}

function buildOrderPdf(order: MockRecord) {
  const commands: string[] = [];
  const line = (text: unknown, x: number, y: number, size = 10, bold = false) => {
    commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`);
  };
  line("HIPERSALES - PEDIDO DE VENDA", 42, 800, 17, true);
  line(`Pedido: ${order.idPedido}    Data: ${order.dataPedido}    Status: ${order.status}`, 42, 775, 10, true);
  line(`Empresa: ${order.empresaNome}`, 42, 752);
  line(`Cliente: ${order.clienteRazaoSocial}`, 42, 735);
  line(`CNPJ: ${order.clienteDocumento}    Tabela: ${order.tabelaDescricao}`, 42, 718);
  line(`Pagamento: ${order.condPagtoDescricao || "Sem condicao"}    Frete: ${order.frete}`, 42, 701);
  line("ITENS", 42, 670, 11, true);
  line("Codigo / Produto", 42, 650, 9, true);
  line("Qtd.", 355, 650, 9, true);
  line("Unitario", 410, 650, 9, true);
  line("Total", 500, 650, 9, true);
  let y = 630;
  for (const item of order.itens || []) {
    const code = data.products.find((product) => product.idTabela === order.idTabela && product.idProduto === item.idProduto)?.codigo || item.idProduto;
    line(`${code} - ${String(item.descricao).slice(0, 43)}`, 42, y, 8);
    line(item.quantidade, 355, y, 8);
    line(Number(item.precoUnitario).toFixed(2), 410, y, 8);
    line(Number(item.total).toFixed(2), 500, y, 8);
    y -= 18;
  }
  line(`Valor bruto: R$ ${Number(order.valorBruto || 0).toFixed(2)}`, 360, y - 18, 10);
  line(`Valor liquido: R$ ${Number(order.valorLiquido || 0).toFixed(2)}`, 360, y - 38, 11, true);
  if (order.observacoes) {
    line("Observacoes", 42, y - 65, 10, true);
    line(String(order.observacoes).slice(0, 85), 42, y - 83, 8);
  }
  line("Documento de demonstracao gerado pelo mock local.", 42, 35, 8);

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function createOrder(payload: MockRecord) {
  const customer = mockCustomers.find((item) => item.id === Number(payload.idCliente));
  if (!customer?.active) throw new Error("Este cliente ainda não foi aprovado e não pode receber pedidos.");
  const table = data.priceTables.find((item) => item.idTabela === Number(payload.idTabela));
  if (!table || table.idEmpresa !== Number(payload.idEmpresa)) throw new Error("A tabela de preço não pertence à empresa selecionada.");
  if (!Array.isArray(payload.itens) || !payload.itens.length) throw new Error("Inclua pelo menos um produto no pedido.");
  const items = payload.itens.map((line: MockRecord, index: number) => {
    const product = data.products.find((item) => item.idTabela === table.idTabela && item.idProduto === Number(line.idProduto));
    if (!product) throw new Error(`O produto informado no item ${index + 1} não pertence à tabela selecionada.`);
    const quantity = Number(line.quantidade), price = Number(line.valorUnitario || product.precoUnitario);
    if (!(quantity > 0)) throw new Error(`A quantidade do item ${index + 1} deve ser maior que zero.`);
    return { idItem: Date.now() + index, idProduto: product.idProduto, descricao: product.descricao, unidade: product.unidade, quantidade: quantity, precoUnitario: price, precoComIpi: product.precoComIpi, valorTabela: product.precoUnitario, statusValidacao: price < product.precoUnitario ? "ABAIXO DA TABELA" : "OK", total: price * quantity };
  });
  const total = items.reduce((sum: number, item: MockRecord) => sum + item.total, 0);
  if (payload.tipoPedido !== "Bonificacao" && total < Number(table.pedidoMinimo || 0)) throw new Error(`O pedido não atingiu o mínimo de ${Number(table.pedidoMinimo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
  const divergent = items.some((item: MockRecord) => item.statusValidacao !== "OK");
  return {
    idPedido: Math.max(0, ...orders.map((order) => Number(order.idPedido))) + 1, dataPedido: new Date().toLocaleDateString("pt-BR"), status: "EM ANÁLISE", tipoPedido: payload.tipoPedido || "Venda", faturamentoPercentual: payload.faturamentoPercentual ?? 100,
    idEmpresa: table.idEmpresa, empresaNome: table.empresaNome, idCliente: customer.id, clienteRazaoSocial: customer.legal_name, clienteNomeFantasia: customer.trade_name, clienteDocumento: customer.cnpj, idTabela: table.idTabela, tabelaDescricao: table.descricao, frete: table.frete,
    idCondPagto: payload.tipoPedido === "Bonificacao" ? null : (payload.idCondPagto || table.idCondPagto), condPagtoDescricao: payload.tipoPedido === "Bonificacao" ? null : (table.condicoesPagamento.find((term) => term.idCondPagto === Number(payload.idCondPagto))?.descricao || table.condPagtoDescricao),
    formatoEntrega: payload.formatoEntrega || "Imediata", dataProgramada: payload.dataProgramada || null, leadTimeDias: table.prazoEntregaDias, entregaPrevista: payload.dataProgramada || new Date(Date.now() + table.prazoEntregaDias * 86400000).toLocaleDateString("pt-BR"), observacoes: payload.observacoes || "", nroPedidoCliente: payload.numeroPedidoCliente || null,
    operadorFiscal: table.operadorFiscal === "SIM", descontoEm: table.descontoEm || null, descontoPercentual: Number(table.percDesconto || 0), origem: "API", validacaoPreco: divergent ? "DIVERGENTE" : "OK", conferencia: divergent ? "DIVERGENTE" : "CONFERIDO", valorBruto: total, valorLiquido: total, itens: items,
  };
}
const customerStatus = (customer: MockRecord) => normalized(customer.statusCadastro).replace(/\s+/g, "_");

export async function mockLogin(usuario: string, senha: string) {
  await wait();
  if (usuario === "admin" && senha === "admin123") { currentMockUser = { id: 1, name: "Administrador Demo", admin: true }; return { accessToken: "mock-admin-token", usuario: "admin", admin: true }; }
  if (usuario !== data.login.usuario || senha !== data.login.senha) throw new Error("Use demo / demo123 ou admin / admin123 no ambiente de demonstração.");
  currentMockUser = { id: data.login.representante.id, name: data.login.representante.nome, admin: false };
  return { accessToken: "mock-access-token", usuario: data.login.usuario, admin: false, representante: data.login.representante };
}

export async function mockApi<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  await wait();
  const pathname = pathnameOf(path), method = methodOf(options);
  if (pathname === "/api/saude") return { status: "ok", versao: "1.0.0", banco: "mock-local", ambiente: "mock" } as T;

  if ((pathname === "/api/customers" || pathname === "/api/admin/customers") && method === "GET") {
    const query = queryOf(path), search = normalized(query.get("busca")), status = normalized(query.get("status")).replace(/\s+/g, "_");
    const rows = mockCustomers.filter((customer) => (!search || normalized(`${customer.legal_name} ${customer.trade_name} ${customer.cnpj}`).includes(search)) && (!status || customerStatus(customer) === status));
    return { customers: structuredClone(rows) } as T;
  }
  if (pathname === "/api/customer-ids") return { total: mockCustomers.length, geradoEm: nowText(), ids: mockCustomers.map((customer) => customer.id) } as T;
  if (pathname === "/api/customer-requests" && method === "POST") {
    const payload = bodyOf(options);
    if (mockCustomers.some((customer) => digits(customer.cnpj) === digits(payload.cnpj))) throw new Error("Este CPF/CNPJ já existe. Procure o cliente na sua carteira ou solicite o vínculo ao escritório.");
    const customer = { id: Math.max(...mockCustomers.map((item) => Number(item.id))) + 1, legal_name: payload.legal_name, trade_name: payload.trade_name || null, cnpj: payload.cnpj, state_registration: payload.state_registration || null, phone: payload.phone_1 || null, email: payload.purchase_email || null, address: [payload.address, payload.address_number, payload.neighborhood, payload.city, payload.state].filter(Boolean).join(", "), active: false, status: "aguardando_aprovacao", statusCadastro: "AGUARDANDO APROVACAO", rejection_reason: null, form_payload: structuredClone(payload) };
    mockCustomers.unshift(customer);
    return { id: customer.id, message: "Cliente cadastrado e vinculado ao representante. Aguarda aprovação do escritório.", customer: structuredClone(customer) } as T;
  }
  if (pathname === "/api/integrations/cnpj") return { legal_name: "Empresa Consultada no Mock Ltda", trade_name: "Empresa Mock", state_registration: "123.456.789.110", phone: "11988887777", email: "compras@empresamock.test", street: "Rua do Ambiente Web", number: "8081", neighborhood: "Centro", city: "São Paulo", state: "SP", zip_code: "01001000", _sources: ["Mock HiperSales"] } as T;

  if (pathname === "/api/price-tables") return { itens: structuredClone(data.priceTables) } as T;
  if (pathname === "/api/payment-terms") return Array.from(new Map(data.priceTables.flatMap((table) => table.condicoesPagamento).map((term) => [term.idCondPagto, { id: term.idCondPagto, descricao: term.descricao }])).values()) as T;
  if (pathname === "/api/order-products") {
    const query = queryOf(path), companyId = Number(query.get("idEmpresa")), tableId = Number(query.get("idTabela")), search = normalized(query.get("busca"));
    const found = data.products.filter((item) => (!companyId || item.idEmpresa === companyId) && (!tableId || item.idTabela === tableId) && (!search || normalized(`${item.codigo} ${item.descricao}`).includes(search)));
    return structuredClone(pageOf(found, path)) as T;
  }
  if (pathname === "/api/proposals") return { proposals: structuredClone(ordersInPeriod(path).map(toProposal)) } as T;
  const orderPdfMatch = pathname.match(/^\/api\/proposals\/(\d+)\/pdf$/);
  if (orderPdfMatch) {
    const order = orders.find((item) => Number(item.idPedido) === Number(orderPdfMatch[1]));
    if (!order) throw new Error("Pedido não encontrado.");
    return { filename: `pedido-venda-${order.idPedido}.pdf`, mimeType: "application/pdf", content: buildOrderPdf(order) } as T;
  }
  const proposalMatch = pathname.match(/^\/api\/proposals\/(\d+)$/);
  if (proposalMatch) { const order = orders.find((item) => Number(item.idPedido) === Number(proposalMatch[1])); if (!order) throw new Error("Pedido não encontrado."); return toProposal(order) as T; }
  if (pathname === "/api/orders" && method === "POST") {
    const key = new Headers(options.headers).get("Idempotency-Key") || "", repeated = key ? idempotentOrders.get(key) : undefined;
    if (repeated) return { mensagem: "Pedido já registrado anteriormente.", repetido: true, pedido: structuredClone(repeated) } as T;
    const order = createOrder(bodyOf(options)); orders.unshift(order); if (key) idempotentOrders.set(key, order);
    return { mensagem: "Pedido registrado com status EM ANÁLISE.", repetido: false, pedido: structuredClone(order) } as T;
  }
  const orderMatch = pathname.match(/^\/api\/orders\/(\d+)(\/status)?$/);
  if (orderMatch) { const order = orders.find((item) => Number(item.idPedido) === Number(orderMatch[1])); if (!order) throw new Error("Pedido não encontrado."); return (orderMatch[2] ? { idPedido: order.idPedido, status: order.status, dataPedido: order.dataPedido, entregaPrevista: order.entregaPrevista, nfNumero: order.nfNumero, dtFaturamento: order.dtFaturamento, dtEntrega: order.dtEntrega } : structuredClone(order)) as T; }

  if (pathname === "/api/sales") {
    const periodOrders = ordersInPeriod(path);
    const group = (key: "status" | "empresaNome") => Array.from(new Set(periodOrders.map((order) => order[key]))).map((value) => { const rows = periodOrders.filter((order) => order[key] === value); return { ...(key === "status" ? { status: value } : { empresaNome: value, idEmpresa: rows[0]?.idEmpresa }), qtdPedidos: rows.length, valorTotal: rows.reduce((sum, order) => sum + Number(order.valorLiquido || 0), 0) }; });
    return { resumo: { qtdPedidos: periodOrders.length, valorTotal: periodOrders.reduce((sum, order) => sum + Number(order.valorLiquido || 0), 0) }, porStatus: group("status"), porEmpresa: group("empresaNome"), pedidos: structuredClone(periodOrders) } as T;
  }

  if (pathname === "/api/notifications/unread-count") return { unread_count: notifications.filter((item) => !item.read_at).length } as T;
  if (pathname === "/api/notifications") { const rows = queryOf(path).get("somenteNaoLidas") === "true" ? notifications.filter((item) => !item.read_at) : notifications; return { notifications: structuredClone(rows) } as T; }
  if (pathname === "/api/notifications/read-all" && method === "POST") { notifications.forEach((item) => { item.read_at ||= nowText(); }); return { unread_count: 0 } as T; }
  const notificationMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (notificationMatch && method === "PATCH") { const item = notifications.find((row) => row.id === Number(notificationMatch[1])); if (item) item.read_at ||= nowText(); return { unread_count: notifications.filter((row) => !row.read_at).length } as T; }
  if (pathname === "/api/mobile/push-token") return { registrado: method === "POST", removidos: method === "DELETE" ? 1 : undefined } as T;

  const reasons = ["Produto avariado", "Divergência de produto", "Divergência de quantidade", "Falta de produto no pedido", "Divergência de preços", "Problemas com a nota fiscal", "Problemas com o boleto", "Pagamento de verbas", "Descontos não concedidos", "Devolução de mercadorias", "Atraso na entrega", "Cancelamento de pedido", "Outros motivos"];
  if (pathname === "/api/occurrences/reasons") return { itens: reasons.map((reason, index) => ({ id: index + 1, reason })) } as T;
  if (pathname === "/api/occurrences" && method === "GET") {
    const query = queryOf(path), status = query.get("status"), search = normalized(query.get("q"));
    const visible = occurrences.filter((item) => (currentMockUser.admin || item.seller_id === currentMockUser.id) && (!status || item.status === status) && (!search || normalized(`${item.id} ${item.customer_name} ${item.customer_cnpj} ${item.reason} ${item.description}`).includes(search)));
    return { occurrences: structuredClone(visible) } as T;
  }
  if (pathname === "/api/occurrences" && method === "POST") {
    const payload = bodyOf(options), customer = mockCustomers.find((item) => item.id === Number(payload.customer_id));
    if (!customer?.active) throw new Error("Selecione um cliente aprovado da carteira.");
    const sellerId = currentMockUser.admin ? Number(payload.seller_id) : currentMockUser.id, seller = data.users.find((item) => item.id === sellerId), id = Math.max(0, ...occurrences.map((item) => Number(item.id))) + 1, createdAt = nowText(), reasonId = Number(payload.reason_id);
    const occurrence = { id, seller_id: sellerId, seller_name: seller?.name || currentMockUser.name, customer_id: customer.id, customer_name: customer.trade_name || customer.legal_name, customer_cnpj: customer.cnpj, reason_id: reasonId, reason: reasons[reasonId - 1] || String(payload.reason || ""), description: payload.description, status: "aberta", resolution: null, priority: payload.priority || "media", order_id: payload.order_id || null, company_id: payload.company_id || null, created_at: createdAt, attachments: (payload.attachments || []).map((file: MockRecord, index: number) => ({ id: Date.now() + index, filename: file.name, mimetype: file.mime, size: Math.ceil(String(file.data_base64 || "").length * 0.75) })), timeline: [{ id: Date.now(), title: "Ocorrência registrada", notes: "Relato enviado pelo aplicativo.", created_at: createdAt, created_by_name: seller?.name || currentMockUser.name }] };
    occurrences.unshift(occurrence); return structuredClone(occurrence) as T;
  }
  const occurrenceDetailMatch = pathname.match(/^\/api\/occurrences\/(\d+)$/);
  if (occurrenceDetailMatch) { const occurrence = occurrences.find((row) => row.id === Number(occurrenceDetailMatch[1])); if (!occurrence) throw new Error("Ocorrência não encontrada."); return structuredClone(occurrence) as T; }
  const adminOccurrenceMatch = pathname.match(/^\/api\/admin\/occurrences\/(\d+)$/);
  if (adminOccurrenceMatch && method === "PATCH") {
    const item = occurrences.find((row) => row.id === Number(adminOccurrenceMatch[1])); if (!item) throw new Error("Ocorrência não encontrada."); const payload = bodyOf(options);
    Object.assign(item, { status: payload.status, resolution: payload.resolution, priority: payload.priority, responsible_user_id: payload.responsible_user_id || null, due_at: payload.due_at || null, order_id: payload.order_id || null, company_id: payload.company_id || null, resolved_at: ["recusada", "solucionada"].includes(payload.status) ? nowText() : null });
    item.timeline.push({ id: Date.now(), title: String(payload.status || "").replaceAll("_", " "), notes: payload.resolution, created_at: nowText(), created_by_name: currentMockUser.name }); return structuredClone(item) as T;
  }

  if (pathname === "/api/goals/my") {
    const query = queryOf(path), year = Number(query.get("year") || new Date().getFullYear()), month = Number(query.get("month") || new Date().getMonth() + 1), record = goalRecords.find((item) => item.year === year && item.month === month && item.seller_id === currentMockUser.id);
    return { year, month, available: Boolean(record), goals: performance(record) } as T;
  }
  if (pathname === "/api/admin/executive-dashboard") return { summary: { orders: orders.length, revenue: orders.reduce((sum, order) => sum + Number(order.valorLiquido || 0), 0), customers: mockCustomers.length, products: data.products.length } } as T;
  throw new Error(`Rota não disponível na API definitiva: ${method} ${pathname}`);
}
