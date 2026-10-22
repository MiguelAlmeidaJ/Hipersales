import Constants from "expo-constants";
import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";

void SplashScreen.preventAutoHideAsync();

export default function IndexScreen() {
  const { status, user, restore } = useSession();

  useEffect(() => { void SplashScreen.hideAsync(); }, []);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <Image source={require("../../assets/images/android-adaptive-foreground.png")} style={styles.brandMark} resizeMode="contain" />
        <Text style={styles.brandName}>HiperSales</Text>
        <Text style={styles.tagline}>Sua operação comercial, conectada</Text>
        <ActivityIndicator color="#FFFFFF" size="small" style={styles.spinner} />
        <Text style={styles.loadingVersion}>Beta • v{Constants.expoConfig?.version ?? "0.1.0"}</Text>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandDark, padding: 24 },
  brandMark: { width: 164, height: 164 },
  brandName: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", marginTop: 8 },
  tagline: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 5 },
  spinner: { marginTop: 28 },
  loadingVersion: { position: "absolute", bottom: 32, color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: 28 },
  errorTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" },
  errorText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10 },
  retry: { borderRadius: 14, backgroundColor: colors.brand, paddingHorizontal: 22, paddingVertical: 14, marginTop: 22 },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
