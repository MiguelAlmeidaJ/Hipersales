import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlatList, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/list-states";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { api, authenticatedResource, useMockApi } from "@/lib/api";
import { useSession } from "@/contexts/session-context";
import { digitsOnly, formatCnpj } from "@/lib/format";
import type { Customer } from "@/types/commercial";

const normalize = (value: unknown) => String(value ?? "").toLocaleLowerCase("pt-BR");
type CustomerStatusFilter = "approved" | "pending" | "rejected";
const customerFilters: {value:CustomerStatusFilter;label:string}[] = [
  {value:"approved",label:"Aprovados"},
  {value:"pending",label:"Aguardando aprovação"},
  {value:"rejected",label:"Rejeitados"},
];
function customerStatusCategory(customer:Customer):CustomerStatusFilter{
  const status=normalize(customer.statusCadastro||customer.status).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_");
  if(status.includes("rejeitad")||status.includes("recusad"))return "rejected";
  if(status==="aprovado"||status==="ativo"||(!status&&Boolean(customer.active)))return "approved";
  return "pending";
}

export default function CustomersScreen() {
  const {user}=useSession();const isAdmin=user?.role==="admin"||user?.role==="dev";
  const params=useLocalSearchParams<{status?:string}>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter,setStatusFilter]=useState<CustomerStatusFilter>("approved");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{if(params.status==="approved"||params.status==="pending"||params.status==="rejected")setStatusFilter(params.status);},[params.status]);

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
      if(customerStatusCategory(customer)!==statusFilter)return false;
      if (!term) return true;
      const text = [customer.legal_name, customer.trade_name, customer.cnpj, customer.phone, customer.email].map(normalize).join(" ");
      return text.includes(term) || (digits.length > 2 && digitsOnly(text).includes(digits));
    });
  }, [customers, query, statusFilter]);

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="Carteira comercial" title="Meus clientes" subtitle={`${filtered.length} ${filtered.length===1?"cliente encontrado":"clientes encontrados"}`} right={<View style={styles.headerIcon}><AppIcon name="people-outline" color={colors.brand} size={22}/></View>} />
      <View style={styles.filters}>
        <View style={styles.searchWrap}><AppIcon name="search" color={colors.muted} size={20}/><TextInput accessibilityLabel="Buscar clientes" autoCapitalize="none" keyboardType="default" onChangeText={setQuery} placeholder="Nome, CNPJ, telefone ou e-mail" placeholderTextColor="#8A99AA" style={styles.search} value={query} />{query?<Pressable accessibilityLabel="Limpar busca" onPress={()=>setQuery("")}><AppIcon name="close-circle" color="#91A0AF" size={21}/></Pressable>:null}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>{customerFilters.map(item=><Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected:statusFilter===item.value}} onPress={()=>setStatusFilter(item.value)} style={[styles.filterChip,statusFilter===item.value&&styles.filterChipActive]}><View style={[styles.filterDot,item.value==="approved"?styles.filterDotApproved:item.value==="rejected"?styles.filterDotRejected:styles.filterDotPending]}/><Text style={[styles.filterChipText,statusFilter===item.value&&styles.filterChipTextActive]}>{item.label}</Text><Text style={[styles.filterCount,statusFilter===item.value&&styles.filterCountActive]}>{customers.filter(customer=>customerStatusCategory(customer)===item.value).length}</Text></Pressable>)}</ScrollView>
      </View>
      {!isAdmin||useMockApi?<Pressable accessibilityLabel="Adicionar cliente" accessibilityRole="button" onPress={() => router.push("/new-customer")} style={({pressed})=>[styles.fab,pressed&&styles.pressed]}><AppIcon name="person-add-outline" color="#FFFFFF" size={24}/></Pressable>:null}
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

function formattedPhone(value?: string | null) {
  const digits=digitsOnly(value||"");
  if(digits.length===11)return digits.replace(/^(\d{2})(\d{5})(\d{4})$/,"($1) $2-$3");
  if(digits.length===10)return digits.replace(/^(\d{2})(\d{4})(\d{4})$/,"($1) $2-$3");
  return value||"";
}

