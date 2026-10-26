import { mockApi, mockLogin } from "@/mocks/mock-api";

const defaultApiUrl = "https://api.hipersalesweb.com.br/api/v1";
const defaultTimeoutMs = 15_000;
const apiVersion = "v1";
let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
export const useMockApi = process.env.EXPO_PUBLIC_USE_MOCK_API === "true";

function normalizeApiUrl(value: string): string {
  const url = value.replace(/\/$/, "");
  if (url.endsWith(`/api/${apiVersion}`)) return url;
  if (url.endsWith("/api")) return `${url}/${apiVersion}`;
  return `${url}/api/${apiVersion}`;
}

export const apiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL || defaultApiUrl);

export function authenticatedResource(path: `/api/${string}`) {
  const headers: Record<string, string> = {};
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  const route = externalRoute(path, "GET");
  return {
    url: `${apiUrl}${route ?? path.slice("/api".length)}`,
    headers,
  };
}

export type CnpjLookupData = Record<string, unknown> & {
  _sources?: string[];
};

async function fetchCnpjSource(url: string, headers?: Record<string, string>): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const record = payload as Record<string, unknown>;
    const nested = record.data;
    return nested && typeof nested === "object" ? nested as Record<string, unknown> : record;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupData> {
  if (useMockApi) return mockApi<CnpjLookupData>((`/api/integrations/cnpj?cnpj=${encodeURIComponent(cnpj)}`) as `/api/${string}`);

  const internal = authenticatedResource((`/api/integrations/cnpj?cnpj=${encodeURIComponent(cnpj)}`) as `/api/${string}`);
  const candidates: { name: string; request: Promise<Record<string, unknown> | null> }[] = [
    { name: "HiperSales", request: fetchCnpjSource(internal.url, internal.headers) },
    { name: "BrasilAPI", request: fetchCnpjSource(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`) },
  ];
  if (/^\d{14}$/.test(cnpj)) {
    candidates.push({ name: "OpenCNPJ", request: fetchCnpjSource(`https://kitana.opencnpj.com/cnpj/${cnpj}`) });
  }

  const settled = await Promise.all(candidates.map(async ({ name, request }) => ({ name, data: await request })));
  const found = settled.filter((result): result is { name: string; data: Record<string, unknown> } => Boolean(result.data));
  if (!found.length) throw new ApiError("CNPJ não encontrado nas fontes disponíveis. Você pode tentar novamente ou preencher os dados manualmente.", 404, "client", "CNPJ_NAO_ENCONTRADO");

  const merged: CnpjLookupData = {};
  for (const result of [...found].reverse()) {
    for (const [key, value] of Object.entries(result.data)) {
      if (value !== null && value !== undefined && value !== "") merged[key] = value;
    }
  }
  merged._sources = found.map((result) => result.name);
  return merged;
}

export async function loginExternal(usuario:string,senha:string):Promise<{accessToken:string;usuario:string;admin:boolean;representante?:{id:number;nome:string}}> {
  if(useMockApi)return mockLogin(usuario,senha);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(apiUrl+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({usuario,senha}),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new ApiError(data?.erro?.mensagem||"Não foi possível autenticar.",response.status,response.status===401?"unauthorized":"client");
    if(!data?.accessToken||!data?.usuario)throw new ApiError("Resposta de autenticação incompleta.",0,"server");
    return data;
  }catch(e){
    if(e instanceof ApiError)throw e;
    if(e instanceof Error&&e.name==="AbortError")throw new ApiError("A conexão demorou mais que o esperado.",0,"timeout");
    throw new ApiError("Não foi possível conectar à API. Verifique HTTPS e a disponibilidade do servidor.",0,"network");
  }finally{clearTimeout(timer);}
}
export type ApiErrorCode = "configuration" | "timeout" | "network" | "unauthorized" | "client" | "server";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: ApiErrorCode, readonly remoteCode?: string, readonly field?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function ensureSecureProductionUrl() {
  if (!__DEV__ && !apiUrl.startsWith("https://")) {
    throw new ApiError("A URL de produção da API deve usar HTTPS.", 0, "configuration");
  }
}

type ApiOptions = RequestInit & { timeoutMs?: number };

const orderErrorMessages: Record<string, string> = {
  CLIENTE_INVALIDO: "O cliente selecionado não pertence à carteira deste representante.",
  CLIENTE_NAO_APROVADO: "Este cliente ainda não foi aprovado pelo escritório e não pode receber pedidos.",
  EMPRESA_INVALIDA: "A empresa selecionada não está disponível para este pedido.",
  TABELA_INVALIDA: "A tabela de preço não está vigente ou não pertence à empresa selecionada.",
  PRAZO_INVALIDO: "A condição de pagamento não é válida para esta tabela.",
  PRODUTO_INVALIDO: "Um dos produtos não está disponível na tabela ou para este representante.",
  PEDIDO_MINIMO: "O valor do pedido não atingiu o mínimo exigido pela tabela de preço.",
  VALIDACAO: "Revise os campos e as quantidades informadas.",
  NAO_ENCONTRADO: "O pedido não foi encontrado ou não pertence a este representante.",
};

function withDefaultPageSize(pathname: string, query: string) {
  const params = new URLSearchParams(query);
  if (!params.has("tamanho")) params.set("tamanho", "200");
  return `${pathname}?${params.toString()}`;
}

function externalRoute(path: string, method = "GET"): string | null {
  const [pathname, query = ""] = path.split("?", 2);
  if (pathname === "/api/saude") return "/saude";
  if (pathname === "/api/customers" || pathname === "/api/admin/customers") return method === "GET" ? withDefaultPageSize("/clientes", query) : "/clientes";
  if (pathname === "/api/customer-requests") return "/clientes";
  if (pathname === "/api/customer-ids") return `/clientes/atendidos/ids${query ? `?${query}` : ""}`;
  if (pathname === "/api/price-tables") return `/tabelas-preco${query ? `?${query}` : ""}`;
  const priceTablePdfMatch = pathname.match(/^\/api\/price-tables\/(\d+)\/pdf$/);
  if (priceTablePdfMatch) return `/tabelas-preco/${priceTablePdfMatch[1]}/pdf`;
  if (pathname === "/api/payment-terms") return "/prazos";
  if (pathname === "/api/order-products") return withDefaultPageSize("/produtos", query);
  if (pathname === "/api/orders") return method === "GET" ? withDefaultPageSize("/pedidos", query) : "/pedidos";
  if (pathname === "/api/proposals") return withDefaultPageSize("/pedidos", query);
  if (pathname === "/api/sales") return `/vendas${query ? `?${query}` : ""}`;
  if (pathname === "/api/invoices") return withDefaultPageSize("/notas-fiscais", query);
  if (pathname === "/api/mobile/push-token") return `/mobile/push-token${query ? `?${query}` : ""}`;
  if (pathname === "/api/notifications" || pathname === "/api/notifications/unread-count" || pathname === "/api/notifications/read-all") {
    return `${pathname.slice("/api".length)}${query ? `?${query}` : ""}`;
  }
  const notificationMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (notificationMatch) return `/notifications/${notificationMatch[1]}/read`;
  const orderMatch = pathname.match(/^\/api\/orders\/(\d+)(\/status)?$/);
  if (orderMatch) return `/pedidos/${orderMatch[1]}${orderMatch[2] || ""}`;
  const proposalMatch = pathname.match(/^\/api\/proposals\/(\d+)$/);
  if (proposalMatch) return `/pedidos/${proposalMatch[1]}`;
  const invoiceMatch = pathname.match(/^\/api\/(?:invoices\/(\d+)\/pdf|proposals\/(\d+)\/invoice-pdf)$/);
  if (invoiceMatch) return `/notas-fiscais/${invoiceMatch[1] || invoiceMatch[2]}/pdf`;
  const invoiceDetailMatch = pathname.match(/^\/api\/invoices\/(\d+)$/);
  if (invoiceDetailMatch) return `/notas-fiscais/${invoiceDetailMatch[1]}`;
  if (pathname === "/api/support/activity-branches") return "/apoio/ramos-atividade";
  if (pathname === "/api/support/service-regions") return "/apoio/regioes-atendimento";
  if (pathname === "/api/support/cities") return `/apoio/municipios${query ? `?${query}` : ""}`;
  return null;
}

function normalizedStatus(value: unknown) {
  const status = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, "_");
  return status === "aprovado" ? "pedido_aprovado" : status;
}

function normalizeOrder(row: any) {
  const items = (row.itens || []).map((item: any) => ({
    id: Number(item.idItem || item.id || 0), product_id: Number(item.idProduto || item.id || 0),
    name: String(item.descricao || item.nome || "Produto"), code: String(item.codigo || item.idProduto || ""), unit: item.unidade,
    quantity: Number(item.quantidade || 0), negotiated_price: Number(item.precoUnitario || item.preco || 0),
  }));
  return {
    id: Number(row.idPedido || row.id || 0), order_number: Number(row.idPedido || row.numeroPedido || row.id || 0), status: normalizedStatus(row.status),
    company_id: Number(row.idEmpresa || 0), company_name: String(row.empresaNome || row.empresa || ""),
    customer_name: String(row.clienteRazaoSocial || row.clienteNome || ""), customer_trade_name: row.clienteNomeFantasia,
    customer_cnpj: row.clienteDocumento, seller_name: String(row.representanteNome || row.representante || ""),
    order_type: String(row.tipoPedido || "Venda"), created_at: String(row.dataPedido || ""), payment_terms: row.condPagtoDescricao,
    freight_type: row.frete, delivery_type: row.formatoEntrega, scheduled_delivery_date: row.dataProgramada,
    delivery_forecast: row.entregaPrevista, lead_time_days: Number(row.leadTimeDias || 0), purchase_order: row.nroPedidoCliente,
    industry_order_number: row.nroPedidoEmpresa, invoice_number: row.nfNumero, billing_date: row.dtFaturamento,
    delivered_date: row.dtEntrega, notes: row.observacoes, discount_percent: Number(row.descontoPercentual || 0),
    has_invoice_pdf: Boolean(row.temPdf || row.hasInvoicePdf),
    gross_value: Number(row.valorBruto || 0), net_value: Number(row.valorLiquido || row.valorBruto || 0), items,
  };
}

function normalizeCustomer(row: any) {
  return {
    id: Number(row.id || 0), legal_name: String(row.razaoSocial || ""), trade_name: row.nomeFantasia || null,
    cnpj: String(row.documento || ""), state_registration: row.inscricaoEstadual || null,
    address: [row.logradouro, row.numero, row.complemento, row.bairro, row.cidade, row.uf, row.cep].filter(Boolean).join(", "),
    phone: row.telefoneCompras1 || row.telefoneCompras2 || null, email: row.emailCompras || null,
    active: row.statusCadastro === "APROVADO", status: normalizedStatus(row.statusCadastro),
    statusCadastro: row.statusCadastro, rejection_reason: row.motivoRejeicao || null, linked_at: row.vinculadoEm || null,
  };
}

function normalizeNotification(row: any) {
  const orderId = Number(row.idPedido || 0);
  const customerId = Number(row.idCliente || 0);
  return {
    id: Number(row.id || 0), kind: String(row.tipo || ""), title: String(row.titulo || "Atualizacao"),
    body: String(row.mensagem || ""), read_at: row.lidaEm || (row.lida ? row.criadaEm : null),
    created_at: String(row.criadaEm || ""), route: orderId ? "/(app)/orders" : customerId ? "/(app)/customers" : null,
    order_id: orderId || null, customer_id: customerId || null,
  };
}

function mapCustomerPayload(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return body;
  const source = JSON.parse(body) as Record<string, unknown>;
  const mapped = {
    razaoSocial: source.legal_name, nomeFantasia: source.trade_name, documento: source.cnpj,
    inscricaoEstadual: source.state_registration, logradouro: source.address, numero: source.address_number,
    bairro: source.neighborhood, cep: source.zip_code, uf: source.state, idMunicipio: source.municipality_id,
    enderecoEntrega: source.delivery_address, advertenciasRecebimento: source.delivery_warnings,
    respCompras: source.contact_person || source.buyer_contact,
    telefoneCompras1: source.phone_1 || source.buyer_phone_1, telefoneCompras2: source.phone_2 || source.buyer_phone_2,
    emailCompras: source.purchase_email || source.buyer_email, emailFinanceiro: source.billing_email || source.finance_email,
    observacao: source.notes || source.additional_notes,
    idRepresentante: Array.isArray(source.seller_ids) ? source.seller_ids[0] : source.id_representative,
  };
  return JSON.stringify(Object.fromEntries(Object.entries(mapped).filter(([, value]) => value !== "" && value !== null && value !== undefined)));
}

export async function api<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  if(useMockApi)return mockApi<T>(path,options);
  ensureSecureProductionUrl();
  const method = String(options.method || "GET").toUpperCase();
  const route = externalRoute(path, method);
  if (!route) throw new ApiError("Funcionalidade ainda não adaptada à API externa.",0,"configuration");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);

  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    if (path.split("?")[0] === "/api/customer-requests" || (path.split("?")[0] === "/api/admin/customers" && method === "POST")) {
      fetchOptions.body = mapCustomerPayload(fetchOptions.body);
    }
    const response = await fetch(`${apiUrl}${route}`, { ...fetchOptions, headers, signal: controller.signal });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "error" in data
          ? String(data.error)
          : response.status >= 500
            ? "O serviço está temporariamente indisponível."
            : "Não foi possível concluir a solicitação.";
      if (typeof data === "object" && data !== null && "erro" in data) {
        const errorData=(data as {erro?:{codigo?:string;mensagem?:string;campo?:string}}).erro;
        const remoteCode=String(errorData?.codigo||"");
        const messageText=orderErrorMessages[remoteCode] || errorData?.mensagem;
        if(messageText){if(response.status===401)unauthorizedHandler?.();throw new ApiError(errorData?.campo?`${messageText} Campo: ${errorData.campo}.`:messageText,response.status,response.status===401?"unauthorized":"client",remoteCode,errorData?.campo);}
      }
      if (response.status === 401) unauthorizedHandler?.();
      throw new ApiError(message, response.status, response.status === 401 ? "unauthorized" : response.status >= 500 ? "server" : "client");
    }
    const pathname = path.split("?")[0];
    if ((pathname === "/api/customers" || pathname === "/api/admin/customers") && method === "GET") return {customers:((data as any).itens||[]).map(normalizeCustomer)} as T;
    if ((pathname === "/api/customer-requests" || pathname === "/api/admin/customers") && method === "POST") {
      const result = data as any;
      return { id: Number(result.cliente?.id || 0), message: result.mensagem, customer: result.cliente } as T;
    }
    if (pathname === "/api/notifications") return {notifications:((data as any).itens||[]).map(normalizeNotification)} as T;
    if (pathname === "/api/notifications/unread-count") return {unread_count:Number((data as any).naoLidas ?? (data as any).count ?? 0)} as T;
    if (/^\/api\/notifications\/\d+\/read$/.test(pathname)) return { unread_count: undefined, ...(data as object) } as T;
    if(path.split("?")[0]==="/api/proposals") return {proposals:(((data as any).itens||(Array.isArray(data)?data:[]))).map(normalizeOrder)} as T;
    if(/^\/api\/proposals\/\d+$/.test(path)) return normalizeOrder(data) as T;
    return data as T;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new ApiError("A conexão demorou mais que o esperado. Tente novamente.", 0, "timeout");
    }
    throw new ApiError("Não foi possível conectar. Verifique sua internet e tente novamente.", 0, "network");
  } finally {
    clearTimeout(timer);
  }
}
