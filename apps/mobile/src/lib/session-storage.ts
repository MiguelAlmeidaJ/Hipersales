import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "hipersales.session-token.v1";
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function readStoredSession(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.sessionStorage?.getItem(SESSION_KEY) ?? null;
    return await SecureStore.getItemAsync(SESSION_KEY, secureOptions);
  } catch {
    return null;
  }
}

export async function storeSession(token: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.sessionStorage?.setItem(SESSION_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, token, secureOptions);
}

export async function removeStoredSession(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      globalThis.sessionStorage?.removeItem(SESSION_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY, secureOptions);
  } catch {
    // A sessão também é descartada em memória; falhas do cofre não bloqueiam o logout.
  }
}
