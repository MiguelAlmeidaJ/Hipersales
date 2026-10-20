import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { ScreenHeader } from "@/components/screen-header";
import { NotificationBell } from "@/components/notification-bell";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";

type DashboardData = { summary?: Record<string, number> };
type NativeRoute = "/new-order" | "/new-customer" | "/(app)/orders" | "/(app)/customers" | "/(app)/modules" | "/occurrences" | "/goals";
type Action = { title: string; subtitle: string; icon: AppIconName; color: string; background: string; route: NativeRoute };

const labels: Record<string, string> = {
  orders: "Pedidos",
  revenue: "Faturamento",
  customers: "Clientes",
  products: "Produtos",
  companies: "Empresas",
  pending_requests: "Pendências",
};

const sellerActions: Action[] = [
  { title: "Nova proposta", subtitle: "Criar pedido", icon: "add-circle-outline", color: colors.brand, background: "#E8F3FB", route: "/new-order" },
  { title: "Solicitar cliente", subtitle: "Novo cadastro", icon: "person-add-outline", color: "#7A5AF8", background: "#F0ECFF", route: "/new-customer" },
  { title: "Meus clientes", subtitle: "Minha carteira", icon: "people-outline", color: colors.success, background: "#E7F7F0", route: "/(app)/customers" },
  { title: "Meus pedidos", subtitle: "Acompanhar", icon: "receipt-outline", color: "#B54708", background: "#FFF1E5", route: "/(app)/orders" },
  { title: "Ocorrência", subtitle: "Registrar situação", icon: "alert-circle-outline", color: colors.danger, background: "#FDEBEC", route: "/occurrences" },
  { title: "Minhas metas", subtitle: "Ver objetivos", icon: "flag-outline", color: "#4C7E27", background: "#EDF7E7", route: "/goals" },
];

function formatValue(key: string, value: number) {
  if (key === "revenue" || key === "total") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

const fetchAdminDashboard = () => api<DashboardData>("/api/admin/executive-dashboard");

function openAction(action: Action) { router.push(action.route as Href); }

export default function HomeScreen() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin" || user?.role === "dev";
  return isAdmin ? <AdminHome firstName={user?.name.split(" ")[0] || "administrador"} /> : <SellerHome firstName={user?.name.split(" ")[0] || "representante"} />;
}

function SellerHome({ firstName }: { firstName: string }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="Seu espaço de trabalho" title={`Olá, ${firstName}!`} subtitle="O que você precisa fazer hoje?" right={<NotificationBell />} />
      <View style={styles.sellerHero}>
        <View style={styles.sellerHeroIcon}><AppIcon name="briefcase-outline" color="#FFFFFF" size={28} /></View>
        <View style={styles.sellerHeroCopy}>
          <Text style={styles.sellerHeroTitle}>Sua rotina comercial</Text>
          <Text style={styles.sellerHeroText}>Crie propostas, cuide da carteira e acompanhe seus resultados.</Text>
        </View>
      </View>
      <Text style={styles.actionHeading}>Ações rápidas</Text>
      <View style={styles.actionGrid}>
        {sellerActions.map((action) => (
          <Pressable key={action.title} accessibilityRole="button" onPress={() => openAction(action)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
            <View style={[styles.actionIcon, { backgroundColor: action.background }]}><AppIcon name={action.icon} color={action.color} size={25} /></View>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function AdminHome({ firstName }: { firstName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchAdminDashboard()
      .then((response) => { if (active) { setData(response); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar o painel."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetchAdminDashboard();
      setData(response);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = Object.entries(data?.summary ?? {}).filter(([key]) => labels[key]).slice(0, 4);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} colors={[colors.brand]} tintColor={colors.brand} />}>
      <ScreenHeader eyebrow="Administração" title={`Olá, ${firstName}`} subtitle="Visão geral da operação HiperSales." right={<NotificationBell />} />
      <View style={styles.adminHero}>
        <View style={styles.heroAccent} />
        <Text style={styles.heroEyebrow}>GESTÃO DA OPERAÇÃO</Text>
        <Text style={styles.heroTitle}>Seu negócio em movimento.</Text>
        <Text style={styles.heroText}>Acompanhe indicadores e acesse todas as áreas administrativas.</Text>
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Indicadores</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.refresh}>Atualizar</Text></Pressable>
      </View>
      {loading && !data ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
      <View style={styles.metricGrid}>
        {metrics.map(([key, value]) => (
          <View key={key} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{labels[key]}</Text>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{formatValue(key, value)}</Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/modules" as Href)} style={({ pressed }) => [styles.modulesCta, pressed && styles.pressed]}>
        <View style={styles.modulesIcon}><AppIcon name="grid" color="#FFFFFF" size={24} /></View>
        <View style={styles.modulesCopy}><Text style={styles.modulesTitle}>Todos os módulos</Text><Text style={styles.modulesText}>Usuários, catálogo, ocorrências, metas, relatórios e configurações.</Text></View>
        <AppIcon name="chevron-forward" color="#9FD2F2" size={20} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 28 },
  sellerHero: { flexDirection: "row", alignItems: "center", margin: 20, padding: 18, borderRadius: 22, backgroundColor: colors.brandDark },
  sellerHeroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  sellerHeroCopy: { flex: 1, marginLeft: 14 },
  sellerHeroTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  sellerHeroText: { color: "#D7E8F7", fontSize: 12, lineHeight: 18, marginTop: 4 },
  actionHeading: { color: colors.ink, fontSize: 18, fontWeight: "900", marginHorizontal: 20, marginBottom: 12 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20 },
  actionCard: { width: "48%", flexGrow: 1, minHeight: 142, padding: 16, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  actionTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  actionSubtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  adminHero: { margin: 20, padding: 22, borderRadius: 22, overflow: "hidden", backgroundColor: colors.brandDark },
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
  modulesCta: { flexDirection: "row", alignItems: "center", margin: 20, padding: 16, borderRadius: 19, backgroundColor: colors.brandDark },
  modulesIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand },
  modulesCopy: { flex: 1, marginHorizontal: 13 },
  modulesTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  modulesText: { color: "#C9DEEF", fontSize: 11, lineHeight: 16, marginTop: 4 },
});
