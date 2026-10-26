import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { Field, FormSection, SelectField, type SelectOption } from "@/components/form-controls";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Customer } from "@/types/commercial";

type PaymentTerm = { id: number; name: string };
type PriceTable = { id: number; description: string; companyId: number; companyName: string; freight?: string; leadTimeDays?: number; minimum?: number; defaultPaymentId?: number; defaultPaymentName?: string; paymentTerms: PaymentTerm[] };
type Product = { id: number; name: string; code: string; unit: string; price?: number };
type Line = { productId: number; quantity: string };
type Dialog = { title: string; message: string; tone: "error" | "success" | "info"; navigate?: boolean } | null;
type Form = { companyId: string; customerId: string; tableId: string; paymentId: string; orderType: "Venda" | "Bonificacao"; billingPercent: string; deliveryFormat: "Imediata" | "Programada"; scheduledDate: string; notes: string };

const initial: Form = { companyId: "", customerId: "", tableId: "", paymentId: "", orderType: "Venda", billingPercent: "100", deliveryFormat: "Imediata", scheduledDate: "", notes: "" };
const orderSteps = [
  { title: "Cliente e tabela", short: "Cliente" },
  { title: "Condições do pedido", short: "Condições" },
  { title: "Produtos", short: "Produtos" },
  { title: "Revisão", short: "Revisão" },
];
const decimal = (value: string) => Number(value.replace(",", "."));
const readList = (data: unknown): any[] => Array.isArray(data) ? data : typeof data === "object" && data !== null ? ((data as any).itens || (data as any).tabelas || (data as any).tabelasPreco || (data as any).tabelasPrecos || (data as any).produtos || (data as any).dados || (data as any).resultado || []) : [];
const text = (...values: unknown[]) => String(values.find((value) => typeof value === "string" && value.trim()) || "");
const number = (...values: unknown[]) => Number(values.find((value) => value !== undefined && value !== null && value !== "") || 0);

function normalizeTables(data: unknown): PriceTable[] {
  return readList(data).map((row) => {
    const company = row.empresa || {};
    const terms = row.condicoesPagamento || row.prazos || row.condPagto || [];
    return {
      id: number(row.idTabela, row.id), description: text(row.descricao, row.nome, `Tabela ${row.idTabela || row.id}`),
      companyId: number(row.idEmpresa, company.id), companyName: text(row.empresaNome, company.nome, company.razaoSocial, `Empresa ${row.idEmpresa || company.id}`),
      freight: text(row.frete), leadTimeDays: number(row.prazoEntregaDias, row.leadTimeDias), minimum: number(row.pedidoMinimo, row.valorPedidoMinimo),
      defaultPaymentId: number(row.idCondPagto, row.condicaoPagamento?.id) || undefined,
      defaultPaymentName: text(row.condPagtoDescricao, row.condicaoPagamento?.descricao) || undefined,
      paymentTerms: Array.isArray(terms) ? terms.map((term: any) => ({ id: number(term.idCondPagto, term.id), name: text(term.descricao, term.nome) })).filter((term: PaymentTerm) => term.id) : [],
    };
  }).filter((table) => table.id && table.companyId);
}

function normalizeProducts(data: unknown): Product[] {
  return readList(data).map((row) => ({ id: number(row.idProduto, row.id), name: text(row.descricao, row.nome, `Produto ${row.idProduto || row.id}`), code: text(row.codigo, row.referencia, row.idProduto), unit: text(row.unidade, row.unidadeVenda), price: row.precoUnitario !== undefined || row.preco !== undefined ? number(row.precoUnitario, row.preco) : undefined })).filter((product) => product.id);
}

function validDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function newIdempotencyKey() { return `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function maskDate(value: string) { return value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3"); }

export default function NewOrderScreen() {
  const { status } = useSession();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(initial);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    Promise.all([api<{ customers: Customer[] }>("/api/customers"), api<unknown>("/api/price-tables"), api<unknown>("/api/payment-terms")])
      .then(([customerData, tableData, termData]) => { if (active) { const terms=readList(termData).map(row=>({id:number(row.id),name:text(row.descricao,row.nome)})).filter(term=>term.id);setCustomers((customerData.customers || []).filter(customer=>customer.active));setTables(normalizeTables(tableData).map(table=>({...table,paymentTerms:terms}))); } })
      .catch((cause) => { if (active) setDialog({ title: "Não foi possível preparar a proposta", message: cause instanceof Error ? cause.message : "Falha ao carregar clientes e tabelas de preço.", tone: "error" }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    if (!form.companyId || !form.tableId || status !== "authenticated") return;
    let active = true;
    api<unknown>((`/api/order-products?idEmpresa=${form.companyId}&idTabela=${form.tableId}&tamanho=200`) as `/api/${string}`)
      .then((data) => { if (active) setProducts(normalizeProducts(data)); })
      .catch((cause) => { if (active) setDialog({ title: "Produtos indisponíveis", message: cause instanceof Error ? cause.message : "Não foi possível carregar os produtos desta tabela.", tone: "error" }); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [form.companyId, form.tableId, status]);

  const companies = useMemo(() => Array.from(new Map(tables.map((table) => [table.companyId, { id: table.companyId, name: table.companyName }])).values()), [tables]);
  const selectedTable = tables.find((table) => String(table.id) === form.tableId);
  const companyOptions = useMemo<SelectOption[]>(() => companies.map((company) => ({ value: String(company.id), label: company.name })), [companies]);
  const tableOptions = useMemo<SelectOption[]>(() => tables.filter((table) => String(table.companyId) === form.companyId).map((table) => ({ value: String(table.id), label: table.description, detail: [table.freight, table.leadTimeDays ? `${table.leadTimeDays} dias` : "", table.minimum ? `Mínimo ${money(table.minimum)}` : ""].filter(Boolean).join(" · ") })), [form.companyId, tables]);
  const customerOptions = useMemo<SelectOption[]>(() => customers.map((customer) => ({ value: String(customer.id), label: customer.trade_name || customer.legal_name, detail: [customer.legal_name, customer.cnpj].filter(Boolean).join(" · ") })), [customers]);
  const productOptions = useMemo<SelectOption[]>(() => products.filter((product) => !lines.some((line) => line.productId === product.id)).map((product) => ({ value: String(product.id), label: product.name, detail: [product.code, product.unit, product.price !== undefined ? money(product.price) : "Preço definido pela tabela"].filter(Boolean).join(" · ") })), [lines, products]);
  const paymentOptions = useMemo<SelectOption[]>(() => [{ value: "", label: selectedTable?.defaultPaymentName ? `Usar ${selectedTable.defaultPaymentName}` : "Usar prazo padrão da tabela" }, ...(selectedTable?.paymentTerms || []).map((term) => ({ value: String(term.id), label: term.name }))], [selectedTable]);
  const estimatedTotal = useMemo(() => lines.reduce((sum, line) => { const product = products.find((item) => item.id === line.productId); return sum + decimal(line.quantity || "0") * (product?.price || 0); }, 0), [lines, products]);

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (status === "loading" || loading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Carregando dados comerciais…</Text></SafeAreaView>;

  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function fail(message: string) { setDialog({ title: "Revise a proposta", message, tone: "error" }); return false; }
  function changeCompany(value: string) { setForm((current) => ({ ...current, companyId: value, tableId: "", paymentId: "" })); setProducts([]); setLines([]); setProductId(""); }
  function changeTable(value: string) { setForm((current) => ({ ...current, tableId: value, paymentId: "" })); setProducts([]); setLines([]); setProductId(""); setProductsLoading(Boolean(value)); }
  function validateStep() {
    if (step === 0 && (!form.companyId || !form.customerId || !form.tableId)) return fail("Selecione empresa, cliente e tabela de preço.");
    if (step === 1 && form.deliveryFormat === "Programada" && !validDate(form.scheduledDate)) return fail("Informe a data programada no formato DD/MM/AAAA.");
    if (step === 2 && !lines.length) return fail("Adicione pelo menos um produto ao pedido.");
    if (step === 2 && lines.some((line) => !(decimal(line.quantity) > 0))) return fail("Todas as quantidades devem ser maiores que zero.");
    return true;
  }
  function validateOrder() {
    if (!form.companyId || !form.customerId || !form.tableId) { setStep(0); return fail("Selecione empresa, cliente e tabela de preço."); }
    if (form.deliveryFormat === "Programada" && !validDate(form.scheduledDate)) { setStep(1); return fail("Informe a data programada no formato DD/MM/AAAA."); }
    if (!lines.length) { setStep(2); return fail("Adicione pelo menos um produto ao pedido."); }
    if (lines.some((line) => !(decimal(line.quantity) > 0))) { setStep(2); return fail("Todas as quantidades devem ser maiores que zero."); }
    return true;
  }
  function next() { if (validateStep()) setStep((current) => Math.min(orderSteps.length - 1, current + 1)); }
  function addProduct() { const product = products.find((item) => String(item.id) === productId); if (product) { setLines((current) => [...current, { productId: product.id, quantity: "1" }]); setProductId(""); } }
  function updateQuantity(id: number, quantity: string) { setLines((current) => current.map((line) => line.productId === id ? { ...line, quantity } : line)); }
  async function submit() {
    if (!validateOrder()) return;
    setBusy(true);
    try {
      const payload = {
        idEmpresa: Number(form.companyId), idCliente: Number(form.customerId), idTabela: Number(form.tableId),
        ...(form.paymentId ? { idCondPagto: Number(form.paymentId) } : {}), itens: lines.map((line) => ({ idProduto: line.productId, quantidade: decimal(line.quantity) })),
        tipoPedido: form.orderType, faturamentoPercentual: Number(form.billingPercent), formatoEntrega: form.deliveryFormat,
        ...(form.deliveryFormat === "Programada" ? { dataProgramada: form.scheduledDate } : {}),
        ...(form.notes.trim() ? { observacoes: form.notes.trim() } : {}),
      };
      const response = await api<{ mensagem?: string; repetido?: boolean; pedido?: { idPedido: number; status: string; valorLiquido?: number } }>("/api/orders", { method: "POST", headers: { "Idempotency-Key": idempotencyKey.current }, body: JSON.stringify(payload), timeoutMs: 30_000 });
      const order = response.pedido;
      setDialog({ title: response.repetido ? "Pedido já registrado" : "Proposta enviada", message: `${response.mensagem || "Pedido registrado com sucesso."}${order ? `\n\nPedido #${order.idPedido} · ${order.status}${order.valorLiquido !== undefined ? ` · ${money(order.valorLiquido)}` : ""}` : ""}`, tone: "success", navigate: true });
      idempotencyKey.current = newIdempotencyKey();
    } catch (cause) { setDialog({ title: "Não foi possível enviar", message: cause instanceof Error ? cause.message : "Revise os dados e tente novamente.", tone: "error" }); }
    finally { setBusy(false); }
  }
  function closeDialog() { const navigate = dialog?.navigate; setDialog(null); if (navigate) router.replace("/(app)/orders"); }

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Voltar" onPress={() => step ? setStep(step - 1) : router.back()} style={styles.back}><AppIcon name="arrow-back" color={colors.ink} size={22} /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>NOVO PEDIDO · ETAPA {step + 1}/{orderSteps.length}</Text><Text style={styles.title}>{orderSteps[step].title}</Text></View></View>
    <View style={styles.progress}>{orderSteps.map((item,index)=><Pressable key={item.short} accessibilityRole="button" accessibilityLabel={`Etapa ${index + 1}: ${item.title}${index < step ? ", concluída" : index === step ? ", atual" : ""}`} accessibilityState={{selected:index===step,disabled:index>=step}} disabled={index>=step} onPress={()=>setStep(index)} style={styles.progressItem}><View style={styles.progressRail}><View style={[styles.progressLine,index===0&&styles.progressLineHidden,index<=step&&index>0&&styles.progressLineActive]}/><View style={[styles.progressDot,index<=step&&styles.progressDotActive,index===step&&styles.progressDotCurrent]}>{index<step?<AppIcon name="checkmark" color="#FFF" size={14}/>:<Text style={[styles.progressNumber,index<=step&&styles.progressNumberActive]}>{index+1}</Text>}</View><View style={[styles.progressLine,index===orderSteps.length-1&&styles.progressLineHidden,index<step&&styles.progressLineActive]}/></View><Text numberOfLines={1} style={[styles.progressLabel,index===step&&styles.progressLabelActive,index<step&&styles.progressLabelDone]}>{item.short}</Text></Pressable>)}</View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step === 0 ?
        <FormSection title=""><SelectField searchable label="Empresa *" value={form.companyId} options={companyOptions} onChange={changeCompany} /><SelectField searchable label="Cliente *" value={form.customerId} options={customerOptions} onChange={(value) => update("customerId", value)} /><SelectField searchable disabled={!form.companyId} label="Tabela de preço *" value={form.tableId} options={tableOptions} onChange={changeTable} placeholder={form.companyId ? "Selecione a tabela" : "Selecione primeiro a empresa"} />{selectedTable ? <View style={styles.tableInfo}><AppIcon name="pricetag-outline" color={colors.brand} size={20} /><View style={styles.infoCopy}><Text style={styles.infoTitle}>{selectedTable.description}</Text><Text style={styles.infoText}>{[selectedTable.freight && `Frete ${selectedTable.freight}`, selectedTable.leadTimeDays && `Prazo ${selectedTable.leadTimeDays} dias`, selectedTable.minimum && `Pedido mínimo ${money(selectedTable.minimum)}`].filter(Boolean).join(" · ")}</Text></View></View> : null}</FormSection> : null}
      {step === 1 ? <FormSection title=""><SelectField label="Tipo de pedido" value={form.orderType} options={[{ value: "Venda", label: "Venda" }, { value: "Bonificacao", label: "Bonificação" }]} onChange={(value) => update("orderType", value as Form["orderType"])} /><SelectField label="Faturamento" value={form.billingPercent} options={[100, 50, 30, 10, 0].map((value) => ({ value: String(value), label: `${value}%` }))} onChange={(value) => update("billingPercent", value)} /><SelectField label="Condição de pagamento" value={form.paymentId} options={paymentOptions} onChange={(value) => update("paymentId", value)} disabled={!form.tableId} /><SelectField label="Formato de entrega" value={form.deliveryFormat} options={[{ value: "Imediata", label: "Imediata" }, { value: "Programada", label: "Programada" }]} onChange={(value) => update("deliveryFormat", value as Form["deliveryFormat"])} />{form.deliveryFormat === "Programada" ? <Field label="Data programada *" value={form.scheduledDate} onChangeText={(value) => update("scheduledDate", maskDate(value))} placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} /> : null}</FormSection> : null}
      {step === 2 ? <><FormSection title="" subtitle="Os preços são definidos exclusivamente pela tabela selecionada e não podem ser alterados."><SelectField searchable label="Produto" value={productId} options={productOptions} onChange={setProductId} disabled={productsLoading} placeholder={productsLoading ? "Carregando produtos…" : "Selecione um produto"} /><Pressable disabled={!productId} onPress={addProduct} style={[styles.secondary, !productId && styles.disabled]}><AppIcon name="add-circle-outline" color={colors.brand} size={20} /><Text style={styles.secondaryText}>Adicionar produto</Text></Pressable></FormSection><FormSection title={`Itens (${lines.length})`}>{lines.length ? lines.map((line) => { const product = products.find((item) => item.id === line.productId); return <View key={line.productId} style={styles.line}><View style={styles.lineHeader}><View style={styles.lineCopy}><Text style={styles.lineName}>{product?.name}</Text><Text style={styles.lineMeta}>{[product?.code, product?.unit, product?.price !== undefined ? money(product.price) : "Preço calculado pela API"].filter(Boolean).join(" · ")}</Text></View><Pressable accessibilityLabel={`Remover ${product?.name}`} onPress={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}><AppIcon name="trash-outline" color={colors.danger} size={20} /></Pressable></View><Field label="Quantidade" value={line.quantity} onChangeText={(value) => updateQuantity(line.productId, value)} keyboardType="decimal-pad" />{product?.price !== undefined ? <Text style={styles.lineTotal}>{money(product.price * decimal(line.quantity || "0"))}</Text> : null}</View>; }) : <View style={styles.empty}><AppIcon name="cart-outline" color={colors.muted} size={30} /><Text style={styles.emptyTitle}>Nenhum produto adicionado</Text><Text style={styles.emptyText}>Escolha os produtos e informe somente as quantidades.</Text></View>}</FormSection></> : null}
      {step === 3 ? <><FormSection title=""><Review label="Empresa" value={companies.find((item) => String(item.id) === form.companyId)?.name} /><Review label="Cliente" value={customers.find((item) => String(item.id) === form.customerId)?.trade_name || customers.find((item) => String(item.id) === form.customerId)?.legal_name} /><Review label="Tabela" value={selectedTable?.description} /><Review label="Tipo / faturamento" value={`${form.orderType === "Bonificacao" ? "Bonificação" : "Venda"} · ${form.billingPercent}%`} /><Review label="Entrega" value={`${form.deliveryFormat}${form.deliveryFormat === "Programada" ? ` · ${form.scheduledDate}` : ""}`} /><Review label="Itens" value={String(lines.length)} />{estimatedTotal > 0 ? <View style={styles.total}><Text style={styles.totalLabel}>Total estimado</Text><Text style={styles.totalValue}>{money(estimatedTotal)}</Text><Text style={styles.totalHint}>O valor definitivo será validado e calculado pela API.</Text></View> : null}</FormSection><FormSection title="Observações"><Field label="Observações do pedido" value={form.notes} onChangeText={(value) => update("notes", value)} multiline maxLength={1500} /></FormSection></> : null}
      <View style={styles.actions}>{step < 3 ? <Pressable onPress={next} style={styles.primary}><Text style={styles.primaryText}>Continuar</Text><AppIcon name="arrow-forward" color="#FFFFFF" size={19} /></Pressable> : <Pressable disabled={busy} onPress={() => void submit()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.primaryText}>Enviar proposta</Text><AppIcon name="paper-plane-outline" color="#FFFFFF" size={19} /></>}</Pressable>}{step > 0 ? <Pressable disabled={busy} onPress={() => setStep((current) => current - 1)} style={styles.previous}><Text style={styles.previousText}>Voltar</Text></Pressable> : null}</View>
    </ScrollView></KeyboardAvoidingView>
    <FeedbackDialog visible={Boolean(dialog)} title={dialog?.title || "Aviso"} message={dialog?.message || ""} tone={dialog?.tone} buttonLabel={dialog?.navigate ? "Ver meus pedidos" : "OK"} onClose={closeDialog} />
  </SafeAreaView>;
}

function Review({ label, value }: { label: string; value?: string }) { return <View style={styles.review}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value || "—"}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas }, loadingText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: colors.surface }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#EDF3F7" }, headerCopy: { flex: 1 }, eyebrow: { color: colors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 2 },
  progress: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#F2F4F4", borderBottomWidth: 1, borderBottomColor: colors.border }, progressItem: { flex: 1, alignItems: "center", gap: 6 }, progressRail: { width: "100%", flexDirection: "row", alignItems: "center" }, progressLine: { flex: 1, height: 3, backgroundColor: "#DCE5E4" }, progressLineActive: { backgroundColor: colors.brand }, progressLineHidden: { opacity: 0 }, progressDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E6ECEF", borderWidth: 2, borderColor: "#E6ECEF" }, progressDotActive: { backgroundColor: colors.brand, borderColor: colors.brand }, progressDotCurrent: { backgroundColor: colors.accent, borderColor: "#FFD9B4" }, progressNumber: { color: colors.muted, fontSize: 11, fontWeight: "900" }, progressNumberActive: { color: "#FFF" }, progressLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", textAlign: "center" }, progressLabelActive: { color: colors.ink, fontWeight: "900" }, progressLabelDone: { color: colors.brandDark }, content: { gap: 14, padding: 16, paddingBottom: 42 },
  tableInfo: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 14, backgroundColor: "#EDF6F7" }, infoCopy: { flex: 1 }, infoTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, infoText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  secondary: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.brand, backgroundColor: "#F2F8F8" }, secondaryText: { color: colors.brand, fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.46 },
  line: { gap: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FAFCFC", padding: 14 }, lineHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, lineCopy: { flex: 1 }, lineName: { color: colors.ink, fontSize: 14, fontWeight: "900" }, lineMeta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, lineTotal: { color: colors.brand, fontSize: 15, fontWeight: "900", textAlign: "right" },
  empty: { alignItems: "center", paddingVertical: 28 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 9 }, emptyText: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
  review: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EDF1F1" }, reviewLabel: { color: colors.muted, fontSize: 12 }, reviewValue: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "800", textAlign: "right" }, total: { borderRadius: 17, backgroundColor: colors.brand, padding: 17 }, totalLabel: { color: "#BFD2D1", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, totalValue: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 5 }, totalHint: { color: "#BFD2D1", fontSize: 9, lineHeight: 14, marginTop: 5 },
  actions: { gap: 10 }, primary: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, backgroundColor: colors.brand }, primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, previous: { height: 48, alignItems: "center", justifyContent: "center" }, previousText: { color: colors.brand, fontSize: 13, fontWeight: "800" },
});
