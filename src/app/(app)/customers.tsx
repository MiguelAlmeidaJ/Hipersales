import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, ErrorState, LoadingState } from "@/components/list-states";
import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { api, authenticatedResource, useMockApi } from "@/lib/api";
import { useSession } from "@/contexts/session-context";
import { digitsOnly, formatCnpj } from "@/lib/format";
import type { Customer } from "@/types/commercial";

const normalize = (value: unknown) => String(value ?? "").toLocaleLowerCase("pt-BR");

export default function CustomersScreen() {
  const {user}=useSession();const isAdmin=user?.role==="admin"||user?.role==="dev";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await api<{ customers: Customer[] }>(isAdmin?"/api/admin/customers":"/api/customers");
      setCustomers(response.customers ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar clientes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const digits = digitsOnly(term);
    return customers.filter((customer) => {
      if (!term) return true;
      const text = [customer.legal_name, customer.trade_name, customer.cnpj, customer.phone, customer.email].map(normalize).join(" ");
      return text.includes(term) || (digits.length > 2 && digitsOnly(text).includes(digits));
    });
  }, [customers, query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="Carteira" title="Clientes" subtitle={`${filtered.length} de ${customers.length} clientes encontrados`} />
      <View style={styles.searchWrap}>
        <TextInput accessibilityLabel="Buscar clientes" autoCapitalize="none" keyboardType="default" onChangeText={setQuery} placeholder="Nome, CNPJ, telefone ou e-mail" placeholderTextColor="#8A99AA" style={styles.search} value={query} />
      </View>
      {!isAdmin||useMockApi?<Pressable accessibilityLabel="Adicionar cliente" accessibilityRole="button" onPress={() => router.push("/new-customer")} style={styles.fab}><Text style={styles.fabPlus}>＋</Text></Pressable>:null}
      {loading && !customers.length ? <LoadingState label="Carregando carteira…" /> : error && !customers.length ? <ErrorState message={error} onRetry={() => load()} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.brand]} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState title="Nenhum cliente encontrado" description="Altere a busca para consultar outro cliente da sua carteira." />}
          renderItem={({ item }) => <CustomerCard customer={item} onPress={() => setSelected(item)} />}
        />
      )}
      <Modal visible={Boolean(selected)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected ? <CustomerDetails customer={selected} isAdmin={isAdmin&&useMockApi} onClose={() => setSelected(null)} /> : null}
      </Modal>
    </View>
  );
}

