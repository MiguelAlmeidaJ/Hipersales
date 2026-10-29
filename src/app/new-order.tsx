import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
type Form = {
  companyId: string; customerId: string; tableId: string; orderType: "Venda" | "Bonificacao"; billingPercent: string;
  taxOperator: "Sim" | "Nao"; freight: "CIF" | "FOB"; deliveryFormat: "Imediata" | "Programada"; scheduledDate: string;
  purchaseOrder: string; paymentId: string; discountPercent: string; discountOn: "BoletoBancario" | "NotaFiscal" | "SemDescontos"; notes: string;
};
type Dialog = { title: string; message: string; tone: "error" | "success" | "info"; primaryLabel?: string; secondaryLabel?: string; onPrimary?: () => void; onSecondary?: () => void } | null;

const initial: Form = {
  companyId: "", customerId: "", tableId: "", orderType: "Venda", billingPercent: "100", taxOperator: "Sim", freight: "CIF",
  deliveryFormat: "Imediata", scheduledDate: "", purchaseOrder: "", paymentId: "", discountPercent: "0,00%", discountOn: "SemDescontos", notes: "",
};
const orderSteps = [
  { title: "Cabeçalho", short: "Cabeçalho" }, { title: "Condições", short: "Condições" }, { title: "Observações", short: "Observações" },
  { title: "Itens do pedido", short: "Itens" }, { title: "Revisão", short: "Revisão" },
];
const billingOptions: SelectOption[] = [
  { value: "100", label: "100% Nota" }, { value: "50", label: "50% Nota" }, { value: "30", label: "30% Nota" },
  { value: "20", label: "20% Nota" }, { value: "10", label: "10% Nota" }, { value: "0", label: "Sem Nota" },
];
const decimal = (value: string) => Number(value.replace(/%/g, "").replace(",", "."));
const readList = (data: unknown): any[] => Array.isArray(data) ? data : typeof data === "object" && data !== null ? ((data as any).itens || (data as any).tabelas || (data as any).tabelasPreco || (data as any).tabelasPrecos || (data as any).produtos || (data as any).dados || (data as any).resultado || []) : [];
const text = (...values: unknown[]) => String(values.find((value) => typeof value === "string" && value.trim()) || "");
const number = (...values: unknown[]) => Number(values.find((value) => value !== undefined && value !== null && value !== "") || 0);

