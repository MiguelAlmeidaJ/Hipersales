import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";

type DashboardData = {
  summary?: Record<string, number>;
  status_counts?: Record<string, number>;
};

const labels: Record<string, string> = {
  orders: "Pedidos",
  revenue: "Faturamento",
  customers: "Clientes",
  products: "Produtos",
  companies: "Empresas",
  pending_requests: "Pendências",
};

function formatValue(key: string, value: number) {
  if (key === "revenue" || key === "total") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function DashboardScreen() {
  const { user } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api<DashboardData>(user?.role === "admin" ? "/api/admin/executive-dashboard" : "/api/dashboard");
      setData(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { void load(); }, [load]);

  const metrics = Object.entries(data?.summary ?? {}).filter(([key]) => labels[key]).slice(0, 4);
  const firstName = user?.name.split(" ")[0] || "usuário";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.brand]} tintColor={colors.brand} />}>
      <ScreenHeader eyebrow="HiperSales" title={`Olá, ${firstName}`} subtitle="Aqui está o resumo da sua operação comercial." />

      <View style={styles.hero}>
        <View style={styles.heroAccent} />
        <Text style={styles.heroEyebrow}>VISÃO DO DIA</Text>
        <Text style={styles.heroTitle}>Seu negócio em movimento.</Text>
        <Text style={styles.heroText}>Acompanhe indicadores e acesse rapidamente as rotinas mais importantes.</Text>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Indicadores</Text>
        <Pressable onPress={load}><Text style={styles.refresh}>Atualizar</Text></Pressable>
      </View>

      {loading && !data ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
      <View style={styles.metricGrid}>
        {metrics.length ? metrics.map(([key, value]) => (
          <View key={key} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{labels[key]}</Text>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{formatValue(key, value)}</Text>
          </View>
        )) : !loading && !error ? <Text style={styles.empty}>Nenhum indicador disponível.</Text> : null}
      </View>

      <Text style={[styles.sectionTitle, styles.accessTitle]}>Acesso rápido</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/orders")} style={styles.quickCard}>
        <View style={styles.quickIcon}><Text style={styles.quickIconText}>＋</Text></View>
        <View style={styles.quickCopy}><Text style={styles.quickTitle}>Pedidos e propostas</Text><Text style={styles.quickText}>Consulte valores, itens e histórico.</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/customers")} style={styles.quickCard}>
        <View style={[styles.quickIcon, styles.quickIconGreen]}><Text style={[styles.quickIconText, styles.quickIconTextGreen]}>●</Text></View>
        <View style={styles.quickCopy}><Text style={styles.quickTitle}>Consultar cliente</Text><Text style={styles.quickText}>Encontre dados da sua carteira.</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 28 },
  hero: { margin: 20, padding: 22, borderRadius: 22, overflow: "hidden", backgroundColor: colors.brandDark },
  heroAccent: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: colors.brand, opacity: 0.5, right: -35, top: -55 },
  heroEyebrow: { color: "#9FD2F2", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginTop: 8 },
  heroText: { color: "#D7E8F7", fontSize: 13, lineHeight: 20, marginTop: 7, maxWidth: "84%" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  refresh: { color: colors.brand, fontSize: 12, fontWeight: "800" },
  loader: { padding: 24 },
  errorCard: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: "#FEF2F2" },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  metricCard: { width: "48%", flexGrow: 1, minHeight: 100, borderRadius: 18, padding: 16, justifyContent: "space-between", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  metricValue: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 12 },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 18 },
  accessTitle: { marginHorizontal: 20, marginTop: 26, marginBottom: 12 },
  quickCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FB" },
  quickIconGreen: { backgroundColor: "#EDF7E7" },
  quickIconText: { color: colors.brand, fontSize: 22, fontWeight: "800" },
  quickIconTextGreen: { color: colors.accent, fontSize: 15 },
  quickCopy: { flex: 1, marginLeft: 13 },
  quickTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  quickText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  chevron: { color: "#94A3B8", fontSize: 28 },
});