function CustomerCard({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  const status=customer.statusCadastro||(customer.active?"APROVADO":"");
  const statusKey=normalize(status).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_");
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(customer)}</Text></View>
      <View style={styles.cardCopy}>
        <Text style={styles.tradeName} numberOfLines={1}>{customer.trade_name || customer.legal_name}</Text>
        {customer.trade_name ? <Text style={styles.legalName} numberOfLines={1}>{customer.legal_name}</Text> : null}
        <View style={styles.cardMeta}><View style={styles.cnpjWrap}><AppIcon name="business-outline" color={colors.muted} size={13}/><Text style={styles.cnpj}>{formatCnpj(customer.cnpj)}</Text></View>{status?<Text style={[styles.customerStatus,statusKey.includes("aprovado")&&styles.customerStatusApproved,(statusKey.includes("rejeitado")||statusKey.includes("recusado"))&&styles.customerStatusRejected]}>{status.replaceAll("_"," ")}</Text>:null}</View>
      </View>
      <AppIcon name="chevron-forward" color="#91A1B4" size={20}/>
    </Pressable>
  );
}

function CustomerDetails({ customer, onClose, isAdmin }: { customer: Customer; onClose: () => void; isAdmin:boolean }) {
  const [dialog,setDialog]=useState<{title:string;message:string;tone:"error"|"info"}|null>(null);
  async function shareCustomerPdf(kind:"registration"|"performance"){
    try{
      const resource=authenticatedResource(("/api/admin/customers/"+customer.id+"/"+kind+"/pdf") as never);
      if(!resource.headers.Authorization)throw new Error("Sessão expirada.");
      const result=await FileSystem.downloadAsync(resource.url,FileSystem.cacheDirectory+kind+"-cliente-"+customer.id+".pdf",{headers:resource.headers});
      if(result.status!==200)throw new Error("Não foi possível obter o documento.");
      await Sharing.shareAsync(result.uri,{mimeType:"application/pdf"});
    }catch(cause){setDialog({title:"Documento indisponível",message:cause instanceof Error?cause.message:"Falha no download.",tone:"error"});}
  }
  const phone = customer.phone ? digitsOnly(customer.phone) : "";
  const whatsappPhone = phone.startsWith("55") ? phone : `55${phone}`;
  const canCall = phone.length >= 8;
  const canEmail = Boolean(customer.email?.includes("@"));
  const rejected=customerStatusCategory(customer)==="rejected";
  async function openContact(url:string,label:string){try{const supported=await Linking.canOpenURL(url);if(!supported)throw new Error(`Não foi possível abrir ${label} neste aparelho.`);await Linking.openURL(url);}catch(cause){setDialog({title:`Não foi possível abrir ${label}`,message:cause instanceof Error?cause.message:"Tente novamente.",tone:"error"});}}
  async function openWhatsApp(){try{const appUrl=`whatsapp://send?phone=${whatsappPhone}`;if(await Linking.canOpenURL(appUrl)){await Linking.openURL(appUrl);return;}await Linking.openURL(`https://wa.me/${whatsappPhone}`);}catch{setDialog({title:"Não foi possível abrir o WhatsApp",message:"Confira se o WhatsApp está instalado ou tente novamente.",tone:"error"});}}
  function adjustAndResubmit(){onClose();router.push({pathname:"/new-customer",params:{id:String(customer.id),resubmit:"1"}});}
  return (
    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
      <View style={styles.modalHeader}><View style={styles.modalHeaderCopy}><Text style={styles.modalEyebrow}>DETALHES DO CLIENTE</Text><Text style={styles.modalTitle} numberOfLines={1}>{customer.trade_name || customer.legal_name}</Text></View><Pressable accessibilityLabel="Fechar detalhes" onPress={onClose} style={styles.close}><AppIcon name="close" color={colors.ink} size={23}/></Pressable></View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <View style={styles.identity}>
          <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>{initials(customer)}</Text></View>
          <Text style={styles.identityName}>{customer.trade_name || customer.legal_name}</Text>
          {customer.trade_name ? <Text style={styles.identityLegal}>{customer.legal_name}</Text> : null}
          <Text style={styles.identityCnpj}>{formatCnpj(customer.cnpj)}</Text>
          <View style={styles.identityStatus}><AppIcon name={customer.active?"checkmark-circle":"time-outline"} color={customer.active?"#C7F5E2":"#FFE2A8"} size={15}/><Text style={styles.identityStatusText}>{(customer.statusCadastro||customer.status||(customer.active?"APROVADO":"PENDENTE")).replaceAll("_"," ")}</Text></View>
        </View>

        {rejected?<View style={styles.rejectionCard}><View style={styles.rejectionIcon}><AppIcon name="alert-circle-outline" color="#B42336" size={25}/></View><View style={styles.rejectionCopy}><Text style={styles.rejectionTitle}>Cadastro rejeitado</Text><Text style={styles.rejectionLabel}>MOTIVO INFORMADO</Text><Text style={styles.rejectionReason}>{customer.rejection_reason||"A retaguarda não informou o motivo da rejeição."}</Text></View><Pressable accessibilityRole="button" onPress={adjustAndResubmit} style={({pressed})=>[styles.resubmitButton,pressed&&styles.pressed]}><AppIcon name="create-outline" color="#FFFFFF" size={19}/><Text style={styles.resubmitButtonText}>Ajustar e reenviar</Text><AppIcon name="arrow-forward" color="#FFFFFF" size={18}/></Pressable></View>:null}

        {(canCall || canEmail) ? <View style={styles.actions}>
          {canCall ? <ContactAction label="Ligar" icon="call-outline" color="#02779F" background="#E5F6FC" onPress={()=>void openContact(`tel:${phone}`,"o telefone")}/> : null}
          {canCall ? <ContactAction label="WhatsApp" icon="logo-whatsapp" color="#128C7E" background="#E5F8F0" onPress={()=>void openWhatsApp()}/> : null}
          {canEmail ? <ContactAction label="E-mail" icon="mail-outline" color="#B54708" background="#FFF1E5" onPress={()=>void openContact(`mailto:${customer.email}`,"o e-mail")}/> : null}
        </View> : null}

        {isAdmin?<View style={styles.adminActions}>
          <AdminAction label="Editar cadastro" icon="create-outline" onPress={()=>{onClose();router.push({pathname:"/new-customer",params:{id:String(customer.id)}});}}/>
          <AdminAction label="Ficha do cliente" icon="document-text-outline" onPress={()=>void shareCustomerPdf("registration")}/>
          <AdminAction label="Análise do cliente" icon="analytics-outline" onPress={()=>void shareCustomerPdf("performance")}/>
        </View>:null}
        <Text style={styles.sectionTitle}>Dados cadastrais</Text>
        <InfoRow label="Razão social" value={customer.legal_name} />
        <InfoRow label="CNPJ" value={formatCnpj(customer.cnpj)} />
        <InfoRow label="Situação" value={(customer.statusCadastro||customer.status||"").replaceAll("_"," ")} />
        <InfoRow label="Inscrição estadual" value={customer.state_registration} />
        <InfoRow label="Telefone" value={formattedPhone(customer.phone)} />
        <InfoRow label="E-mail" value={customer.email} />
        <InfoRow label="Endereço" value={customer.address} multiline />
      </ScrollView>
      <FeedbackDialog visible={Boolean(dialog)} title={dialog?.title||"Aviso"} message={dialog?.message||""} tone={dialog?.tone} onClose={()=>setDialog(null)}/>
    </SafeAreaView>
  );
}