function normalizeTables(data: unknown): PriceTable[] {
  return readList(data).map((row) => {
    const company = row.empresa || {}, terms = row.condicoesPagamento || row.prazos || row.condPagto || [];
    return {
      id: number(row.idTabela, row.id), description: text(row.descricao, row.nome, `Tabela ${row.idTabela || row.id}`),
      companyId: number(row.idEmpresa, company.id), companyName: text(row.empresaNome, company.nome, company.razaoSocial, `Empresa ${row.idEmpresa || company.id}`),
      freight: text(row.frete), leadTimeDays: number(row.prazoEntregaDias, row.leadTimeDias), minimum: number(row.pedidoMinimo, row.valorPedidoMinimo),
      defaultPaymentId: number(row.idCondPagto, row.condicaoPagamento?.id) || undefined, defaultPaymentName: text(row.condPagtoDescricao, row.condicaoPagamento?.descricao) || undefined,
      paymentTerms: Array.isArray(terms) ? terms.map((term: any) => ({ id: number(term.idCondPagto, term.id), name: text(term.descricao, term.nome) })).filter((term: PaymentTerm) => term.id) : [],
    };
  }).filter((table) => table.id && table.companyId);
}
function normalizeProducts(data: unknown): Product[] {
  return readList(data).map((row) => ({
    id: number(row.idProduto, row.id), name: text(row.descricao, row.nome, `Produto ${row.idProduto || row.id}`), code: text(row.codigo, row.referencia, row.idProduto),
    unit: text(row.unidade, row.unidadeVenda), price: row.precoUnitario !== undefined || row.preco !== undefined ? number(row.precoUnitario, row.preco) : undefined,
  })).filter((product) => product.id);
}
function validDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]), date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
function newIdempotencyKey() { return `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function maskPercent(value: string) { const cents = Number(value.replace(/\D/g, "").slice(0, 5) || 0); return `${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`; }
function dateFromText(value: string) { const [day, month, year] = value.split("/").map(Number); return validDate(value) ? new Date(year, month - 1, day, 12) : new Date(); }
function dateToText(value: Date) { return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function calendarDays(month: Date) {
  const year = month.getFullYear(), monthIndex = month.getMonth(), firstWeekday = new Date(year, monthIndex, 1).getDay(), lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => { const day = index - firstWeekday + 1; return day > 0 && day <= lastDay ? new Date(year, monthIndex, day, 12) : null; });
}

export default function NewOrderScreen() {
  const { status } = useSession();
  const [step, setStep] = useState(0), [form, setForm] = useState<Form>(initial), [customers, setCustomers] = useState<Customer[]>([]);
  const [tables, setTables] = useState<PriceTable[]>([]), [products, setProducts] = useState<Product[]>([]), [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState(""), [draftQuantity, setDraftQuantity] = useState("1");
  const [loading, setLoading] = useState(true), [productsLoading, setProductsLoading] = useState(false), [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    Promise.all([api<{ customers: Customer[] }>("/api/customers"), api<unknown>("/api/price-tables"), api<unknown>("/api/payment-terms")])
      .then(([customerData, tableData, termData]) => {
        if (!active) return;
        const globalTerms = readList(termData).map((row) => ({ id: number(row.idCondPagto, row.id), name: text(row.descricao, row.nome) })).filter((term) => term.id);
        setCustomers((customerData.customers || []).filter((customer) => customer.active));
        setTables(normalizeTables(tableData).map((table) => ({ ...table, paymentTerms: table.paymentTerms.length ? table.paymentTerms : globalTerms })));
      })
      .catch((cause) => { if (active) setDialog({ title: "Não foi possível preparar o pedido", message: cause instanceof Error ? cause.message : "Falha ao carregar clientes e tabelas de preço.", tone: "error" }); })
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
  const selectedTable = tables.find((table) => String(table.id) === form.tableId), selectedProduct = products.find((product) => String(product.id) === productId), selectedCustomer = customers.find((customer) => String(customer.id) === form.customerId);
  const companyOptions = useMemo<SelectOption[]>(() => companies.map((company) => ({ value: String(company.id), label: company.name })), [companies]);
  const tableOptions = useMemo<SelectOption[]>(() => tables.filter((table) => String(table.companyId) === form.companyId).map((table) => ({ value: String(table.id), label: table.description, detail: [table.freight, table.leadTimeDays ? `${table.leadTimeDays} dias` : "", table.minimum ? `Mínimo ${money(table.minimum)}` : ""].filter(Boolean).join(" · ") })), [form.companyId, tables]);
  const customerOptions = useMemo<SelectOption[]>(() => customers.map((customer) => ({ value: String(customer.id), label: customer.trade_name || customer.legal_name, detail: [customer.legal_name, customer.cnpj].filter(Boolean).join(" · ") })), [customers]);
  const productOptions = useMemo<SelectOption[]>(() => products.filter((product) => !lines.some((line) => line.productId === product.id)).map((product) => ({ value: String(product.id), label: product.name, detail: [product.code, product.unit, product.price !== undefined ? money(product.price) : "Preço definido pela tabela"].filter(Boolean).join(" · ") })), [lines, products]);
  const paymentOptions = useMemo<SelectOption[]>(() => (selectedTable?.paymentTerms || []).map((term) => ({ value: String(term.id), label: term.name })), [selectedTable]);
  const discount = decimal(form.discountPercent);
  const grossTotal = useMemo(() => lines.reduce((sum, line) => { const product = products.find((item) => item.id === line.productId); return sum + decimal(line.quantity || "0") * (product?.price || 0); }, 0), [lines, products]);
  const orderTotal = grossTotal * (1 - discount / 100);

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (status === "loading" || loading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Carregando dados comerciais…</Text></SafeAreaView>;

  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function fail(message: string) { setDialog({ title: "Revise o pedido", message, tone: "error" }); return false; }
  function changeCompany(value: string) { setForm((current) => ({ ...current, companyId: value, tableId: "", paymentId: "" })); setProducts([]); setLines([]); setProductId(""); }
  function changeTable(value: string) {
    const table = tables.find((item) => String(item.id) === value);
    setForm((current) => ({ ...current, tableId: value, paymentId: table?.defaultPaymentId ? String(table.defaultPaymentId) : "" }));
    setProducts([]); setLines([]); setProductId(""); setDraftQuantity("1"); setProductsLoading(Boolean(value));
  }
  function changeOrderType(value: Form["orderType"]) { setForm((current) => ({ ...current, orderType: value, paymentId: value === "Bonificacao" ? "" : (selectedTable?.defaultPaymentId ? String(selectedTable.defaultPaymentId) : current.paymentId) })); }
  function changeDelivery(value: Form["deliveryFormat"]) { setForm((current) => ({ ...current, deliveryFormat: value, scheduledDate: value === "Imediata" ? "" : current.scheduledDate })); }
  function changeDiscount(value: string) {
    const formatted = maskPercent(value);
    setForm((current) => ({ ...current, discountPercent: formatted, discountOn: decimal(formatted) > 0 ? (current.discountOn === "SemDescontos" ? "BoletoBancario" : current.discountOn) : "SemDescontos" }));
  }
  function validateStep() {
    if (step === 0 && (!form.companyId || !form.customerId || !form.tableId)) return fail("Selecione empresa, cliente e tabela de preço para avançar.");
    if (step === 1) {
      if (form.deliveryFormat === "Programada" && !validDate(form.scheduledDate)) return fail("Informe a data programada no formato DD/MM/AAAA.");
      if (form.orderType === "Venda" && !form.paymentId) return fail("Selecione a condição de pagamento.");
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) return fail("Informe um desconto entre 0,00% e 100,00%.");
      if (discount > 0 && form.discountOn === "SemDescontos") return fail("Selecione onde o desconto será aplicado.");
    }
    if (step === 3 && !lines.length) return fail("Adicione pelo menos um produto ao pedido.");
    if (step === 3 && lines.some((line) => !(decimal(line.quantity) > 0))) return fail("Todas as quantidades devem ser maiores que zero.");
    return true;
  }
  function validateOrder() {
    if (!form.companyId || !form.customerId || !form.tableId) { setStep(0); return fail("Selecione empresa, cliente e tabela de preço."); }
    if (form.deliveryFormat === "Programada" && !validDate(form.scheduledDate)) { setStep(1); return fail("Informe a data programada no formato DD/MM/AAAA."); }
    if (form.orderType === "Venda" && !form.paymentId) { setStep(1); return fail("Selecione a condição de pagamento."); }
    if (!lines.length || lines.some((line) => !(decimal(line.quantity) > 0))) { setStep(3); return fail("Inclua ao menos um item com quantidade válida."); }
    return true;
  }
  function advance() { setStep((current) => Math.min(orderSteps.length - 1, current + 1)); }
  function next() {
    if (!validateStep()) return;
    if (step === 1 && !form.purchaseOrder.trim()) {
      setDialog({ title: "Ordem de compra não informada", message: form.deliveryFormat === "Programada" ? "Sem o número da ordem de compra, o cliente pode não conseguir agendar a entrega. Deseja continuar mesmo assim?" : "Se o cliente tiver uma ordem de compra, informe o número para evitar problemas na entrega. Deseja continuar?", tone: "info", primaryLabel: "Continuar", secondaryLabel: "Voltar e preencher", onPrimary: advance }); return;
    }
    if (step === 2 && !form.notes.trim()) { setDialog({ title: "Pedido sem observações", message: "Nenhuma observação foi adicionada. Deseja avançar mesmo assim?", tone: "info", primaryLabel: "Continuar", secondaryLabel: "Adicionar observação", onPrimary: advance }); return; }
    advance();
  }
  function addProduct() {
    if (!selectedProduct) return;
    if (!(decimal(draftQuantity) > 0)) { fail("Digite uma quantidade maior que zero para incluir o item."); return; }
    setLines((current) => [...current, { productId: selectedProduct.id, quantity: draftQuantity }]); setProductId(""); setDraftQuantity("1");
  }
  function updateQuantity(id: number, quantity: string) { setLines((current) => current.map((line) => line.productId === id ? { ...line, quantity } : line)); }
  function requestSubmit() { if (validateOrder()) setDialog({ title: "Confirmar transmissão", message: "Confirma a transmissão deste pedido?", tone: "info", primaryLabel: "Sim, transmitir", secondaryLabel: "Não", onPrimary: () => { void transmit(); } }); }
  async function transmit() {
    setBusy(true);
    try {
      const payload = {
        idEmpresa: Number(form.companyId), idCliente: Number(form.customerId), idTabela: Number(form.tableId),
        ...(form.orderType === "Venda" && form.paymentId ? { idCondPagto: Number(form.paymentId) } : {}),
        itens: lines.map((line) => ({ idProduto: line.productId, quantidade: decimal(line.quantity) })), tipoPedido: form.orderType,
        faturamentoPercentual: Number(form.billingPercent), operadorFiscal: form.taxOperator === "Sim", frete: form.freight, formatoEntrega: form.deliveryFormat,
        ...(form.deliveryFormat === "Programada" ? { dataProgramada: form.scheduledDate } : {}), ...(form.purchaseOrder.trim() ? { numeroPedidoCliente: form.purchaseOrder.trim() } : {}),
        descontoPercentual: discount, descontoEm: discount > 0 ? form.discountOn : "SemDescontos", ...(form.notes.trim() ? { observacoes: form.notes.trim() } : {}),
      };
      const response = await api<{ mensagem?: string; repetido?: boolean; pedido?: { idPedido: number; status: string; valorLiquido?: number } }>("/api/orders", { method: "POST", headers: { "Idempotency-Key": idempotencyKey.current }, body: JSON.stringify(payload), timeoutMs: 30_000 });
      const order = response.pedido;
      setDialog({ title: response.repetido ? "Pedido já transmitido" : "Pedido transmitido", message: `${response.mensagem || "Pedido registrado com sucesso."}${order ? `\n\nPedido #${order.idPedido} · ${order.status}${order.valorLiquido !== undefined ? ` · ${money(order.valorLiquido)}` : ""}` : ""}`, tone: "success", primaryLabel: "Ver meus pedidos", onPrimary: () => router.replace("/(app)/orders") });
      idempotencyKey.current = newIdempotencyKey();
    } catch (cause) { setDialog({ title: "Não foi possível transmitir", message: cause instanceof Error ? cause.message : "Revise os dados e tente novamente.", tone: "error" }); }
    finally { setBusy(false); }
  }
  function handlePrimary() { const action = dialog?.onPrimary; setDialog(null); action?.(); }
  function handleSecondary() { const action = dialog?.onSecondary; setDialog(null); action?.(); }

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Voltar" onPress={() => step ? setStep(step - 1) : router.back()} style={styles.back}><AppIcon name="arrow-back" color={colors.ink} size={22} /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>NOVO PEDIDO · ETAPA {step + 1}/{orderSteps.length}</Text><Text style={styles.title}>{orderSteps[step].title}</Text></View></View>
    <View style={styles.progress}>{orderSteps.map((item, index) => <Pressable key={item.short} accessibilityRole="button" accessibilityLabel={`Etapa ${index + 1}: ${item.title}${index < step ? ", concluída" : index === step ? ", atual" : ""}`} accessibilityState={{ selected: index === step, disabled: index >= step }} disabled={index >= step} onPress={() => setStep(index)} style={styles.progressItem}><View style={styles.progressRail}><View style={[styles.progressLine, index === 0 && styles.progressLineHidden, index <= step && index > 0 && styles.progressLineActive]} /><View style={[styles.progressDot, index <= step && styles.progressDotActive, index === step && styles.progressDotCurrent]}>{index < step ? <AppIcon name="checkmark" color="#FFF" size={13} /> : <Text style={[styles.progressNumber, index <= step && styles.progressNumberActive]}>{index + 1}</Text>}</View><View style={[styles.progressLine, index === orderSteps.length - 1 && styles.progressLineHidden, index < step && styles.progressLineActive]} /></View><Text numberOfLines={1} style={[styles.progressLabel, index === step && styles.progressLabelActive, index < step && styles.progressLabelDone]}>{item.short}</Text></Pressable>)}</View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step === 0 ? <HeaderStep form={form} selectedTable={selectedTable} companyOptions={companyOptions} customerOptions={customerOptions} tableOptions={tableOptions} changeCompany={changeCompany} changeTable={changeTable} updateCustomer={(value) => update("customerId", value)} /> : null}
      {step === 1 ? <ConditionsStep form={form} discount={discount} paymentOptions={paymentOptions} update={update} changeOrderType={changeOrderType} changeDelivery={changeDelivery} changeDiscount={changeDiscount} /> : null}
      {step === 2 ? <FormSection title="Observações do pedido" subtitle="Inclua instruções de entrega, separação ou faturamento, se necessário."><Field label="Observações" value={form.notes} onChangeText={(value) => update("notes", value)} multiline maxLength={1500} placeholder="Digite aqui as informações importantes para este pedido…" /><Text style={styles.counter}>{form.notes.length}/1500</Text></FormSection> : null}
      {step === 3 ? <ItemsStep productsLoading={productsLoading} productId={productId} productOptions={productOptions} selectedProduct={selectedProduct} draftQuantity={draftQuantity} lines={lines} products={products} setProductId={setProductId} setDraftQuantity={setDraftQuantity} addProduct={addProduct} updateQuantity={updateQuantity} removeProduct={(id) => setLines((current) => current.filter((item) => item.productId !== id))} /> : null}
      {step === 4 ? <ReviewStep form={form} companyName={companies.find((item) => String(item.id) === form.companyId)?.name} customerName={selectedCustomer?.trade_name || selectedCustomer?.legal_name} tableName={selectedTable?.description} paymentName={paymentOptions.find((item) => item.value === form.paymentId)?.label} discount={discount} lines={lines} products={products} grossTotal={grossTotal} orderTotal={orderTotal} /> : null}
      <View style={styles.actions}>{step < 4 ? <Pressable onPress={next} style={styles.primary}><Text style={styles.primaryText}>Avançar</Text><AppIcon name="arrow-forward" color="#FFFFFF" size={19} /></Pressable> : <Pressable disabled={busy} onPress={requestSubmit} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.primaryText}>TRANSMITIR PEDIDO</Text><AppIcon name="paper-plane-outline" color="#FFFFFF" size={19} /></>}</Pressable>}{step > 0 ? <Pressable disabled={busy} onPress={() => setStep((current) => current - 1)} style={styles.previous}><Text style={styles.previousText}>Voltar</Text></Pressable> : null}</View>
    </ScrollView></KeyboardAvoidingView>
    <FeedbackDialog visible={Boolean(dialog)} title={dialog?.title || "Aviso"} message={dialog?.message || ""} tone={dialog?.tone} buttonLabel={dialog?.primaryLabel || "OK"} secondaryButtonLabel={dialog?.secondaryLabel} onClose={handlePrimary} onSecondary={handleSecondary} />
  </SafeAreaView>;
}

function HeaderStep({ form, selectedTable, companyOptions, customerOptions, tableOptions, changeCompany, changeTable, updateCustomer }: { form: Form; selectedTable?: PriceTable; companyOptions: SelectOption[]; customerOptions: SelectOption[]; tableOptions: SelectOption[]; changeCompany: (value: string) => void; changeTable: (value: string) => void; updateCustomer: (value: string) => void }) {
  return <FormSection title="Dados principais" subtitle="As opções disponíveis são vinculadas ao seu cadastro na retaguarda."><SelectField searchable label="Empresa *" value={form.companyId} options={companyOptions} onChange={changeCompany} placeholder={companyOptions.length ? "Selecione a empresa" : "Nenhuma empresa vinculada"} /><SelectField searchable label="Cliente *" value={form.customerId} options={customerOptions} onChange={updateCustomer} /><SelectField searchable disabled={!form.companyId} label="Tabela de preço *" value={form.tableId} options={tableOptions} onChange={changeTable} placeholder={form.companyId ? (tableOptions.length ? "Selecione a tabela" : "Nenhuma tabela vinculada") : "Selecione primeiro a empresa"} />{selectedTable ? <View style={styles.tableInfo}><AppIcon name="pricetag-outline" color={colors.brand} size={20} /><View style={styles.infoCopy}><Text style={styles.infoTitle}>{selectedTable.description}</Text><Text style={styles.infoText}>{[selectedTable.freight && `Frete sugerido ${selectedTable.freight}`, selectedTable.leadTimeDays && `Prazo ${selectedTable.leadTimeDays} dias`, selectedTable.minimum && `Pedido mínimo ${money(selectedTable.minimum)}`].filter(Boolean).join(" · ")}</Text></View></View> : null}</FormSection>;
}

function ConditionsStep({ form, discount, paymentOptions, update, changeOrderType, changeDelivery, changeDiscount }: { form: Form; discount: number; paymentOptions: SelectOption[]; update: <K extends keyof Form>(key: K, value: Form[K]) => void; changeOrderType: (value: Form["orderType"]) => void; changeDelivery: (value: Form["deliveryFormat"]) => void; changeDiscount: (value: string) => void }) {
  return <FormSection title="Condições comerciais" subtitle="Confira as sugestões antes de avançar."><SelectField label="Tipo de pedido *" value={form.orderType} options={[{ value: "Venda", label: "Pedido de Venda" }, { value: "Bonificacao", label: "Pedido de Bonificação" }]} onChange={(value) => changeOrderType(value as Form["orderType"])} /><SelectField label="Faturamento *" value={form.billingPercent} options={billingOptions} onChange={(value) => update("billingPercent", value)} /><SelectField label="Operador fiscal *" value={form.taxOperator} options={[{ value: "Sim", label: "Sim, NF via Operador Fiscal" }, { value: "Nao", label: "Não, Venda Direta" }]} onChange={(value) => update("taxOperator", value as Form["taxOperator"])} /><SelectField label="Frete *" value={form.freight} options={[{ value: "CIF", label: "CIF" }, { value: "FOB", label: "FOB" }]} onChange={(value) => update("freight", value as Form["freight"])} /><SelectField label="Formato de entrega *" value={form.deliveryFormat} options={[{ value: "Imediata", label: "Entrega Imediata" }, { value: "Programada", label: "Entrega Programada" }]} onChange={(value) => changeDelivery(value as Form["deliveryFormat"])} /><CalendarField disabled={form.deliveryFormat === "Imediata"} value={form.scheduledDate} onChange={(value) => update("scheduledDate", value)} /><Field label="Nº Ordem de Compras do Cliente" value={form.purchaseOrder} onChangeText={(value) => update("purchaseOrder", value)} placeholder="Opcional" hint="Importante para o agendamento de entregas." maxLength={80} /><SelectField label="Condição de pagamento *" value={form.paymentId} options={paymentOptions} onChange={(value) => update("paymentId", value)} disabled={form.orderType === "Bonificacao"} placeholder={form.orderType === "Bonificacao" ? "Bonificações não possuem pagamento" : "Selecione a condição"} /><Field label="% Desconto *" value={form.discountPercent} onChangeText={changeDiscount} keyboardType="number-pad" maxLength={7} selectTextOnFocus /><SelectField label="Desconto em *" value={form.discountOn} options={discount > 0 ? [{ value: "BoletoBancario", label: "BOLETO BANCÁRIO" }, { value: "NotaFiscal", label: "NOTA FISCAL" }] : [{ value: "SemDescontos", label: "Sem descontos" }]} onChange={(value) => update("discountOn", value as Form["discountOn"])} disabled={discount === 0} /></FormSection>;
}

function CalendarField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedDate = dateFromText(value);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12));
  const days = calendarDays(visibleMonth);
  function showCalendar() { const current = dateFromText(value); setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1, 12)); setOpen(true); }
  function changeMonth(offset: number) { setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12)); }
  function selectDate(date: Date) { onChange(dateToText(date)); setOpen(false); }
  return <View style={styles.calendarWrap}>
    <Text style={styles.calendarLabel}>Data programada da entrega</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir calendário da data programada da entrega" accessibilityState={{ disabled }} disabled={disabled} onPress={showCalendar} style={[styles.calendarField, disabled && styles.frozenInput]}>
      <Text style={[styles.calendarValue, !value && styles.calendarPlaceholder]}>{value || (disabled ? "Disponível para entrega programada" : "DD/MM/AAAA")}</Text>
      <AppIcon name="calendar-outline" color={disabled ? "#91A0AF" : colors.brand} size={21} />
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.calendarBackdrop}>
        <Pressable accessibilityLabel="Fechar calendário" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.calendarModal}>
          <View style={styles.calendarHeader}><View><Text style={styles.calendarEyebrow}>DATA DE ENTREGA</Text><Text style={styles.calendarTitle}>{visibleMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text></View><Pressable accessibilityLabel="Fechar calendário" onPress={() => setOpen(false)} style={styles.calendarClose}><AppIcon name="close" color={colors.ink} size={22} /></Pressable></View>
          <View style={styles.calendarNavigation}><Pressable accessibilityLabel="Mês anterior" onPress={() => changeMonth(-1)} style={styles.calendarArrow}><AppIcon name="chevron-back" color={colors.brand} size={22} /></Pressable><Pressable accessibilityLabel="Próximo mês" onPress={() => changeMonth(1)} style={styles.calendarArrow}><AppIcon name="chevron-forward" color={colors.brand} size={22} /></Pressable></View>
          <View style={styles.weekRow}>{["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => <Text key={`${label}-${index}`} style={styles.weekDay}>{label}</Text>)}</View>
          <View style={styles.daysGrid}>{days.map((date, index) => {
            const selected = Boolean(date && value && dateToText(date) === value), today = Boolean(date && dateToText(date) === dateToText(new Date()));
            return <View key={index} style={styles.daySlot}>{date ? <Pressable accessibilityRole="button" accessibilityLabel={date.toLocaleDateString("pt-BR", { dateStyle: "long" })} accessibilityState={{ selected }} onPress={() => selectDate(date)} style={[styles.dayButton, today && styles.todayButton, selected && styles.selectedDayButton]}><Text style={[styles.dayText, today && styles.todayText, selected && styles.selectedDayText]}>{date.getDate()}</Text></Pressable> : null}</View>;
          })}</View>
          <Pressable onPress={() => selectDate(new Date())} style={styles.todayAction}><Text style={styles.todayActionText}>Selecionar hoje</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

function ItemsStep({ productsLoading, productId, productOptions, selectedProduct, draftQuantity, lines, products, setProductId, setDraftQuantity, addProduct, updateQuantity, removeProduct }: { productsLoading: boolean; productId: string; productOptions: SelectOption[]; selectedProduct?: Product; draftQuantity: string; lines: Line[]; products: Product[]; setProductId: (value: string) => void; setDraftQuantity: (value: string) => void; addProduct: () => void; updateQuantity: (id: number, value: string) => void; removeProduct: (id: number) => void }) {
  return <><FormSection title="Adicionar produto" subtitle="Busque por código, descrição ou parte do texto."><SelectField searchable label="Selecionar produto *" value={productId} options={productOptions} onChange={setProductId} disabled={productsLoading} placeholder={productsLoading ? "Carregando produtos…" : "Busque um produto"} />{selectedProduct ? <View style={styles.productPreview}><View style={styles.previewTop}><View style={styles.previewCopy}><Text style={styles.previewName}>{selectedProduct.name}</Text><Text style={styles.previewMeta}>{selectedProduct.code} · {selectedProduct.unit}</Text></View><Text style={styles.previewPrice}>{selectedProduct.price !== undefined ? money(selectedProduct.price) : "Preço da tabela"}</Text></View><Field label="Digite a quantidade *" value={draftQuantity} onChangeText={setDraftQuantity} keyboardType="decimal-pad" /><View style={styles.previewTotal}><Text style={styles.previewTotalLabel}>Prévia do item</Text><Text style={styles.previewTotalValue}>{selectedProduct.price !== undefined ? money(selectedProduct.price * decimal(draftQuantity || "0")) : "Calculada na transmissão"}</Text></View><Pressable onPress={addProduct} style={styles.secondary}><AppIcon name="add-circle-outline" color={colors.brand} size={20} /><Text style={styles.secondaryText}>Incluir item ao pedido</Text></Pressable></View> : null}</FormSection><FormSection title={`Itens do pedido (${lines.length})`}>{lines.length ? lines.map((line, index) => { const product = products.find((item) => item.id === line.productId); return <View key={line.productId} style={styles.line}><View style={styles.lineHeader}><View style={styles.itemIndex}><Text style={styles.itemIndexText}>{index + 1}</Text></View><View style={styles.lineCopy}><Text style={styles.lineName}>{product?.name}</Text><Text style={styles.lineMeta}>{[product?.code, product?.unit, product?.price !== undefined ? money(product.price) : "Preço calculado pela API"].filter(Boolean).join(" · ")}</Text></View><Pressable accessibilityLabel={`Remover ${product?.name}`} onPress={() => removeProduct(line.productId)}><AppIcon name="trash-outline" color={colors.danger} size={20} /></Pressable></View><Field label="Quantidade" value={line.quantity} onChangeText={(value) => updateQuantity(line.productId, value)} keyboardType="decimal-pad" />{product?.price !== undefined ? <Text style={styles.lineTotal}>{money(product.price * decimal(line.quantity || "0"))}</Text> : null}</View>; }) : <View style={styles.empty}><AppIcon name="cart-outline" color={colors.muted} size={30} /><Text style={styles.emptyTitle}>Nenhum produto adicionado</Text><Text style={styles.emptyText}>Selecione um produto, informe a quantidade e inclua o item.</Text></View>}</FormSection></>;
}

function ReviewStep({ form, companyName, customerName, tableName, paymentName, discount, lines, products, grossTotal, orderTotal }: { form: Form; companyName?: string; customerName?: string; tableName?: string; paymentName?: string; discount: number; lines: Line[]; products: Product[]; grossTotal: number; orderTotal: number }) {
  return <><FormSection title="Cabeçalho"><Review label="Empresa" value={companyName} /><Review label="Cliente" value={customerName} /><Review label="Tabela de preço" value={tableName} /></FormSection><FormSection title="Condições"><Review label="Tipo de pedido" value={form.orderType === "Bonificacao" ? "Pedido de Bonificação" : "Pedido de Venda"} /><Review label="Faturamento" value={billingOptions.find((item) => item.value === form.billingPercent)?.label} /><Review label="Operador fiscal" value={form.taxOperator === "Sim" ? "Sim, NF via Operador Fiscal" : "Não, Venda Direta"} /><Review label="Frete" value={form.freight} /><Review label="Formato entrega" value={`${form.deliveryFormat === "Imediata" ? "Entrega Imediata" : "Entrega Programada"}${form.deliveryFormat === "Programada" ? ` · ${form.scheduledDate}` : ""}`} /><Review label="Nº Ordem Compras" value={form.purchaseOrder || "Não informado"} /><Review label="Cond. pagamento" value={form.orderType === "Bonificacao" ? "Não se aplica" : paymentName} /><Review label="% Desconto" value={form.discountPercent} /><Review label="Desconto em" value={discount === 0 ? "Sem descontos" : form.discountOn === "BoletoBancario" ? "BOLETO BANCÁRIO" : "NOTA FISCAL"} /></FormSection><FormSection title="Observações"><Text style={styles.notesReview}>{form.notes.trim() || "Nenhuma observação informada."}</Text></FormSection><FormSection title="Itens do pedido">{lines.map((line) => { const product = products.find((item) => item.id === line.productId); return <View key={line.productId} style={styles.reviewItem}><View style={styles.reviewItemCopy}><Text style={styles.reviewItemName}>{product?.code} · {product?.name}</Text><Text style={styles.reviewItemMeta}>{product?.unit} · Qtd. {line.quantity} × {product?.price !== undefined ? money(product.price) : "Preço da tabela"}</Text></View><Text style={styles.reviewItemTotal}>{product?.price !== undefined ? money(product.price * decimal(line.quantity)) : "—"}</Text></View>; })}<View style={styles.total}><Text style={styles.totalLabel}>Total do pedido</Text>{discount > 0 ? <Text style={styles.totalDiscount}>Subtotal {money(grossTotal)} · Desconto {form.discountPercent}</Text> : null}<Text style={styles.totalValue}>{money(orderTotal)}</Text><Text style={styles.totalHint}>O valor definitivo será validado pela retaguarda.</Text></View></FormSection></>;
}
function Review({ label, value }: { label: string; value?: string }) { return <View style={styles.review}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value || "—"}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas }, loadingText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: colors.surface }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#EDF3F7" }, headerCopy: { flex: 1 }, eyebrow: { color: colors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 2 },
  progress: { flexDirection: "row", paddingHorizontal: 4, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#F2F4F4", borderBottomWidth: 1, borderBottomColor: colors.border }, progressItem: { flex: 1, alignItems: "center", gap: 6 }, progressRail: { width: "100%", flexDirection: "row", alignItems: "center" }, progressLine: { flex: 1, height: 3, backgroundColor: "#DCE5E4" }, progressLineActive: { backgroundColor: colors.brand }, progressLineHidden: { opacity: 0 }, progressDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#E6ECEF", borderWidth: 2, borderColor: "#E6ECEF" }, progressDotActive: { backgroundColor: colors.brand, borderColor: colors.brand }, progressDotCurrent: { backgroundColor: colors.accent, borderColor: "#FFD9B4" }, progressNumber: { color: colors.muted, fontSize: 10, fontWeight: "900" }, progressNumberActive: { color: "#FFF" }, progressLabel: { color: colors.muted, fontSize: 8, fontWeight: "700", textAlign: "center" }, progressLabelActive: { color: colors.ink, fontWeight: "900" }, progressLabelDone: { color: colors.brandDark }, content: { gap: 14, padding: 16, paddingBottom: 42 },
  tableInfo: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 14, backgroundColor: "#EDF6F7" }, infoCopy: { flex: 1 }, infoTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, infoText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, frozenInput: { backgroundColor: "#EDF1F1", opacity: 0.65 }, counter: { color: colors.muted, fontSize: 10, textAlign: "right", marginTop: -8 },
  calendarWrap: { gap: 7 }, calendarLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" }, calendarField: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 13, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: colors.surface, paddingHorizontal: 14 }, calendarValue: { color: colors.ink, fontSize: 15 }, calendarPlaceholder: { color: "#91A0AF" }, calendarBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(0,25,28,0.68)" }, calendarModal: { width: "100%", maxWidth: 390, borderRadius: 24, backgroundColor: colors.surface, padding: 18 }, calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, calendarEyebrow: { color: colors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, calendarTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", textTransform: "capitalize", marginTop: 2 }, calendarClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EDF3F7" }, calendarNavigation: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, marginBottom: 8 }, calendarArrow: { width: 44, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EFF5F7" }, weekRow: { flexDirection: "row", marginBottom: 4 }, weekDay: { width: "14.285%", color: colors.muted, fontSize: 10, fontWeight: "900", textAlign: "center" }, daysGrid: { flexDirection: "row", flexWrap: "wrap" }, daySlot: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }, dayButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 }, todayButton: { borderWidth: 1, borderColor: colors.brand }, selectedDayButton: { borderColor: colors.accent, backgroundColor: colors.accent }, dayText: { color: colors.ink, fontSize: 13, fontWeight: "700" }, todayText: { color: colors.brand, fontWeight: "900" }, selectedDayText: { color: "#FFFFFF", fontWeight: "900" }, todayAction: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brand, marginTop: 12 }, todayActionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  productPreview: { gap: 13, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: "#BFD4D3", backgroundColor: "#F4F9F8" }, previewTop: { flexDirection: "row", gap: 12 }, previewCopy: { flex: 1 }, previewName: { color: colors.ink, fontSize: 14, fontWeight: "900" }, previewMeta: { color: colors.muted, fontSize: 10, marginTop: 4 }, previewPrice: { color: colors.brand, fontSize: 14, fontWeight: "900" }, previewTotal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, previewTotalLabel: { color: colors.muted, fontSize: 11 }, previewTotalValue: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  secondary: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.brand, backgroundColor: "#FFFFFF" }, secondaryText: { color: colors.brand, fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.46 },
  line: { gap: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FAFCFC", padding: 14 }, lineHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, itemIndex: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.brand }, itemIndexText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" }, lineCopy: { flex: 1 }, lineName: { color: colors.ink, fontSize: 14, fontWeight: "900" }, lineMeta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, lineTotal: { color: colors.brand, fontSize: 15, fontWeight: "900", textAlign: "right" },
  empty: { alignItems: "center", paddingVertical: 28 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 9 }, emptyText: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
  review: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EDF1F1" }, reviewLabel: { color: colors.muted, fontSize: 12 }, reviewValue: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "800", textAlign: "right" }, notesReview: { color: colors.ink, fontSize: 13, lineHeight: 20 }, reviewItem: { flexDirection: "row", gap: 12, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: "#EDF1F1" }, reviewItemCopy: { flex: 1 }, reviewItemName: { color: colors.ink, fontSize: 12, fontWeight: "900" }, reviewItemMeta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, reviewItemTotal: { color: colors.brand, fontSize: 12, fontWeight: "900" },
  total: { borderRadius: 17, backgroundColor: colors.brand, padding: 17 }, totalLabel: { color: "#BFD2D1", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, totalDiscount: { color: "#D7E7E5", fontSize: 10, marginTop: 5 }, totalValue: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 5 }, totalHint: { color: "#BFD2D1", fontSize: 9, lineHeight: 14, marginTop: 5 },
  actions: { gap: 10 }, primary: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, backgroundColor: colors.brand, paddingHorizontal: 16 }, primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, previous: { height: 48, alignItems: "center", justifyContent: "center" }, previousText: { color: colors.brand, fontSize: 13, fontWeight: "800" },
});
