import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Field, FormSection, SelectField, type SelectOption } from "@/components/form-controls";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Customer } from "@/types/commercial";

type Company = { id: number; name: string; active?: boolean | number };
type Product = { id: number; company_id: number; name: string; code: string; price: number; unit: string; active?: boolean | number };
type Seller = { id: number; name: string; role: string; active?: boolean | number };
type Line = { productId: number; quantity: string; price: string };
type Form = {
  sellerId: string; companyId: string; customerId: string; orderType: string; freightType: string;
  deliveryType: string; scheduledDate: string; purchaseOrder: string; paymentTerms: string;
  discountPercent: string; discountOn: string; commissionPercent: string; invoiceType: string;
  taxOperatorInvoice: boolean; notes: string;
};

const initial: Form = {
  sellerId: "", companyId: "", customerId: "", orderType: "Venda de Mercadoria",
  freightType: "CIF - Pago pela Industria", deliveryType: "Entrega Imediata", scheduledDate: "",
  purchaseOrder: "", paymentTerms: "Pagamento Antecipado", discountPercent: "0",
  discountOn: "Sem descontos", commissionPercent: "0", invoiceType: "Com nota cheia",
  taxOperatorInvoice: false, notes: "",
};
const decimal = (value: string) => Number(value.replace(",", "."));
const active = (value: boolean | number | undefined) => value === true || value === 1;
const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export default function NewOrderScreen() {
  const { status, user } = useSession();
  const isAdmin = user?.role === "admin" || user?.role === "dev";
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    if (status !== "authenticated") return () => { current = false; };
    async function load() {
      try {
        const [companiesResponse, customersResponse] = await Promise.all([
          api<{ companies: Company[] }>(isAdmin ? "/api/admin/companies" : "/api/companies"),
          api<{ customers: Customer[] }>(isAdmin ? "/api/admin/customers" : "/api/customers"),
        ]);
        if (!current) return;
        setCompanies((companiesResponse.companies ?? []).filter((item) => active(item.active)));
        setCustomers((customersResponse.customers ?? []).filter((item) => active(item.active)));
        if (isAdmin) {
          const sellersResponse = await api<{ users: Seller[] }>("/api/admin/users");
          if (current) setSellers((sellersResponse.users ?? []).filter((item) => item.role === "seller" && active(item.active)));
        }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : "Falha ao carregar dados comerciais.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => { current = false; };
  }, [isAdmin, status]);

  useEffect(() => {
    let current = true;
    if (status !== "authenticated" || !form.companyId) return () => { current = false; };
    const path = isAdmin ? `/api/admin/products?company_id=${form.companyId}` : `/api/products?company_id=${form.companyId}`;
    api<{ products: Product[] }>(path as `/api/${string}`)
      .then((response) => { if (current) setProducts((response.products ?? []).filter((item) => active(item.active))); })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Falha ao carregar produtos."); })
      .finally(() => { if (current) setProductsLoading(false); });
    return () => { current = false; };
  }, [form.companyId, isAdmin, status]);

  const bonus = /bonific/i.test(form.orderType);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + decimal(line.quantity || "0") * decimal(line.price || "0"), 0), [lines]);
  const discount = bonus || form.discountOn === "Sem descontos" ? 0 : subtotal * Math.max(0, decimal(form.discountPercent || "0")) / 100;
  const total = Math.max(0, subtotal - discount);
  const companyOptions = useMemo<SelectOption[]>(() => companies.map((item) => ({ value: String(item.id), label: item.name })), [companies]);
  const customerOptions = useMemo<SelectOption[]>(() => customers.map((item) => ({ value: String(item.id), label: item.trade_name || item.legal_name, detail: item.trade_name ? item.legal_name : item.cnpj })), [customers]);
  const sellerOptions = useMemo<SelectOption[]>(() => sellers.map((item) => ({ value: String(item.id), label: item.name })), [sellers]);
  const productOptions = useMemo<SelectOption[]>(() => products.filter((item) => !lines.some((line) => line.productId === item.id)).map((item) => ({ value: String(item.id), label: item.name, detail: `${item.code} · ${money(Number(item.price))}/${item.unit}` })), [products, lines]);

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;

  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeCompany(value: string) {
    update("companyId", value);
    setProducts([]);
    setLines([]);
    setProductId("");
    setProductsLoading(Boolean(value));
  }
  function validateStep() {
    setError("");
    if (step === 0 && (!form.companyId || !form.customerId || (isAdmin && !form.sellerId))) {
      setError(isAdmin ? "Selecione representante, empresa e cliente." : "Selecione empresa e cliente."); return false;
    }
    if (step === 1 && (!lines.length || lines.some((line) => !(decimal(line.quantity) > 0) || decimal(line.price) < 0 || !Number.isFinite(decimal(line.price))))) {
      setError("Inclua ao menos um produto e confira quantidades e preços."); return false;
    }
    return true;
  }
  function next() { if (validateStep()) setStep((current) => Math.min(2, current + 1)); }
  function addProduct() {
    const product = products.find((item) => String(item.id) === productId);
    if (!product) return;
    setLines((current) => [...current, { productId: product.id, quantity: "1", price: String(product.price) }]);
    setProductId("");
  }
  function updateLine(product: number, field: "quantity" | "price", value: string) {
    setLines((current) => current.map((line) => line.productId === product ? { ...line, [field]: value } : line));
  }
  async function submit() {
    if (!validateStep()) return;
    if (!bonus && !form.paymentTerms.trim()) return setError("Informe a condição de pagamento.");
    if (form.deliveryType === "Entrega Programada" && !validIsoDate(form.scheduledDate)) return setError("Informe uma data programada válida no formato AAAA-MM-DD.");
    const discountPercent = bonus || form.discountOn === "Sem descontos" ? 0 : decimal(form.discountPercent);
    const commissionPercent = bonus ? 0 : decimal(form.commissionPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return setError("Informe um desconto entre 0 e 100%.");
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) return setError("Informe uma comissão entre 0 e 100%.");
    setBusy(true); setError("");
    try {
      const payload = {
        company_id: Number(form.companyId), customer_id: Number(form.customerId), ...(isAdmin ? { seller_id: Number(form.sellerId) } : {}),
        order_type: form.orderType, freight_type: form.freightType, delivery_type: form.deliveryType,
        scheduled_delivery_date: form.scheduledDate, purchase_order: form.purchaseOrder.trim(),
        payment_terms: bonus ? "" : form.paymentTerms.trim(), discount_percent: discountPercent,
        discount_on: bonus ? "Sem descontos" : form.discountOn, commission_percent: commissionPercent,
        invoice_type: form.invoiceType.trim(), tax_operator_invoice: form.taxOperatorInvoice, notes: form.notes.trim(),
        items: lines.map((line) => ({ product_id: line.productId, quantity: decimal(line.quantity), negotiated_price: decimal(line.price) })),
      };
      const result = await api<{ id: number; order_number?: number; message?: string }>("/api/proposals", { method: "POST", body: JSON.stringify(payload), timeoutMs: 30_000 });
      Alert.alert("Proposta enviada", `${result.message || "Pedido criado."}\nNúmero: ${result.order_number || result.id}/${bonus ? "B" : "V"}`, [{ text: "Ver pedidos", onPress: () => router.replace("/(app)/orders") }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a proposta.");
    } finally { setBusy(false); }
  }

  if (status === "loading" || loading) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Carregando formulário…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}><Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={() => step ? setStep(step - 1) : router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>NOVA PROPOSTA · ETAPA {step + 1}/3</Text><Text style={styles.title}>{["Cliente e empresa", "Produtos", "Condições"][step]}</Text></View></View>
      <View style={styles.progress}><View style={[styles.progressValue, { width: `${((step + 1) / 3) * 100}%` }]} /></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {step === 0 ? <FormSection title="Responsáveis pelo pedido" subtitle="As opções respeitam as permissões e associações da sua conta.">
            {isAdmin ? <SelectField label="Representante *" value={form.sellerId} options={sellerOptions} onChange={(value) => update("sellerId", value)} searchable /> : null}
            <SelectField label="Empresa *" value={form.companyId} options={companyOptions} onChange={changeCompany} searchable />
            <SelectField label="Cliente *" value={form.customerId} options={customerOptions} onChange={(value) => update("customerId", value)} searchable />
            <SelectField label="Tipo de pedido" value={form.orderType} options={[{ value: "Venda de Mercadoria", label: "Venda de Mercadoria" }, { value: "Bonificação", label: "Bonificação" }]} onChange={(value) => update("orderType", value)} />
          </FormSection> : null}

          {step === 1 ? <>
            <FormSection title="Adicionar produtos" subtitle={form.companyId ? `${products.length} produtos disponíveis para a empresa.` : "Selecione uma empresa na etapa anterior."}>
              <SelectField label="Produto" value={productId} options={productOptions} onChange={setProductId} searchable disabled={productsLoading || !form.companyId} placeholder={productsLoading ? "Carregando produtos…" : "Selecione um produto"} />
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !productId }} disabled={!productId} onPress={addProduct} style={[styles.secondaryButton, !productId && styles.disabled]}><Text style={styles.secondaryButtonText}>Adicionar produto</Text></Pressable>
            </FormSection>
            <FormSection title={`Itens da proposta (${lines.length})`}>
              {lines.length ? lines.map((line) => {
                const product = products.find((item) => item.id === line.productId);
                return <View key={line.productId} style={styles.line}><View style={styles.lineHeader}><View style={styles.lineCopy}><Text style={styles.lineName}>{product?.name || line.productId}</Text><Text style={styles.lineCode}>{product?.code} · {product?.unit}</Text></View><Pressable accessibilityLabel={`Remover ${product?.name || "produto"}`} accessibilityRole="button" onPress={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}><Text style={styles.remove}>Remover</Text></Pressable></View><View style={styles.lineFields}><View style={styles.lineField}><Field label="Quantidade" value={line.quantity} onChangeText={(value) => updateLine(line.productId, "quantity", value)} keyboardType="decimal-pad" /></View><View style={styles.lineField}><Field label="Preço unitário" value={line.price} onChangeText={(value) => updateLine(line.productId, "price", value)} keyboardType="decimal-pad" /></View></View><Text style={styles.lineTotal}>{money(decimal(line.quantity || "0") * decimal(line.price || "0"))}</Text></View>;
              }) : <Text style={styles.empty}>Adicione pelo menos um produto à proposta.</Text>}
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{money(subtotal)}</Text></View>
            </FormSection>
          </> : null}

          {step === 2 ? <>
            <FormSection title="Entrega e faturamento">
              <SelectField label="Frete" value={form.freightType} options={[{ value: "CIF - Pago pela Industria", label: "CIF - Pago pela Indústria" }, { value: "FOB - Pago pelo Cliente", label: "FOB - Pago pelo Cliente" }]} onChange={(value) => update("freightType", value)} />
              <SelectField label="Entrega" value={form.deliveryType} options={[{ value: "Entrega Imediata", label: "Entrega Imediata" }, { value: "Entrega Programada", label: "Entrega Programada" }]} onChange={(value) => update("deliveryType", value)} />
              {form.deliveryType === "Entrega Programada" ? <Field label="Data programada *" value={form.scheduledDate} onChangeText={(value) => update("scheduledDate", value)} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} /> : null}
              <Field label="Pedido de compra" value={form.purchaseOrder} onChangeText={(value) => update("purchaseOrder", value)} maxLength={100} />
              <Field label="Tipo de nota" value={form.invoiceType} onChangeText={(value) => update("invoiceType", value)} maxLength={100} />
              <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchLabel}>Nota do operador tributário</Text><Text style={styles.switchHint}>Marque quando a nota fiscal for emitida pelo operador.</Text></View><Switch value={form.taxOperatorInvoice} onValueChange={(value) => update("taxOperatorInvoice", value)} trackColor={{ false: "#CBD5E1", true: "#83BCE2" }} thumbColor={form.taxOperatorInvoice ? colors.brand : "#FFFFFF"} /></View>
            </FormSection>
            {!bonus ? <FormSection title="Condições comerciais">
              <Field label="Condição de pagamento *" value={form.paymentTerms} onChangeText={(value) => update("paymentTerms", value)} maxLength={180} />
              <View style={styles.twoColumns}><View style={styles.column}><Field label="Comissão (%)" value={form.commissionPercent} onChangeText={(value) => update("commissionPercent", value)} keyboardType="decimal-pad" /></View><View style={styles.column}><Field label="Desconto (%)" value={form.discountPercent} onChangeText={(value) => update("discountPercent", value)} keyboardType="decimal-pad" /></View></View>
              <SelectField label="Aplicar desconto em" value={form.discountOn} options={["Sem descontos", "Produtos", "Pedido"].map((value) => ({ value, label: value }))} onChange={(value) => update("discountOn", value)} />
            </FormSection> : null}
            <FormSection title="Observações e total">
              <Field label="Observações" value={form.notes} onChangeText={(value) => update("notes", value)} multiline maxLength={1500} />
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View>{discount > 0 ? <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Desconto</Text><Text style={styles.discount}>− {money(discount)}</Text></View> : null}<View style={[styles.summaryRow, styles.grandTotal]}><Text style={styles.grandTotalLabel}>Total estimado</Text><Text style={styles.grandTotalValue}>{money(total)}</Text></View>
            </FormSection>
          </> : null}

          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
          <View style={styles.footer}>{step > 0 ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setError(""); setStep(step - 1); }} style={styles.backButton}><Text style={styles.backButtonText}>Voltar</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={step === 2 ? submit : next} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{step === 2 ? "Enviar proposta" : "Continuar"}</Text>}</Pressable></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas }, loadingText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: colors.surface }, back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF3F7" }, backText: { color: colors.ink, fontSize: 31, lineHeight: 33 }, headerCopy: { flex: 1 }, eyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 2 },
  progress: { height: 4, backgroundColor: "#DDE7EF" }, progressValue: { height: 4, backgroundColor: colors.accent }, content: { gap: 14, padding: 16, paddingBottom: 38 },
  secondaryButton: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: colors.brand, backgroundColor: "#F1F8FD" }, secondaryButtonText: { color: colors.brand, fontSize: 13, fontWeight: "900" }, disabled: { opacity: 0.48 },
  line: { borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 13 }, lineHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, lineCopy: { flex: 1 }, lineName: { color: colors.ink, fontSize: 13, fontWeight: "800" }, lineCode: { color: colors.muted, fontSize: 11, marginTop: 3 }, remove: { color: colors.danger, fontSize: 11, fontWeight: "800" }, lineFields: { flexDirection: "row", gap: 10, marginTop: 12 }, lineField: { flex: 1 }, lineTotal: { color: colors.ink, fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 10 }, empty: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }, totalLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" }, totalValue: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58 }, switchCopy: { flex: 1 }, switchLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" }, switchHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, twoColumns: { flexDirection: "row", gap: 10 }, column: { flex: 1 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, summaryLabel: { color: colors.muted, fontSize: 13 }, summaryValue: { color: colors.ink, fontSize: 14, fontWeight: "800" }, discount: { color: colors.success, fontSize: 14, fontWeight: "800" }, grandTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }, grandTotalLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" }, grandTotalValue: { color: colors.brandDark, fontSize: 23, fontWeight: "900" },
  errorCard: { borderRadius: 13, backgroundColor: "#FDECEC", padding: 14 }, errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 }, footer: { flexDirection: "row", gap: 10, marginTop: 2 }, backButton: { minWidth: 100, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, backButtonText: { color: colors.ink, fontSize: 14, fontWeight: "800" }, primaryButton: { flex: 1, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.brand }, primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
