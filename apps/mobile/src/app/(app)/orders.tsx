import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, ErrorState, LoadingState } from "@/components/list-states";
import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";
import { dateTime, money, shortDate } from "@/lib/format";
import type { Proposal } from "@/types/commercial";

const statusLabels: Record<string, string> = {
  em_analise: "Em análise",
  pedido_aprovado: "Aprovado",
  recusado: "Recusado",
  em_producao: "Em produção",
  faturado: "Faturado",
  entregue: "Entregue",
};
const statusColors: Record<string, { background: string; text: string }> = {
  em_analise: { background: "#FFF7D6", text: "#8A6700" },
  pedido_aprovado: { background: "#E5F7EF", text: "#05724D" },
  recusado: { background: "#FDEBED", text: "#B42336" },
  em_producao: { background: "#E5F6FC", text: "#02779F" },
  faturado: { background: "#E9EFFB", text: colors.brandDark },
  entregue: { background: "#EDF7E7", text: "#4C7E27" },
};

const proposalTotal = (proposal: Proposal) =>
  (proposal.items ?? []).reduce((total, item) => total + Number(item.quantity) * Number(item.negotiated_price), 0);

function StatusBadge({ status }: { status: string }) {
  const palette = statusColors[status] ?? { background: "#EEF2F6", text: colors.muted };
  return <View style={[styles.badge, { backgroundColor: palette.background }]}><Text style={[styles.badgeText, { color: palette.text }]}>{statusLabels[status] ?? status.replaceAll("_", " ")}</Text></View>;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await api<{ proposals: Proposal[] }>("/api/proposals");
      setOrders(response.proposals ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar pedidos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const statuses = useMemo(() => Array.from(new Set(orders.map((item) => item.status))), [orders]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return orders.filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const haystack = [item.order_number, item.id, item.customer_name, item.customer_trade_name, item.company_name, item.seller_name].join(" ").toLocaleLowerCase("pt-BR");
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [orders, query, status]);

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="Operação" title="Pedidos" subtitle={`${filtered.length} de ${orders.length} pedidos encontrados`} />
      <View style={styles.filters}>
        <TextInput accessibilityLabel="Buscar pedidos" autoCapitalize="none" onChangeText={setQuery} placeholder="Número, cliente, empresa ou vendedor" placeholderTextColor="#8A99AA" style={styles.search} value={query} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setStatus("all")} style={[styles.chip, status === "all" && styles.chipActive]}><Text style={[styles.chipText, status === "all" && styles.chipTextActive]}>Todos</Text></Pressable>
          {statuses.map((item) => <Pressable key={item} onPress={() => setStatus(item)} style={[styles.chip, status === item && styles.chipActive]}><Text style={[styles.chipText, status === item && styles.chipTextActive]}>{statusLabels[item] ?? item.replaceAll("_", " ")}</Text></Pressable>)}
        </ScrollView>
      </View>
      <Pressable accessibilityLabel="Criar proposta" accessibilityRole="button" onPress={() => router.push("/new-order")} style={styles.fab}><Text style={styles.fabPlus}>＋</Text></Pressable>

      {loading && !orders.length ? <LoadingState label="Carregando pedidos…" /> : error && !orders.length ? <ErrorState message={error} onRetry={() => load()} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.brand]} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState title="Nenhum pedido encontrado" description="Altere a busca ou o filtro de status para consultar outros pedidos." />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.cardTop}><Text style={styles.number}>Pedido #{item.order_number || item.id}</Text><StatusBadge status={item.status} /></View>
              <Text style={styles.customer} numberOfLines={1}>{item.customer_trade_name || item.customer_name}</Text>
              <Text style={styles.company} numberOfLines={1}>{item.company_name}</Text>
              <View style={styles.cardBottom}><Text style={styles.date}>{shortDate(item.created_at)}</Text><Text style={styles.total}>{money(proposalTotal(item))}</Text></View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={Boolean(selected)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected ? <OrderDetails proposal={selected} onClose={() => setSelected(null)} /> : null}
      </Modal>
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || "—"}</Text></View>;
}

