import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "hipersales.session-token.v1";
const PROFILE_KEY = "hipersales_api_profile";
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let volatileProfile: string | null = null;

export async function readStoredSession(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(SESSION_KEY) ?? globalThis.sessionStorage?.getItem(SESSION_KEY) ?? null;
    return await SecureStore.getItemAsync(SESSION_KEY, secureOptions);
  } catch {
    return null;
  }
}

export async function storeSession(token: string, persistent = true): Promise<void> {
  if (Platform.OS === "web") {
    const storage = persistent ? globalThis.localStorage : globalThis.sessionStorage;
    const otherStorage = persistent ? globalThis.sessionStorage : globalThis.localStorage;
    otherStorage?.removeItem(SESSION_KEY);
    storage?.setItem(SESSION_KEY, token);
    return;
  }
  if (persistent) await SecureStore.setItemAsync(SESSION_KEY, token, secureOptions);
  else await SecureStore.deleteItemAsync(SESSION_KEY, secureOptions).catch(() => undefined);
}

export async function removeStoredSession(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      globalThis.sessionStorage?.removeItem(SESSION_KEY);
      globalThis.localStorage?.removeItem(SESSION_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY, secureOptions);
  } catch {
    // A sessão também é descartada em memória; falhas do cofre não bloqueiam o logout.
  }
}

export async function readStoredProfile(): Promise<string | null> {
  try {
    if (volatileProfile) return volatileProfile;
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(PROFILE_KEY) ?? globalThis.sessionStorage?.getItem(PROFILE_KEY) ?? null;
    }
    return await SecureStore.getItemAsync(PROFILE_KEY, secureOptions);
  } catch {
    return null;
  }
}

export async function storeProfile(profile: string, persistent = true): Promise<void> {
  volatileProfile = profile;

  if (Platform.OS === "web") {
    const storage = persistent ? globalThis.localStorage : globalThis.sessionStorage;
    const otherStorage = persistent ? globalThis.sessionStorage : globalThis.localStorage;
    otherStorage?.removeItem(PROFILE_KEY);
    storage?.setItem(PROFILE_KEY, profile);
    return;
  }

  if (persistent) await SecureStore.setItemAsync(PROFILE_KEY, profile, secureOptions);
  else await SecureStore.deleteItemAsync(PROFILE_KEY, secureOptions).catch(() => undefined);
}

export async function removeStoredProfile(): Promise<void> {
  volatileProfile = null;

  try {
    if (Platform.OS === "web") {
      globalThis.sessionStorage?.removeItem(PROFILE_KEY);
      globalThis.localStorage?.removeItem(PROFILE_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(PROFILE_KEY, secureOptions);
  } catch {
    // O perfil tambem e descartado em memoria; falhas do cofre nao bloqueiam o logout.
  }
}
