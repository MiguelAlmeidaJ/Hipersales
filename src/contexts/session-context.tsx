import type { PublicUser } from "@/types/session";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";

import { api, ApiError, loginExternal, setSessionToken, setUnauthorizedHandler } from "@/lib/api";
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

const profileKey="hipersales_api_profile";
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
    await SecureStore.deleteItemAsync(profileKey).catch(()=>undefined);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    const raw=await SecureStore.getItemAsync(profileKey);
    if(!raw){await clearSession();return;}
    await api("/api/customers");
    setUser(JSON.parse(raw) as PublicUser);
    setStatus("authenticated");
  }, [clearSession]);

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

  const login=useCallback(async(username:string,password:string)=>{
    const response=await loginExternal(username,password);
    const profile:PublicUser={id:response.representante?.id||0,name:response.representante?.nome||response.usuario,email:response.usuario,role:response.admin?"admin":"seller",tenant_id:1,active:true,must_change_password:false};
    await storeSession(response.accessToken);
    await SecureStore.setItemAsync(profileKey,JSON.stringify(profile));
    setSessionToken(response.accessToken);setUser(profile);setStatus("authenticated");
  },[]);

  const logout = useCallback(async () => {
    try {
      await beforeLogoutHandler?.().catch(() => undefined);
      // A API externa não possui endpoint de logout.
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
