import type { MobileSessionResponse, PublicUser, SessionResponse } from "@hipersales/contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";

import { api, ApiError, setSessionToken, setUnauthorizedHandler } from "@/lib/api";
import { readStoredSession, removeStoredSession, storeSession } from "@/lib/session-storage";

type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";
type SessionContextValue = {
  status: SessionStatus;
  user: PublicUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  restore: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
let beforeLogoutHandler: (() => Promise<void>) | null = null;

export function setBeforeLogoutHandler(handler: (() => Promise<void>) | null) {
  beforeLogoutHandler = handler;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  const clearSession = useCallback(async () => {
    setSessionToken(null);
    await removeStoredSession();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    const response = await api<SessionResponse>("/api/me");
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const restore = useCallback(async () => {
    setStatus("loading");
    const token = await readStoredSession();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    setSessionToken(token);
    try {
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "unauthorized") await clearSession();
      else setStatus("unavailable");
    }
  }, [clearSession, refresh]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      restore().catch(() => { if (active) setStatus("unavailable"); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [restore]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void clearSession(); });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && status === "authenticated") refresh().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refresh, status]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api<MobileSessionResponse>("/api/mobile/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    await storeSession(response.session_token);
    setSessionToken(response.session_token);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await beforeLogoutHandler?.().catch(() => undefined);
      await api("/api/logout", { method: "POST" });
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({ status, user, login, logout, refresh, restore }), [status, user, login, logout, refresh, restore]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession deve ser usado dentro de SessionProvider.");
  return context;
}