function initials(customer: Customer) {
  return (customer.trade_name || customer.legal_name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function CustomerCard({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  const status=customer.statusCadastro||(customer.active?"APROVADO":"");
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(customer)}</Text></View>
      <View style={styles.cardCopy}>
        <Text style={styles.tradeName} numberOfLines={1}>{customer.trade_name || customer.legal_name}</Text>
        {customer.trade_name ? <Text style={styles.legalName} numberOfLines={1}>{customer.legal_name}</Text> : null}
        <View style={styles.cardMeta}><Text style={styles.cnpj}>{formatCnpj(customer.cnpj)}</Text>{status?<Text style={[styles.customerStatus,status==="APROVADO"&&styles.customerStatusApproved]}>{status.replaceAll("_"," ")}</Text>:null}</View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function CustomerDetails({ customer, onClose, isAdmin }: { customer: Customer; onClose: () => void; isAdmin:boolean }) {
  async function shareCustomerPdf(kind:"registration"|"performance"){
    try{
      const resource=authenticatedResource(("/api/admin/customers/"+customer.id+"/"+kind+"/pdf") as never);
      if(!resource.headers.Authorization)throw new Error("Sessão expirada.");
      const result=await FileSystem.downloadAsync(resource.url,FileSystem.cacheDirectory+kind+"-cliente-"+customer.id+".pdf",{headers:resource.headers});
      if(result.status!==200)throw new Error("Não foi possível obter o documento.");
      await Sharing.shareAsync(result.uri,{mimeType:"application/pdf"});
    }catch(cause){Alert.alert("Documento do cliente",cause instanceof Error?cause.message:"Falha no download.");}
  }
  const phone = customer.phone ? digitsOnly(customer.phone) : "";
  const whatsappPhone = phone.startsWith("55") ? phone : `55${phone}`;
  const canCall = phone.length >= 8;
  const canEmail = Boolean(customer.email?.includes("@"));
  return (
    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
      <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>CLIENTE</Text><Text style={styles.modalTitle} numberOfLines={1}>{customer.trade_name || customer.legal_name}</Text></View><Pressable accessibilityLabel="Fechar detalhes" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <View style={styles.identity}>
          <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>{initials(customer)}</Text></View>
          <Text style={styles.identityName}>{customer.trade_name || customer.legal_name}</Text>
          {customer.trade_name ? <Text style={styles.identityLegal}>{customer.legal_name}</Text> : null}
          <Text style={styles.identityCnpj}>{formatCnpj(customer.cnpj)}</Text>
        </View>

        {(canCall || canEmail) ? <View style={styles.actions}>
          {canCall ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.action}><Text style={styles.actionSymbol}>☎</Text><Text style={styles.actionText}>Ligar</Text></Pressable> : null}
          {canCall ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://wa.me/${whatsappPhone}`)} style={styles.action}><Text style={styles.actionSymbol}>◉</Text><Text style={styles.actionText}>WhatsApp</Text></Pressable> : null}
          {canEmail ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${customer.email}`)} style={styles.action}><Text style={styles.actionSymbol}>@</Text><Text style={styles.actionText}>E-mail</Text></Pressable> : null}
        </View> : null}

        {isAdmin?<View style={{gap:9,marginVertical:12}}>
          <Pressable accessibilityRole="button" onPress={()=>{onClose();router.push({pathname:"/new-customer",params:{id:String(customer.id)}});}} style={styles.action}><Text style={styles.actionText}>Editar cadastro</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>void shareCustomerPdf("registration")} style={styles.action}><Text style={styles.actionText}>Ficha do cliente (PDF)</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>void shareCustomerPdf("performance")} style={styles.action}><Text style={styles.actionText}>Análise do cliente (PDF)</Text></Pressable>
        </View>:null}
        <Text style={styles.sectionTitle}>Dados cadastrais</Text>
        <InfoRow label="Razão social" value={customer.legal_name} />
        <InfoRow label="CNPJ" value={formatCnpj(customer.cnpj)} />
        <InfoRow label="Situação" value={(customer.statusCadastro||customer.status||"").replaceAll("_"," ")} />
        {customer.rejection_reason?<InfoRow label="Motivo da rejeição" value={customer.rejection_reason} multiline />:null}
        <InfoRow label="Inscrição estadual" value={customer.state_registration} />
        <InfoRow label="Telefone" value={customer.phone} />
        <InfoRow label="E-mail" value={customer.email} />
        <InfoRow label="Endereço" value={customer.address} multiline />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, multiline = false }: { label: string; value?: string | null; multiline?: boolean }) {
  return <View style={[styles.infoRow, multiline && styles.infoRowMultiline]}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={[styles.infoValue, multiline && styles.infoValueMultiline]}>{value || "Não informado"}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  searchWrap: { backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 14 },
  search: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: "#F9FBFD", color: colors.ink, fontSize: 14, paddingHorizontal: 15 },
  list: { padding: 16, paddingBottom: 90, flexGrow: 1 },
  card: { flexDirection: "row", alignItems: "center", borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  pressed: { opacity: 0.76 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F2FA" },
  avatarText: { color: colors.brandDark, fontSize: 14, fontWeight: "900" },
  cardCopy: { flex: 1, marginLeft: 13 },
  tradeName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  legalName: { color: colors.muted, fontSize: 11, marginTop: 3 },
  cardMeta:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:7,marginTop:5},
  cnpj: { color: colors.brand, fontSize: 11, fontWeight: "700" },
  customerStatus:{color:"#8A6700",fontSize:8,fontWeight:"900",backgroundColor:"#FFF7D6",paddingHorizontal:7,paddingVertical:3,borderRadius:999},
  customerStatusApproved:{color:"#05724D",backgroundColor:"#E5F7EF"},
  chevron: { color: "#94A3B8", fontSize: 28, marginLeft: 8 },
  modal: { flex: 1, backgroundColor: colors.canvas },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalEyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 2, maxWidth: 270 },
  close: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3F7" },
  closeText: { color: colors.ink, fontSize: 28, lineHeight: 30 },
  modalContent: { padding: 20, paddingBottom: 40 },
  identity: { alignItems: "center", borderRadius: 20, backgroundColor: colors.brandDark, padding: 22 },
  largeAvatar: { width: 66, height: 66, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  largeAvatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  identityName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 14 },
  identityLegal: { color: "#C9DEEF", fontSize: 12, textAlign: "center", marginTop: 4 },
  identityCnpj: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  action: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 70, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionSymbol: { color: colors.brand, fontSize: 20, fontWeight: "900" },
  actionText: { color: colors.ink, fontSize: 11, fontWeight: "800", marginTop: 5 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 25, marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 54, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoRowMultiline: { alignItems: "flex-start" },
  infoLabel: { width: 116, color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  infoValue: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "600", textAlign: "right" },
  infoValueMultiline: { lineHeight: 19 },
  fab: { position: "absolute", right: 20, bottom: 18, zIndex: 10, width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, shadowColor: colors.brandDark, shadowOpacity: 0.28, shadowRadius: 9, elevation: 6 },
  fabPlus: { color: "#FFFFFF", fontSize: 28, fontWeight: "500" },
});
