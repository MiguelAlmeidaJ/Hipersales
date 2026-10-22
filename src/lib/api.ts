const defaultApiUrl = "https://api.hipersalesweb.com.br/api/v1";
const defaultTimeoutMs = 15_000;
const apiVersion = "v1";
let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

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

export async function loginExternal(usuario:string,senha:string):Promise<{accessToken:string;usuario:string;admin:boolean;representante?:{id:number;nome:string}}> {
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
  constructor(message: string, readonly status: number, readonly code: ApiErrorCode) {
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

export async function api<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  ensureSecureProductionUrl();
  const route = path === "/api/saude" ? "/saude" : path === "/api/customers" || path === "/api/admin/customers" ? "/clientes?tamanho=200" : null;
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
      if (typeof data === "object" && data !== null && "erro" in data && typeof (data as {erro?:{mensagem?:string}}).erro?.mensagem==="string") throw new ApiError((data as {erro:{mensagem:string}}).erro.mensagem,response.status,response.status===401?"unauthorized":"client");
      if (response.status === 401) unauthorizedHandler?.();
      throw new ApiError(message, response.status, response.status === 401 ? "unauthorized" : response.status >= 500 ? "server" : "client");
    }
    if(path==="/api/customers"||path==="/api/admin/customers") return {customers:((data as any).itens||[]).map((c:any)=>({id:c.id,legal_name:c.razaoSocial,trade_name:c.nomeFantasia,cnpj:c.documento,phone:c.telefoneCompras1,email:c.emailCompras,active:c.statusCadastro==="APROVADO",statusCadastro:c.statusCadastro}))} as T;
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
