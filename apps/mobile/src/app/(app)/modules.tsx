import { Redirect, router, type Href } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { webModuleUrl } from "@/lib/web-portal";

type ModuleItem = {
  title: string;
  description: string;
  icon: AppIconName;
  color: string;
  background: string;
  nativeRoute?: "/(app)" | "/(app)/orders" | "/(app)/customers";
  webSlug?: string;
};

const modules: ModuleItem[] = [
  { title: "Painel", description: "Indicadores executivos", icon: "analytics-outline", color: colors.brand, background: "#E8F3FB", nativeRoute: "/(app)" },
  { title: "Pedidos", description: "Propostas e andamento", icon: "receipt-outline", color: "#B54708", background: "#FFF1E5", nativeRoute: "/(app)/orders" },
  { title: "Clientes", description: "Cadastros e carteira", icon: "people-outline", color: colors.success, background: "#E7F7F0", nativeRoute: "/(app)/customers" },
  { title: "Empresas", description: "Indústrias representadas", icon: "business-outline", color: "#475467", background: "#EEF2F6", webSlug: "empresas" },
  { title: "Produtos", description: "Catálogo comercial", icon: "cube-outline", color: "#7A5AF8", background: "#F0ECFF", webSlug: "produtos" },
  { title: "Aprovações", description: "Solicitações pendentes", icon: "checkmark-done-outline", color: "#4C7E27", background: "#EDF7E7", webSlug: "aprovacoes" },
  { title: "Ocorrências", description: "Atendimento e histórico", icon: "alert-circle-outline", color: colors.danger, background: "#FDEBEC", webSlug: "ocorrencias" },
  { title: "Metas", description: "Objetivos da equipe", icon: "flag-outline", color: "#02779F", background: "#E5F6FC", webSlug: "metas" },
  { title: "Usuários", description: "Equipe e permissões", icon: "person-circle-outline", color: colors.brandDark, background: "#E9EFFB", webSlug: "usuarios" },
  { title: "Carteiras", description: "Vínculos comerciais", icon: "briefcase-outline", color: "#7A5AF8", background: "#F0ECFF", webSlug: "usuarios" },
  { title: "Relatórios", description: "Análises e documentos", icon: "bar-chart-outline", color: "#B54708", background: "#FFF1E5", webSlug: "relatorios" },
  { title: "Configurações", description: "Integrações e operação", icon: "settings-outline", color: "#475467", background: "#EEF2F6", webSlug: "configuracoes" },
];

async function openModule(item: ModuleItem) {
  if (item.nativeRoute) {
    router.push(item.nativeRoute as Href);
    return;
  }
  try {
    await Linking.openURL(webModuleUrl(item.webSlug ?? ""));
  } catch {
    Alert.alert("Não foi possível abrir o módulo", "Confira sua conexão e tente novamente.");
  }
}

export default function ModulesScreen() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin" || user?.role === "dev";
  if (!isAdmin) return <Redirect href="/(app)" />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="Administração" title="Módulos" subtitle="Todas as funções da operação em um só lugar." />
      <View style={styles.notice}>
        <AppIcon name="phone-portrait-outline" color={colors.brand} size={22} />
        <Text style={styles.noticeText}>As rotinas principais são nativas. Os módulos marcados abrem a versão completa do portal.</Text>
      </View>
      <View style={styles.grid}>
        {modules.map((item) => (
          <Pressable key={item.title} accessibilityRole="button" onPress={() => void openModule(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardTop}>
              <View style={[styles.icon, { backgroundColor: item.background }]}><AppIcon name={item.icon} color={item.color} size={25} /></View>
              {item.webSlug ? <View style={styles.webBadge}><Text style={styles.webBadgeText}>WEB</Text></View> : null}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 28 },
  notice: { flexDirection: "row", alignItems: "center", gap: 12, margin: 20, marginBottom: 4, padding: 14, borderRadius: 16, backgroundColor: "#E8F3FB" },
  noticeText: { flex: 1, color: colors.brandDark, fontSize: 11, lineHeight: 17, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 20 },
  card: { width: "48%", flexGrow: 1, minHeight: 142, padding: 15, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  webBadge: { borderRadius: 999, backgroundColor: "#EEF2F6", paddingHorizontal: 7, paddingVertical: 4 },
  webBadgeText: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 14 },
  description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
