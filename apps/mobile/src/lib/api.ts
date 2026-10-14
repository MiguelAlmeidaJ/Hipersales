import { Platform } from "react-native";

const emulatorUrl = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
const defaultTimeoutMs = 15_000;
let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || emulatorUrl).replace(/\/$/, "");

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);

  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    const response = await fetch(`${apiUrl}${path}`, { ...fetchOptions, headers, signal: controller.signal });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "error" in data
          ? String(data.error)
          : response.status >= 500
            ? "O serviço está temporariamente indisponível."
            : "Não foi possível concluir a solicitação.";
      if (response.status === 401) unauthorizedHandler?.();
      throw new ApiError(message, response.status, response.status === 401 ? "unauthorized" : response.status >= 500 ? "server" : "client");
    }
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
