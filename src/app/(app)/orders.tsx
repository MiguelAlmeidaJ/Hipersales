import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  FlatList,
  Alert,
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
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { api, authenticatedResource, useMockApi } from "@/lib/api";
import { useSession } from "@/contexts/session-context";
import { SelectField } from "@/components/form-controls";
import { PrimaryButton, SecondaryButton } from "@/components/module-ui";
import { dateTime, formatCnpj, money, shortDate } from "@/lib/format";
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
  proposal.net_value ?? (proposal.items ?? []).reduce((total, item) => total + Number(item.quantity) * Number(item.negotiated_price), 0);
const orderNumber = (proposal: Proposal) =>
  `${proposal.order_number || proposal.id}/${/bonific/i.test(proposal.order_type) ? "B" : "V"}`;

function StatusBadge({ status }: { status: string }) {
  const palette = statusColors[status] ?? { background: "#EEF2F6", text: colors.muted };
  return <View style={[styles.badge, { backgroundColor: palette.background }]}><Text style={[styles.badgeText, { color: palette.text }]}>{statusLabels[status] ?? status.replaceAll("_", " ")}</Text></View>;
}

export default function OrdersScreen() {
  const {user}=useSession(); const admin=user?.role==="admin"||user?.role==="dev";
  const [orders, setOrders] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
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

  async function openOrder(item: Proposal) {
    setSelected(item);
    try {
      const detail = await api<Proposal>((`/api/proposals/${item.id}`) as `/api/${string}`);
      setSelected((current) => current?.id === item.id ? detail : current);
    } catch {
      // A lista já contém o resumo necessário; o detalhe pode ser atualizado ao tentar novamente.
    }
  }

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
      {!admin||useMockApi?<Pressable accessibilityLabel="Criar proposta" accessibilityRole="button" onPress={() => router.push("/new-order")} style={styles.fab}><Text style={styles.fabPlus}>＋</Text></Pressable>:null}

      {loading && !orders.length ? <LoadingState label="Carregando pedidos…" /> : error && !orders.length ? <ErrorState message={error} onRetry={() => load()} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.brand]} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState title="Nenhum pedido encontrado" description="Altere a busca ou o filtro de status para consultar outros pedidos." />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => void openOrder(item)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.cardTop}><Text style={styles.number}>Pedido {orderNumber(item)}</Text><StatusBadge status={item.status} /></View>
              <Text style={styles.customer} numberOfLines={1}>{item.customer_trade_name || item.customer_name}</Text>
              <Text style={styles.company} numberOfLines={1}>{item.company_name}</Text>
              <View style={styles.cardBottom}><Text style={styles.date}>{shortDate(item.created_at)}</Text><Text style={styles.total}>{money(proposalTotal(item))}</Text></View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={Boolean(selected)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected ? <OrderDetails key={`${selected.id}-${selected.items?.length ?? 0}`} proposal={selected} admin={admin&&useMockApi} onSaved={()=>{setSelected(null);void load(true);}} onClose={() => setSelected(null)} /> : null}
      </Modal>
    </View>
  );
}

function Detail({ label, value, icon, wide = false }: { label: string; value?: string | null; icon: AppIconName; wide?: boolean }) {
  return <View style={[styles.detail, wide && styles.detailWide]}><View style={styles.detailIcon}><AppIcon name={icon} color={colors.brand} size={17} /></View><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || "—"}</Text></View></View>;
}

