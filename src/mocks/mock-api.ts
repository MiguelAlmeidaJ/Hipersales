import data from "@/mocks/api-data.json";

type ApiOptions = RequestInit & { timeoutMs?: number };
type MockOrder = Record<string, any>;

const orders: MockOrder[] = data.orders.map((order) => structuredClone(order));
const idempotentOrders = new Map<string, MockOrder>();
const wait = () => new Promise((resolve) => setTimeout(resolve, 180));
const bodyOf = (options: ApiOptions) => options.body ? JSON.parse(String(options.body)) as Record<string, any> : {};
const queryOf = (path: string) => new URLSearchParams(path.split("?")[1] || "");
const pathnameOf = (path: string) => path.split("?")[0];

function toProposal(order: MockOrder) {
  return {
    id: Number(order.idPedido), order_number: Number(order.idPedido), status: String(order.status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_"),
    company_id: Number(order.idEmpresa), company_name: String(order.empresaNome), customer_name: String(order.clienteRazaoSocial), customer_trade_name: order.clienteNomeFantasia,
    customer_cnpj: order.clienteDocumento, seller_name: data.login.representante.nome, order_type: String(order.tipoPedido), created_at: String(order.dataPedido), payment_terms: order.condPagtoDescricao,
    freight_type: order.frete, delivery_type: order.formatoEntrega, scheduled_delivery_date: order.dataProgramada, delivery_forecast: order.entregaPrevista, lead_time_days: order.leadTimeDias,
    purchase_order: order.nroPedidoCliente, notes: order.observacoes, discount_percent: order.descontoPercentual, gross_value: order.valorBruto, net_value: order.valorLiquido,
    items: (order.itens || []).map((item: MockOrder) => ({ id: item.idItem, product_id: item.idProduto, name: item.descricao, code: String(item.idProduto), unit: item.unidade, quantity: item.quantidade, negotiated_price: item.precoUnitario })),
  };
}

function createOrder(payload: MockOrder): MockOrder {
  const customer = data.customers.find((item) => item.id === Number(payload.idCliente)) || data.customers[0];
  const table = data.priceTables.find((item) => item.idTabela === Number(payload.idTabela)) || data.priceTables[0];
  const items = (payload.itens || []).map((line: MockOrder, index: number) => {
    const product = data.products.find((item) => item.idProduto === Number(line.idProduto)) || data.products[0];
    const quantity = Number(line.quantidade);
    return { idItem: Date.now() + index, idProduto: product.idProduto, descricao: product.descricao, unidade: product.unidade, quantidade: quantity, precoUnitario: product.precoUnitario, precoComIpi: product.precoUnitario * 1.06, total: product.precoUnitario * quantity };
  });
  const total = items.reduce((sum: number, item: MockOrder) => sum + item.total, 0);
  return {
    idPedido: Math.max(...orders.map((order) => Number(order.idPedido)), 1000) + 1, dataPedido: new Date().toLocaleDateString("pt-BR"), status: "EM ANÁLISE", tipoPedido: payload.tipoPedido || "Venda", faturamentoPercentual: payload.faturamentoPercentual ?? 100,
    idEmpresa: table.idEmpresa, empresaNome: table.empresaNome, idCliente: customer.id, clienteRazaoSocial: customer.legal_name, clienteNomeFantasia: customer.trade_name, clienteDocumento: customer.cnpj,
    idTabela: table.idTabela, tabelaDescricao: table.descricao, frete: table.frete, idCondPagto: payload.idCondPagto || table.idCondPagto, condPagtoDescricao: table.condPagtoDescricao,
    formatoEntrega: payload.formatoEntrega || "Imediata", dataProgramada: payload.dataProgramada || null, leadTimeDias: table.prazoEntregaDias,
    entregaPrevista: payload.dataProgramada || new Date(Date.now() + table.prazoEntregaDias * 86400000).toLocaleDateString("pt-BR"), observacoes: payload.observacoes || "", nroPedidoCliente: payload.numeroPedidoCliente || null,
    origem: "API", valorBruto: total, descontoPercentual: 0, valorLiquido: total, itens: items,
  };
}

export async function mockLogin(usuario: string, senha: string) {
  await wait();
  if (usuario !== data.login.usuario || senha !== data.login.senha) throw new Error("Use usuário demo e senha demo123 no ambiente de demonstração.");
  return { accessToken: "mock-access-token", usuario: data.login.usuario, admin: false, representante: data.login.representante };
}

export async function mockApi<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  await wait();
  const pathname = pathnameOf(path);
  if (pathname === "/api/saude") return { status: "ok", ambiente: "mock" } as T;
  if (pathname === "/api/customers" || pathname === "/api/admin/customers") return { customers: structuredClone(data.customers) } as T;
  if (pathname === "/api/price-tables") return { itens: structuredClone(data.priceTables) } as T;
  if (pathname === "/api/order-products") { const query = queryOf(path), companyId = Number(query.get("idEmpresa")), tableId = Number(query.get("idTabela")); return { itens: structuredClone(data.products.filter((item) => item.idEmpresa === companyId && item.idTabela === tableId)) } as T; }
  if (pathname === "/api/proposals") return { proposals: orders.map(toProposal) } as T;
  const proposalMatch = pathname.match(/^\/api\/proposals\/(\d+)$/);
  if (proposalMatch) return toProposal(orders.find((order) => Number(order.idPedido) === Number(proposalMatch[1])) || orders[0]) as T;
  if (pathname === "/api/orders" && (options.method || "GET").toUpperCase() === "POST") {
    const key = new Headers(options.headers).get("Idempotency-Key") || "", repeated = key ? idempotentOrders.get(key) : undefined;
    if (repeated) return { mensagem: "Pedido já registrado anteriormente.", repetido: true, pedido: structuredClone(repeated) } as T;
    const order = createOrder(bodyOf(options)); orders.unshift(order); if (key) idempotentOrders.set(key, order);
    return { mensagem: "Pedido registrado com status EM ANÁLISE.", repetido: false, pedido: structuredClone(order) } as T;
  }
  const orderMatch = pathname.match(/^\/api\/orders\/(\d+)(\/status)?$/);
  if (orderMatch) { const order = orders.find((item) => Number(item.idPedido) === Number(orderMatch[1])) || orders[0]; return (orderMatch[2] ? { idPedido: order.idPedido, status: order.status, dataPedido: order.dataPedido, entregaPrevista: order.entregaPrevista } : structuredClone(order)) as T; }
  if (pathname === "/api/customer-requests") return { id: Date.now(), message: "Solicitação mock enviada para aprovação." } as T;
  if (pathname === "/api/integrations/cnpj") return { legal_name: "Empresa Consultada no Mock Ltda", trade_name: "Empresa Mock", state_registration: "123.456.789.110", phone: "11988887777", email: "compras@empresamock.test", street: "Rua do Ambiente Web", number: "8081", neighborhood: "Centro", city: "São Paulo", state: "SP", zip_code: "01001000" } as T;
  if (pathname === "/api/notifications/unread-count") return { unread_count: 2 } as T;
  if (pathname === "/api/notifications") return { notifications: [] } as T;
  if (pathname === "/api/notifications/read-all" || /\/api\/notifications\/\d+\/read$/.test(pathname)) return { unread_count: 0 } as T;
  if (pathname === "/api/mobile/push-token") return {} as T;
  if (pathname === "/api/admin/executive-dashboard") return { summary: { orders: orders.length, revenue: orders.reduce((sum, order) => sum + Number(order.valorLiquido || 0), 0), customers: data.customers.length, products: data.products.length } } as T;
  return {} as T;
}
