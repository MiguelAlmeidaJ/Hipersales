import { router } from "expo-router";
import Constants from "expo-constants";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { legalLinks } from "@/constants/legal";
import { useSession } from "@/contexts/session-context";

export default function ProfileScreen() {
  const { user, logout } = useSession();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await logout();
    router.replace("/login");
  }
  return (
    <ScrollView style={styles.screen}>
      <ScreenHeader eyebrow="Conta" title="Meu perfil" subtitle="Informações da sua sessão no HiperSales." />
      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name.slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>{user?.role === "dev" ? "Desenvolvedor" : user?.role === "admin" ? "Administrador" : "Vendedor"}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>E-mail / usuário</Text><Text style={styles.value}>{user?.email}</Text>
        <Text style={styles.label}>Empresa</Text><Text style={styles.value}>{user?.tenant_name || "HiperMix"}</Text>
      </View>
      <View style={styles.linksCard}>
        {legalLinks.privacy ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(legalLinks.privacy)} style={styles.linkRow}><Text style={styles.linkText}>Política de privacidade</Text><Text style={styles.chevron}>›</Text></Pressable> : null}
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(legalLinks.support)} style={styles.linkRow}><Text style={styles.linkText}>Suporte e contato</Text><Text style={styles.chevron}>›</Text></Pressable>
        <View style={styles.versionRow}><Text style={styles.versionLabel}>Versão</Text><Text style={styles.version}>{Constants.expoConfig?.version ?? "0.1.0"}</Text></View>
      </View>
      <Pressable disabled={busy} onPress={signOut} style={styles.logout}>
        {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.logoutText}>Sair da conta</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  card: { alignItems: "center", margin: 20, padding: 24, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 70, height: 70, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandDark },
  avatarText: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
  name: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 15 },
  role: { color: colors.brand, fontSize: 12, fontWeight: "800", marginTop: 4 },
  divider: { height: 1, alignSelf: "stretch", backgroundColor: colors.border, marginVertical: 22 },
  label: { alignSelf: "flex-start", color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 12 },
  value: { alignSelf: "flex-start", color: colors.ink, fontSize: 15, fontWeight: "600", marginTop: 4 },
  logout: { height: 52, marginHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: "#F0B8B8", backgroundColor: "#FFFFFF" },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  linksCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  linkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  linkText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
  chevron: { color: colors.muted, fontSize: 24 },
  versionRow: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  versionLabel: { flex: 1, color: colors.muted, fontSize: 13 },
  version: { color: colors.muted, fontSize: 13, fontWeight: "700" },
});
