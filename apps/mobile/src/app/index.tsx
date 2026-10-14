import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";

void SplashScreen.preventAutoHideAsync();

export default function IndexScreen() {
  const { status, user, restore } = useSession();

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  if (status === "unavailable") {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorTitle}>Não foi possível validar sua sessão</Text>
        <Text style={styles.errorText}>Confira sua conexão e tente novamente. Seus dados de acesso continuam protegidos neste aparelho.</Text>
        <Pressable onPress={restore} style={styles.retry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable>
      </View>
    );
  }

  if (status === "anonymous") return <Redirect href="/login" />;
  if (user?.must_change_password) return <Redirect href="/change-password" />;
  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: 28 },
  errorTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" },
  errorText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10 },
  retry: { borderRadius: 14, backgroundColor: colors.brand, paddingHorizontal: 22, paddingVertical: 14, marginTop: 22 },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
