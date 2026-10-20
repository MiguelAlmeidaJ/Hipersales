import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { SessionProvider } from "@/contexts/session-context";
import { NotificationsProvider } from "@/contexts/notifications-context";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>O HiperSales encontrou um problema</Text>
      <Text style={styles.errorText}>Nenhum dado foi apagado. Tente abrir esta tela novamente.</Text>
      {__DEV__ ? <Text style={styles.errorDetail}>{error.message}</Text> : null}
      <Pressable onPress={retry} style={styles.retry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <NotificationsProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </NotificationsProvider>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.canvas },
  errorTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" },
  errorText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9 },
  errorDetail: { color: colors.danger, fontSize: 11, textAlign: "center", marginTop: 12 },
  retry: { borderRadius: 14, backgroundColor: colors.brand, paddingHorizontal: 22, paddingVertical: 14, marginTop: 22 },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
