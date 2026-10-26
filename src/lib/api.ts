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
  return {
    url: `${apiUrl}${path.slice("/api".length)}`,
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

function externalRoute(path: string): string | null {
  const [pathname, query = ""] = path.split("?", 2);
  if (pathname === "/api/saude") return "/saude";
  if (pathname === "/api/customers" || pathname === "/api/admin/customers") return `/clientes${query ? `?${query}` : "?tamanho=200"}`;
  if (pathname === "/api/price-tables") return `/tabelas-preco${query ? `?${query}` : ""}`;
  if (pathname === "/api/order-products") return `/produtos${query ? `?${query}` : ""}`;
  if (pathname === "/api/orders" || pathname === "/api/proposals") return `/pedidos${query ? `?${query}` : ""}`;
  const orderMatch = pathname.match(/^\/api\/orders\/(\d+)(\/status)?$/);
  if (orderMatch) return `/pedidos/${orderMatch[1]}${orderMatch[2] || ""}`;
  const proposalMatch = pathname.match(/^\/api\/proposals\/(\d+)$/);
  if (proposalMatch) return `/pedidos/${proposalMatch[1]}`;
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
    gross_value: Number(row.valorBruto || 0), net_value: Number(row.valorLiquido || row.valorBruto || 0), items,
  };
}

export async function api<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  if(useMockApi)return mockApi<T>(path,options);
  ensureSecureProductionUrl();
  const route = externalRoute(path);
  if (!route) throw new ApiError("Funcionalidade ainda não adaptada à API externa.",0,"configuration");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);

  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
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
    if(path==="/api/customers"||path==="/api/admin/customers") return {customers:((data as any).itens||[]).map((c:any)=>({id:c.id,legal_name:c.razaoSocial,trade_name:c.nomeFantasia,cnpj:c.documento,phone:c.telefoneCompras1,email:c.emailCompras,active:c.statusCadastro==="APROVADO",statusCadastro:c.statusCadastro}))} as T;
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
