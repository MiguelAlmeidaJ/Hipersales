import type { PublicUser } from "@hipersales/contracts";

export type SessionUser = PublicUser;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function apiPath(path: `/api/${string}`): `/api/v1/${string}` {
  return `/api/v1/${path.slice("/api/".length)}`;
}

export async function api<T>(path: `/api/${string}`, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiPath(path), {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : "Erro na requisição";
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export async function downloadApiFile(path: `/api/${string}`, fallbackName: string): Promise<void> {
  const response = await fetch(apiPath(path), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}));
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : "Não foi possível gerar o arquivo.";
    throw new ApiError(message, response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
