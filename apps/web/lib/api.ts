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

export async function api<T>(path: `/api/${string}`, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
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