function OrderDetails({ proposal, onClose, admin, onSaved }: { proposal: Proposal; onClose: () => void; admin:boolean; onSaved:()=>void }) {
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [lines,setLines]=useState((proposal.items||[]).map(item=>({product_id:item.product_id,quantity:String(item.quantity),negotiated_price:String(item.negotiated_price)})));
  const [products,setProducts]=useState<{id:number;name:string;code:string;price:number}[]>([]);
  const [selectedProduct,setSelectedProduct]=useState("");
  useEffect(()=>{
    if(!admin||!proposal.company_id)return;
    let active=true;
    api<{products:{id:number;name:string;code:string;price:number;company_id:number;active:boolean|number}[]}>(("/api/admin/products?company_id="+proposal.company_id) as never)
      .then(result=>{if(active)setProducts(result.products.filter(p=>p.company_id===proposal.company_id&&Boolean(p.active)));}).catch(()=>{});
    return()=>{active=false;};
  },[admin,proposal.company_id]);
  const [fields,setFields]=useState({status:proposal.status,admin_notes:proposal.admin_notes||"",
    delivery_forecast:proposal.delivery_forecast||"",industry_order_number:proposal.industry_order_number||"",
    invoice_number:proposal.invoice_number||"",billing_date:proposal.billing_date?.slice(0,10)||"",
    delivered_date:proposal.delivered_date?.slice(0,10)||"",
    payment_terms:proposal.payment_terms||"",freight_type:proposal.freight_type||"",delivery_type:proposal.delivery_type||"",
    scheduled_delivery_date:proposal.scheduled_delivery_date?.slice(0,10)||"",discount_percent:String(proposal.discount_percent??0),
    commission_percent:String(proposal.commission_percent??0),discount_on:proposal.discount_on||"Sem descontos",invoice_type:proposal.invoice_type||""});
  async function updateOrder(){
    setBusy(true);setError("");
    try{
      const discount=Number(fields.discount_percent), commission=Number(fields.commission_percent);
      if(!Number.isFinite(discount)||discount<0||discount>100||!Number.isFinite(commission)||commission<0||commission>100)throw new Error("Revise os percentuais de desconto e comissão.");
      if(!lines.length||lines.some(item=>!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||!Number.isFinite(Number(item.negotiated_price))||Number(item.negotiated_price)<0))throw new Error("Revise quantidades e preços dos itens.");
      await api(("/api/admin/proposals/"+proposal.id) as never,{method:"PATCH",body:JSON.stringify({...fields,discount_percent:discount,commission_percent:commission,items:lines.map(item=>({product_id:item.product_id,quantity:Number(item.quantity),negotiated_price:Number(item.negotiated_price)}))})});
      Alert.alert("Pedido","Informações atualizadas.");onSaved();
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível salvar.");}
    finally{setBusy(false);}
  }
  async function shareInvoice(){
    try{
      const resource=authenticatedResource(("/api/proposals/"+proposal.id+"/invoice-pdf") as never);
      if(!resource.headers.Authorization)throw new Error("Sessão expirada.");
      const target=FileSystem.cacheDirectory+"nota-fiscal-"+proposal.id+".pdf";
      const result=await FileSystem.downloadAsync(resource.url,target,{headers:resource.headers});
      if(result.status!==200)throw new Error("A nota fiscal não pôde ser obtida.");
      await Sharing.shareAsync(result.uri,{mimeType:"application/pdf"});
    }catch(cause){Alert.alert("Nota fiscal",cause instanceof Error?cause.message:"Falha no arquivo.");}
  }
  async function uploadInvoice(){
    try{
      const selected=await DocumentPicker.getDocumentAsync({type:"application/pdf",copyToCacheDirectory:true});
      if(selected.canceled||!selected.assets.length)return;
      const file=selected.assets[0];
      if((file.size||0)>10*1024*1024)throw new Error("O PDF deve ter até 10 MB.");
      setBusy(true);setError("");
      const content=await FileSystem.readAsStringAsync(file.uri,{encoding:FileSystem.EncodingType.Base64});
      await api(("/api/admin/proposals/"+proposal.id+"/invoice-pdf") as never,{method:"POST",body:JSON.stringify({filename:file.name,content}),timeoutMs:60000});
      Alert.alert("Nota fiscal","PDF anexado com sucesso.");onSaved();
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao anexar nota fiscal.");}
    finally{setBusy(false);}
  }
  return (
    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
      <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>DETALHES DO PEDIDO</Text><Text style={styles.modalTitle}>Pedido {orderNumber(proposal)}</Text></View><Pressable accessibilityLabel="Fechar detalhes" onPress={onClose} style={styles.close}><AppIcon name="close" color={colors.ink} size={24}/></Pressable></View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}><StatusBadge status={proposal.status}/><Text style={styles.summaryOrder}>{proposal.purchase_order ? `OC ${proposal.purchase_order}` : `#${proposal.id}`}</Text></View>
          <Text style={styles.summaryCustomer}>{proposal.customer_trade_name || proposal.customer_name}</Text>
          {proposal.customer_trade_name ? <Text style={styles.summaryLegalName}>{proposal.customer_name}</Text> : null}
          <View style={styles.summaryMeta}><Text style={styles.summaryCompany}>{proposal.company_name}</Text>{proposal.customer_cnpj ? <Text style={styles.summaryCompany}>{formatCnpj(proposal.customer_cnpj)}</Text> : null}</View>
          <View style={styles.summaryAmount}><Text style={styles.summaryAmountLabel}>VALOR LÍQUIDO</Text><Text style={styles.summaryTotal}>{money(proposalTotal(proposal))}</Text></View>
          <View style={styles.summaryFacts}><View style={styles.summaryFact}><Text style={styles.summaryFactLabel}>Data</Text><Text style={styles.summaryFactValue}>{shortDate(proposal.created_at)}</Text></View><View style={styles.factDivider}/><View style={styles.summaryFact}><Text style={styles.summaryFactLabel}>Itens</Text><Text style={styles.summaryFactValue}>{proposal.items?.length || 0}</Text></View><View style={styles.factDivider}/><View style={styles.summaryFact}><Text style={styles.summaryFactLabel}>Tipo</Text><Text style={styles.summaryFactValue}>{proposal.order_type}</Text></View></View>
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Informações comerciais</Text><Text style={styles.sectionCaption}>Condições registradas no pedido</Text></View>
        <View style={styles.detailsGrid}>
          <Detail icon="person-outline" label="Representante" value={proposal.seller_name} wide />
          <Detail icon="card-outline" label="Pagamento" value={proposal.payment_terms} />
          <Detail icon="pricetag-outline" label="Desconto" value={proposal.discount_percent!=null?String(proposal.discount_percent)+"%":null}/>
          <Detail icon="cube-outline" label="Frete" value={proposal.freight_type} />
          <Detail icon="flash-outline" label="Entrega" value={proposal.delivery_type} />
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Entrega e faturamento</Text><Text style={styles.sectionCaption}>Prazos e documentos da indústria</Text></View>
        <View style={styles.detailsGrid}>
          <Detail icon="time-outline" label="Prazo da empresa" value={proposal.lead_time_days!=null?String(proposal.lead_time_days)+" dias":null}/>
          <Detail icon="calendar-outline" label="Previsão de entrega" value={proposal.delivery_forecast}/>
          <Detail icon="business-outline" label="Pedido da indústria" value={proposal.industry_order_number}/>
          <Detail icon="document-text-outline" label="Nota fiscal" value={proposal.invoice_number}/>
        </View>
        {proposal.invoice_number?<View style={styles.actionsCard}><View style={styles.actionsTitleRow}><View style={styles.actionsIcon}><AppIcon name="share-social-outline" color={colors.brand} size={20}/></View><View><Text style={styles.actionsTitle}>Nota fiscal</Text><Text style={styles.actionsCaption}>Baixe o PDF anexado pela retaguarda</Text></View></View><SecondaryButton title="Baixar nota fiscal PDF" onPress={()=>void shareInvoice()}/></View>:null}
        {admin && <View style={{marginVertical:15,gap:12}}>
          <SecondaryButton title={editing?"Fechar edição":"Editar dados da retaguarda"} onPress={()=>setEditing(!editing)}/>
          {editing && <>
            <SelectField label="Status do pedido" value={fields.status} onChange={value=>setFields(old=>({...old,status:value}))}
              options={Object.entries(statusLabels).map(([value,label])=>({value,label}))}/>
            {([["industry_order_number","Pedido na indústria"],["invoice_number","Número da NF"],["delivery_forecast","Previsão de entrega"],["billing_date","Data do faturamento (AAAA-MM-DD)"],["delivered_date","Data da entrega (AAAA-MM-DD)"],["admin_notes","Observações da retaguarda"],["payment_terms","Condição de pagamento"],["freight_type","Tipo de frete"],["delivery_type","Entrega"],["scheduled_delivery_date","Entrega programada (AAAA-MM-DD)"],["discount_percent","Desconto (%)"],["commission_percent","Comissão (%)"],["discount_on","Aplicação do desconto"],["invoice_type","Tipo de nota"]] as const).map(([key,label])=>
              <View key={key} style={{gap:5}}><Text style={{fontSize:12,color:colors.muted,fontWeight:"700"}}>{label}</Text>
                <TextInput multiline={key==="admin_notes"} value={fields[key]} onChangeText={value=>setFields(old=>({...old,[key]:value}))}
                  style={{borderWidth:1,borderColor:colors.border,borderRadius:12,padding:12,color:colors.ink,backgroundColor:"#fff"}}/>
              </View>)}
            <Text style={{fontSize:16,fontWeight:"800",color:colors.ink,marginTop:9}}>Itens do pedido</Text>
            <SelectField label="Adicionar produto" value={selectedProduct} onChange={value=>setSelectedProduct(value)} searchable
              options={products.filter(p=>!lines.some(item=>item.product_id===p.id)).map(p=>({value:String(p.id),label:p.name,detail:p.code}))}/>
            <SecondaryButton title="Adicionar produto selecionado" disabled={!selectedProduct}
              onPress={()=>{const product=products.find(p=>String(p.id)===selectedProduct);if(!product)return;setLines(old=>[...old,{product_id:product.id,quantity:"1",negotiated_price:String(product.price||0)}]);setSelectedProduct("");}}/>
            {lines.map((line,index)=><View key={line.product_id} style={{borderWidth:1,borderColor:colors.border,borderRadius:13,padding:12,gap:7}}>
              <Text style={{fontSize:13,fontWeight:"800",color:colors.ink}}>{products.find(p=>p.id===line.product_id)?.name||proposal.items?.find(item=>item.product_id===line.product_id)?.name||"Produto "+line.product_id}</Text>
              <Text style={{fontSize:12,color:colors.muted}}>Quantidade</Text>
              <TextInput keyboardType="decimal-pad" value={line.quantity} onChangeText={value=>setLines(old=>old.map((item,i)=>i===index?{...item,quantity:value}:item))}
                style={{borderWidth:1,borderColor:colors.border,borderRadius:10,padding:10,color:colors.ink}}/>
              <Text style={{fontSize:12,color:colors.muted}}>Preço negociado</Text>
              <TextInput keyboardType="decimal-pad" value={line.negotiated_price} onChangeText={value=>setLines(old=>old.map((item,i)=>i===index?{...item,negotiated_price:value}:item))}
                style={{borderWidth:1,borderColor:colors.border,borderRadius:10,padding:10,color:colors.ink}}/>
              <SecondaryButton title="Remover item" danger disabled={lines.length<=1} onPress={()=>setLines(old=>old.filter((_,i)=>i!==index))}/>
            </View>)}
            <PrimaryButton title="Salvar alterações" busy={busy} onPress={()=>void updateOrder()}/>
            <SecondaryButton title="Anexar nota fiscal PDF" disabled={busy} onPress={()=>void uploadInvoice()}/>
          </>}
          {error?<Text style={{color:colors.danger,fontSize:13}}>{error}</Text>:null}
        </View>}
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Itens do pedido</Text><Text style={styles.sectionCaption}>{proposal.items?.length ?? 0} produto(s)</Text></View>
        <View style={styles.itemsCard}>{(proposal.items ?? []).map((item,index) => <View key={item.id} style={[styles.itemRow,index>0&&styles.itemBorder]}><View style={styles.itemIndex}><Text style={styles.itemIndexText}>{index+1}</Text></View><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemCode}>Código {item.code}</Text><View style={styles.itemNumbers}><Text style={styles.itemMeta}>{item.quantity} {item.unit || "un."}</Text><Text style={styles.itemMeta}>× {money(item.negotiated_price)}</Text></View></View><View style={styles.itemTotalWrap}><Text style={styles.itemTotalLabel}>TOTAL</Text><Text style={styles.itemTotal}>{money(item.quantity * item.negotiated_price)}</Text></View></View>)}<View style={styles.itemsTotal}><Text style={styles.itemsTotalLabel}>Total do pedido</Text><Text style={styles.itemsTotalValue}>{money(proposalTotal(proposal))}</Text></View></View>
        {proposal.notes ? <><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Observações</Text></View><View style={styles.notes}><AppIcon name="chatbox-ellipses-outline" color={colors.muted} size={20}/><Text style={styles.notesText}>{proposal.notes}</Text></View></> : null}
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Histórico</Text><Text style={styles.sectionCaption}>Atualizações deste pedido</Text></View>
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
  modalContent: { padding: 16, paddingBottom: 40 },
  summaryCard: { borderRadius: 24, backgroundColor: colors.brandDark, padding: 20, overflow: "hidden" },
  summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryOrder: { color: "#AFC7C9", fontSize: 11, fontWeight: "800" },
  summaryCustomer: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontWeight: "900", marginTop: 18 },
  summaryLegalName: { color: "#C9DEDF", fontSize: 12, marginTop: 4 },
  summaryMeta: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginTop: 7 },
  summaryCompany: { color: "#AFC7C9", fontSize: 12, fontWeight: "600" },
  summaryAmount: { marginTop: 24 },
  summaryAmountLabel: { color: "#8EAAAC", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  summaryTotal: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginTop: 3 },
  summaryFacts: { flexDirection: "row", alignItems: "stretch", marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.15)" },
  summaryFact: { flex: 1 }, summaryFactLabel: { color: "#8EAAAC", fontSize: 9, fontWeight: "800", textTransform: "uppercase" }, summaryFactValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", marginTop: 4 }, factDivider: { width: 1, backgroundColor: "rgba(255,255,255,.15)", marginHorizontal: 12 },
  sectionHeading: { marginTop: 26, marginBottom: 11 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  sectionCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detail: { width: "48%", flexGrow: 1, minHeight: 78, flexDirection: "row", alignItems: "flex-start", borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 13 },
  detailWide: { width: "100%" }, detailIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF4F4", marginRight: 10 }, detailCopy: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 5 },
  actionsCard: { gap: 10, marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, actionsTitleRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 3 }, actionsIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EDF4F4" }, actionsTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" }, actionsCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
  itemsCard: { overflow: "hidden", borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 15, paddingHorizontal: 13 }, itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemIndex: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF4F4" }, itemIndexText: { color: colors.brand, fontSize: 11, fontWeight: "900" },
  itemCopy: { flex: 1 }, itemName: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: "900" }, itemCode: { color: colors.muted, fontSize: 10, marginTop: 2 }, itemNumbers: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }, itemMeta: { color: colors.muted, fontSize: 10 }, itemTotalWrap: { alignItems: "flex-end" }, itemTotalLabel: { color: colors.muted, fontSize: 8, fontWeight: "800" }, itemTotal: { color: colors.ink, fontSize: 12, fontWeight: "900", marginTop: 3 },
  itemsTotal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#F1F6F5", borderTopWidth: 1, borderTopColor: colors.border }, itemsTotalLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" }, itemsTotalValue: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  notes: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 15 }, notesText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 20 },
  timeline: { flexDirection: "row", paddingBottom: 16 }, timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 4, marginRight: 12 }, timelineCopy: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12, paddingBottom: 5 }, timelineTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, timelineMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, timelineNotes: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  muted: { color: colors.muted, fontSize: 13 },
  fab: { position: "absolute", right: 20, bottom: 18, zIndex: 10, width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, shadowColor: colors.brandDark, shadowOpacity: 0.28, shadowRadius: 9, elevation: 6 },
  fabPlus: { color: "#FFFFFF", fontSize: 28, fontWeight: "500" },
});