function OrderDetails({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  return (
    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
      <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>DETALHES DO PEDIDO</Text><Text style={styles.modalTitle}>#{proposal.order_number || proposal.id}</Text></View><Pressable accessibilityLabel="Fechar detalhes" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <View style={styles.summaryCard}><StatusBadge status={proposal.status} /><Text style={styles.summaryCustomer}>{proposal.customer_name}</Text><Text style={styles.summaryCompany}>{proposal.company_name}</Text><Text style={styles.summaryTotal}>{money(proposalTotal(proposal))}</Text></View>
        <Text style={styles.sectionTitle}>Informações comerciais</Text>
        <View style={styles.detailsGrid}>
          <Detail label="Representante" value={proposal.seller_name} />
          <Detail label="Data" value={dateTime(proposal.created_at)} />
          <Detail label="Tipo" value={proposal.order_type} />
          <Detail label="Pagamento" value={proposal.payment_terms} />
          <Detail label="Frete" value={proposal.freight_type} />
          <Detail label="Entrega" value={proposal.delivery_type} />
          <Detail label="Pedido da indústria" value={proposal.industry_order_number} />
          <Detail label="Nota fiscal" value={proposal.invoice_number} />
        </View>
        <Text style={styles.sectionTitle}>Itens ({proposal.items?.length ?? 0})</Text>
        {(proposal.items ?? []).map((item) => <View key={item.id} style={styles.itemRow}><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{item.code} · {item.quantity} {item.unit || "un."} × {money(item.negotiated_price)}</Text></View><Text style={styles.itemTotal}>{money(item.quantity * item.negotiated_price)}</Text></View>)}
        {proposal.notes ? <><Text style={styles.sectionTitle}>Observações</Text><Text style={styles.notes}>{proposal.notes}</Text></> : null}
        <Text style={styles.sectionTitle}>Histórico</Text>
        {(proposal.timeline ?? []).length ? proposal.timeline?.map((event, index) => <View key={event.id ?? index} style={styles.timeline}><View style={styles.timelineDot} /><View style={styles.timelineCopy}><Text style={styles.timelineTitle}>{event.title || statusLabels[event.status] || event.status}</Text><Text style={styles.timelineMeta}>{dateTime(event.created_at)}{event.created_by_name ? ` · ${event.created_by_name}` : ""}</Text>{event.notes ? <Text style={styles.timelineNotes}>{event.notes}</Text> : null}</View></View>) : <Text style={styles.muted}>Nenhum evento registrado.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  filters: { backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  search: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: "#F9FBFD", color: colors.ink, fontSize: 14, paddingHorizontal: 15 },
  chips: { gap: 8, paddingVertical: 11 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 8 },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  chipTextActive: { color: "#FFFFFF" },
  list: { padding: 16, paddingBottom: 90, flexGrow: 1 },
  card: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 11 },
  cardPressed: { opacity: 0.78 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  number: { color: colors.brandDark, fontSize: 12, fontWeight: "900" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  customer: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 14 },
  company: { color: colors.muted, fontSize: 13, marginTop: 3 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 },
  date: { color: colors.muted, fontSize: 12 },
  total: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  modal: { flex: 1, backgroundColor: colors.canvas },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalEyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  modalTitle: { color: colors.ink, fontSize: 25, fontWeight: "900", marginTop: 2 },
  close: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3F7" },
  closeText: { color: colors.ink, fontSize: 28, lineHeight: 30 },
  modalContent: { padding: 20, paddingBottom: 40 },
  summaryCard: { borderRadius: 20, backgroundColor: colors.brandDark, padding: 20 },
  summaryCustomer: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 16 },
  summaryCompany: { color: "#C9DEEF", fontSize: 13, marginTop: 4 },
  summaryTotal: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 20 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 25, marginBottom: 11 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detail: { width: "48%", flexGrow: 1, minHeight: 72, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 13 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 13, paddingHorizontal: 12 },
  itemCopy: { flex: 1 }, itemName: { color: colors.ink, fontSize: 13, fontWeight: "800" }, itemMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, itemTotal: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  notes: { color: colors.muted, fontSize: 13, lineHeight: 20, borderRadius: 14, backgroundColor: colors.surface, padding: 14 },
  timeline: { flexDirection: "row", paddingBottom: 16 }, timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 4, marginRight: 12 }, timelineCopy: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12, paddingBottom: 5 }, timelineTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, timelineMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, timelineNotes: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  muted: { color: colors.muted, fontSize: 13 },
  fab: { position: "absolute", right: 20, bottom: 18, zIndex: 10, width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, shadowColor: colors.brandDark, shadowOpacity: 0.28, shadowRadius: 9, elevation: 6 },
  fabPlus: { color: "#FFFFFF", fontSize: 28, fontWeight: "500" },
});