function ContactAction({label,icon,color,background,onPress}:{label:string;icon:AppIconName;color:string;background:string;onPress:()=>void}){
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({pressed})=>[styles.action,pressed&&styles.pressed]}><View style={[styles.actionIcon,{backgroundColor:background}]}><AppIcon name={icon} color={color} size={23}/></View><Text style={styles.actionText}>{label}</Text></Pressable>;
}

function AdminAction({label,icon,onPress}:{label:string;icon:AppIconName;onPress:()=>void}){
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[styles.adminAction,pressed&&styles.pressed]}><View style={styles.adminActionIcon}><AppIcon name={icon} color={colors.brand} size={20}/></View><Text style={styles.adminActionText}>{label}</Text><AppIcon name="chevron-forward" color="#91A1B4" size={18}/></Pressable>;
}

function InfoRow({ label, value, multiline = false }: { label: string; value?: string | null; multiline?: boolean }) {
  return <View style={[styles.infoRow, multiline && styles.infoRowMultiline]}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={[styles.infoValue, multiline && styles.infoValueMultiline]}>{value || "Não informado"}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  headerIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FB" },
  filters: { paddingTop: 15, paddingBottom: 8 }, searchWrap: { height: 54, flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal:16,borderRadius: 16, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: colors.surface, paddingHorizontal: 14 }, filterChips:{gap:8,paddingHorizontal:16,paddingTop:12,paddingBottom:2},filterChip:{height:36,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:11,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},filterChipActive:{borderColor:colors.brand,backgroundColor:colors.brand},filterChipText:{color:colors.muted,fontSize:10,fontWeight:"800"},filterChipTextActive:{color:"#FFFFFF"},filterDot:{width:7,height:7,borderRadius:4},filterDotApproved:{backgroundColor:colors.success},filterDotPending:{backgroundColor:"#E0A000"},filterDotRejected:{backgroundColor:colors.danger},filterCount:{minWidth:18,height:18,borderRadius:9,textAlign:"center",textAlignVertical:"center",color:colors.muted,fontSize:9,fontWeight:"900",backgroundColor:"#EDF2F3",paddingHorizontal:4},filterCountActive:{color:colors.brand,backgroundColor:"#FFFFFF"},
  search: { flex: 1, height: "100%", color: colors.ink, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 90, flexGrow: 1 },
  card: { flexDirection: "row", alignItems: "center", minHeight: 92, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  pressed: { opacity: 0.76 },
  avatar: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F2FA" },
  avatarText: { color: colors.brandDark, fontSize: 14, fontWeight: "900" },
  cardCopy: { flex: 1, marginLeft: 13 },
  tradeName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  legalName: { color: colors.muted, fontSize: 11, marginTop: 3 },
  cardMeta:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:7,marginTop:7}, cnpjWrap:{flexDirection:"row",alignItems:"center",gap:4},
  cnpj: { color: colors.brand, fontSize: 10, fontWeight: "800" },
  customerStatus:{color:"#8A6700",fontSize:8,fontWeight:"900",backgroundColor:"#FFF7D6",paddingHorizontal:7,paddingVertical:3,borderRadius:999},
  customerStatusApproved:{color:"#05724D",backgroundColor:"#E5F7EF"},
  customerStatusRejected:{color:"#B42336",backgroundColor:"#FDEBED"},
  modal: { flex: 1, backgroundColor: colors.canvas },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalHeaderCopy:{flex:1},
  modalEyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 2, maxWidth: 270 },
  close: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3F7" },
  modalContent: { padding: 20, paddingBottom: 40 },
  identity: { alignItems: "center", borderRadius: 24, backgroundColor: colors.brandDark, paddingHorizontal: 22, paddingVertical: 25 },
  largeAvatar: { width: 66, height: 66, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  largeAvatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  identityName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 14 },
  identityLegal: { color: "#C9DEEF", fontSize: 12, textAlign: "center", marginTop: 4 },
  identityCnpj: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", marginTop: 10 },
  identityStatus:{flexDirection:"row",alignItems:"center",gap:5,marginTop:12,paddingHorizontal:10,paddingVertical:5,borderRadius:999,backgroundColor:"rgba(255,255,255,.12)"}, identityStatusText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},
  rejectionCard:{marginTop:14,borderRadius:19,borderWidth:1,borderColor:"#F2B8C0",backgroundColor:"#FFF4F5",padding:15},rejectionIcon:{width:46,height:46,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#FDE1E5"},rejectionCopy:{marginTop:11},rejectionTitle:{color:"#981B2C",fontSize:16,fontWeight:"900"},rejectionLabel:{color:"#B42336",fontSize:8,fontWeight:"900",letterSpacing:1,marginTop:11},rejectionReason:{color:"#6F2530",fontSize:12,lineHeight:18,marginTop:4},resubmitButton:{height:52,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderRadius:15,backgroundColor:"#B42336",marginTop:14},resubmitButtonText:{color:"#FFFFFF",fontSize:13,fontWeight:"900"},
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  action: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 88, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, actionIcon:{width:42,height:42,borderRadius:14,alignItems:"center",justifyContent:"center"},
  actionText: { color: colors.ink, fontSize: 11, fontWeight: "900", marginTop: 7 },
  adminActions:{gap:9,marginTop:14},adminAction:{minHeight:58,flexDirection:"row",alignItems:"center",gap:11,paddingHorizontal:13,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},adminActionIcon:{width:38,height:38,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#E8F3FB"},adminActionText:{flex:1,color:colors.ink,fontSize:12,fontWeight:"800"},
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 25, marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 54, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoRowMultiline: { alignItems: "flex-start" },
  infoLabel: { width: 116, color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  infoValue: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "600", textAlign: "right" },
  infoValueMultiline: { lineHeight: 19 },
  fab: { position: "absolute", right: 20, bottom: 18, zIndex: 10, width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, shadowColor: colors.brandDark, shadowOpacity: 0.28, shadowRadius: 9, elevation: 6 },
});
