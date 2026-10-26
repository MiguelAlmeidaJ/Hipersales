import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { Field, FormSection, SelectField } from "@/components/form-controls";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api, lookupCnpj, type CnpjLookupData } from "@/lib/api";
import { digitsOnly } from "@/lib/format";

type CustomerForm = {
  cnpj: string; legal_name: string; trade_name: string; contact_person: string;
  phone_1: string; phone_2: string; purchase_email: string; billing_email: string;
  xml_email: string; state_registration: string; municipal_registration: string;
  address: string; address_number: string; neighborhood: string; city: string;
  state: string; zip_code: string; delivery_address: string; scheduled_delivery: string;
  scheduling_instructions: string; delivery_warnings: string; notes: string;
};
type SellerOption = { id: number; name: string; role: string; active: boolean | number };

const initial: CustomerForm = {
  cnpj: "", legal_name: "", trade_name: "", contact_person: "", phone_1: "", phone_2: "",
  purchase_email: "", billing_email: "", xml_email: "", state_registration: "", municipal_registration: "",
  address: "", address_number: "", neighborhood: "", city: "", state: "", zip_code: "",
  delivery_address: "", scheduled_delivery: "no", scheduling_instructions: "", delivery_warnings: "", notes: "",
};
const steps = [
  { title: "Consulta Cadastral", short: "Consulta" },
  { title: "Dados Cadastrais", short: "Cadastro" },
  { title: "Informações de Contato", short: "Contato" },
  { title: "Condições de Recebimento", short: "Recebimento" },
];
const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((value) => ({ value, label: value }));
const yesNo = [{ value: "no", label: "Não" }, { value: "yes", label: "Sim" }];

function normalizeCnpj(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14); }
function maskCnpj(value: string) {
  const raw = normalizeCnpj(value);
  return [raw.slice(0, 2), raw.slice(2, 5), raw.slice(5, 8), raw.slice(8, 12), raw.slice(12, 14)]
    .filter(Boolean).map((part, index) => `${index === 1 || index === 2 ? "." : index === 3 ? "/" : index === 4 ? "-" : ""}${part}`).join("");
}
function cnpjDigit(base: string, weights: number[]) {
  const sum = base.split("").reduce((total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index], 0);
  const digit = 11 - (sum % 11);
  return digit >= 10 ? 0 : digit;
}
function isValidCnpj(value: string) {
  const raw = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(raw) || (/^\d+$/.test(raw) && /^(\d)\1{13}$/.test(raw))) return false;
  const first = cnpjDigit(raw.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjDigit(`${raw.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return raw.endsWith(`${first}${second}`);
}
function maskPhone(value: string) { const raw = digitsOnly(value).slice(0, 11); if (raw.length <= 2) return raw.replace(/^(\d{1,2})/, "($1"); if (raw.length <= 6) return raw.replace(/^(\d{2})(\d+)/, "($1) $2"); if (raw.length <= 10) return raw.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3"); return raw.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3"); }
function maskZip(value: string) { return digitsOnly(value).slice(0, 8).replace(/^(\d{5})(\d+)/, "$1-$2"); }
function textFrom(data: CnpjLookupData, ...keys: string[]) {
  for (const key of keys) { const value = data[key]; if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); }
  return "";
}
function registrationFrom(data: CnpjLookupData, kind: "state" | "municipal") {
  const direct = kind === "state"
    ? textFrom(data, "state_registration", "inscricao_estadual", "inscricaoEstadual", "ie")
    : textFrom(data, "municipal_registration", "inscricao_municipal", "inscricaoMunicipal", "im");
  if (direct) return direct;
  const list = data[kind === "state" ? "inscricoes_estaduais" : "inscricoes_municipais"];
  if (Array.isArray(list)) {
    const active = list.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).ativo !== false) ?? list[0];
    if (active && typeof active === "object") return textFrom(active as CnpjLookupData, "inscricao_estadual", "inscricao_municipal", "numero", "inscricao");
  }
  return "";
}

export default function NewCustomerScreen() {
  const { status, user } = useSession();
  const isAdmin = user?.role === "admin" || user?.role === "dev";
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = Number(params.id || 0);
  const [step, setStep] = useState(0);
  const [customerStatus, setCustomerStatus] = useState("ativo");
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [sellerIds, setSellerIds] = useState<number[]>([]);
  const [form, setForm] = useState<CustomerForm>(initial);
  const [verified, setVerified] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    api<{ users: SellerOption[] }>("/api/admin/users").then((result) => { if (active) setSellers(result.users.filter((item) => item.role === "seller" && Boolean(item.active))); }).catch(() => undefined);
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!editId || !isAdmin) return;
    let active = true;
    api<{ customers: { id: number; cnpj: string; legal_name: string; trade_name?: string; state_registration?: string; phone?: string; email?: string; address?: string; status?: string; active?: boolean | number; seller_ids?: number[]; form_payload?: Record<string, unknown> }[] }>("/api/admin/customers").then((result) => {
      const item = result.customers.find((customer) => customer.id === editId);
      if (!item) { if (active) setError("Cliente não encontrado."); return; }
      const payload = item.form_payload || {};
      const read = (key: string) => String(payload[key] ?? "");
      if (active) {
        setSellerIds(item.seller_ids || []); setCustomerStatus(item.status || (item.active ? "ativo" : "inativo"));
        setForm((current) => ({ ...current, cnpj: maskCnpj(item.cnpj), legal_name: item.legal_name, trade_name: item.trade_name || "", state_registration: item.state_registration || "", address: item.address || read("address"), phone_1: item.phone || read("buyer_phone_1"), purchase_email: item.email || read("buyer_email"), contact_person: read("buyer_contact"), address_number: read("address_number"), neighborhood: read("neighborhood"), city: read("city"), state: read("state"), zip_code: read("zip_code"), municipal_registration: read("municipal_registration"), phone_2: read("buyer_phone_2"), billing_email: read("finance_email"), xml_email: read("xml_email"), delivery_address: read("delivery_address"), scheduling_instructions: read("scheduling_instructions"), delivery_warnings: read("delivery_warnings"), notes: read("additional_notes") }));
        setVerified(normalizeCnpj(item.cnpj));
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar cliente."); });
    return () => { active = false; };
  }, [editId, isAdmin]);

  const stepValid = useMemo(() => [
    isValidCnpj(form.cnpj) && verified === normalizeCnpj(form.cnpj),
    Boolean(form.legal_name.trim()),
    Boolean(form.contact_person.trim() && digitsOnly(form.phone_1).length >= 10 && form.purchase_email.trim()),
    form.scheduled_delivery !== "yes" || Boolean(form.scheduling_instructions.trim()),
  ], [form, verified]);
  const valid = stepValid.every(Boolean);

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (status === "loading") return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Preparando cadastro…</Text></SafeAreaView>;

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeCnpj(value: string) { setVerified(""); setNotice(""); update("cnpj", maskCnpj(value)); }
  function changeScheduledDelivery(value: string) { setForm((current) => ({ ...current, scheduled_delivery: value, scheduling_instructions: value === "yes" ? "" : current.scheduling_instructions })); }
  async function lookup() {
    const cnpj = normalizeCnpj(form.cnpj); setError(""); setNotice("");
    if (!isValidCnpj(cnpj)) { setError("CNPJ inválido. Use 14 posições: letras ou números nas 12 primeiras e números nos dois dígitos finais."); return; }
    setSearching(true);
    try {
      const result = await lookupCnpj(cnpj);
      const stateRegistration = registrationFrom(result, "state");
      const municipalRegistration = registrationFrom(result, "municipal");
      setForm((old) => normalizeCnpj(old.cnpj) !== cnpj ? old : ({ ...old,
        legal_name: textFrom(result, "legal_name", "razao_social", "razaoSocial", "nome_empresarial") || old.legal_name,
        trade_name: textFrom(result, "trade_name", "nome_fantasia", "nomeFantasia", "estabelecimento") || old.trade_name,
        state_registration: stateRegistration || old.state_registration,
        municipal_registration: municipalRegistration || old.municipal_registration || "ISENTO",
        phone_1: maskPhone(textFrom(result, "phone", "telefone", "ddd_telefone_1", "telefone1")) || old.phone_1,
        phone_2: maskPhone(textFrom(result, "phone_2", "telefone2", "ddd_telefone_2")) || old.phone_2,
        purchase_email: textFrom(result, "email", "correio_eletronico") || old.purchase_email,
        address: textFrom(result, "street", "address_line", "address", "logradouro") || old.address,
        address_number: textFrom(result, "number", "address_number", "numero") || old.address_number,
        neighborhood: textFrom(result, "neighborhood", "bairro") || old.neighborhood,
        city: textFrom(result, "city", "municipio", "nome_municipio") || old.city,
        state: textFrom(result, "state", "uf").toUpperCase() || old.state,
        zip_code: maskZip(textFrom(result, "zip_code", "cep")) || old.zip_code,
      }));
      setVerified(cnpj);
      setNotice(`Cadastro localizado${result._sources?.length ? ` em ${result._sources.join(" + ")}` : ""}. Confira os dados preenchidos.`);
      setStep(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível consultar o CNPJ."); }
    finally { setSearching(false); }
  }
  function next() {
    if (!stepValid[step]) { setError(step === 0 ? "Consulte um CNPJ válido antes de continuar." : "Preencha os campos obrigatórios desta etapa."); return; }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }
  async function submit() {
    if (!valid) { const firstInvalid = stepValid.findIndex((item) => !item); setStep(Math.max(firstInvalid, 0)); setError("Revise os campos obrigatórios antes de enviar."); return; }
    setBusy(true); setError("");
    try {
      const payload = { ...form, cnpj: normalizeCnpj(form.cnpj), buyer_contact: form.contact_person, buyer_phone_1: form.phone_1, buyer_phone_2: form.phone_2, buyer_email: form.purchase_email, finance_email: form.billing_email, additional_notes: form.notes, ...(isAdmin ? { seller_ids: sellerIds, phone: form.phone_1, email: form.purchase_email, active: editId ? customerStatus === "ativo" : true, status: editId ? customerStatus : "ativo" } : {}) };
      const result = await api<{ id: number; message?: string }>((editId && isAdmin ? `/api/admin/customers/${editId}` : isAdmin ? "/api/admin/customers" : "/api/customer-requests") as `/api/${string}`, { method: editId && isAdmin ? "PATCH" : "POST", body: JSON.stringify(payload), timeoutMs: 30_000 });
      setSuccess(result.message || "Operação concluída.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro."); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><AppIcon name="arrow-back" color={colors.ink} size={22} /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>CADASTRO DE CLIENTES</Text><Text style={styles.title}>{editId ? "Editar cliente" : isAdmin ? "Cadastrar cliente" : "Solicitar novo cliente"}</Text><Text style={styles.subtitle}>Etapa {step + 1} de {steps.length} · {steps[step].title}</Text></View></View>
    <View style={styles.progress}>{steps.map((item, index) => <Pressable key={item.short} accessibilityLabel={`Etapa ${index + 1}: ${item.title}`} accessibilityRole="button" accessibilityState={{ selected: index === step, disabled: index > step && !stepValid[index - 1] }} disabled={index > step && !stepValid[index - 1]} onPress={() => setStep(index)} style={styles.progressItem}><View style={[styles.progressDot, index <= step && styles.progressDotActive]}>{index < step ? <AppIcon name="checkmark" size={13} color="#FFF" /> : <Text style={[styles.progressNumber, index <= step && styles.progressNumberActive]}>{index + 1}</Text>}</View><Text numberOfLines={1} style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{item.short}</Text></Pressable>)}</View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step === 0 ? <FormSection title="Consulta cadastral" subtitle="Buscamos em mais de uma fonte para preencher o cadastro com o máximo de informações."><Field label="CNPJ *" value={form.cnpj} onChangeText={changeCnpj} autoCapitalize="characters" keyboardType="default" maxLength={18} placeholder="00.000.000/0000-00" hint="O novo CNPJ aceita letras nas 12 primeiras posições." /><Pressable accessibilityRole="button" disabled={searching} onPress={() => void lookup()} style={[styles.lookup, searching && styles.disabled]}>{searching ? <ActivityIndicator color="#FFF" /> : <AppIcon name="search" color="#FFF" size={18} />}<Text style={styles.lookupText}>{searching ? "Consultando fontes…" : "Consultar CNPJ"}</Text></Pressable>{verified ? <View style={styles.verified}><AppIcon name="checkmark-circle" color={colors.success} size={18} /><Text style={styles.verifiedText}>Consulta concluída</Text></View> : null}</FormSection> : null}

      {step === 1 ? <FormSection title="Dados cadastrais" subtitle="Confira os dados encontrados e complete o que estiver faltando.">
        {editId && isAdmin ? <SelectField label="Status cadastral" value={customerStatus} onChange={setCustomerStatus} options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "bloqueado", label: "Bloqueado" }]} /> : null}
        <Field label="Razão social *" value={form.legal_name} onChangeText={(value) => update("legal_name", value)} maxLength={240} /><Field label="Nome fantasia / fachada" value={form.trade_name} onChangeText={(value) => update("trade_name", value)} maxLength={240} />
        <View style={styles.registrationRow}><View style={styles.registrationField}><Field label="Inscrição estadual" value={form.state_registration} onChangeText={(value) => update("state_registration", value.toUpperCase())} maxLength={40} /></View><Pressable accessibilityLabel="Marcar inscrição estadual como isento" accessibilityRole="button" onPress={() => update("state_registration", "ISENTO")} style={styles.exempt}><Text style={styles.exemptText}>ISENTO</Text></Pressable></View>
        <View style={styles.registrationRow}><View style={styles.registrationField}><Field label="Inscrição municipal" value={form.municipal_registration} onChangeText={(value) => update("municipal_registration", value.toUpperCase())} maxLength={40} /></View><Pressable accessibilityLabel="Marcar inscrição municipal como isento" accessibilityRole="button" onPress={() => update("municipal_registration", "ISENTO")} style={styles.exempt}><Text style={styles.exemptText}>ISENTO</Text></Pressable></View>
        <Field label="Endereço" value={form.address} onChangeText={(value) => update("address", value)} maxLength={300} /><Field label="Número" value={form.address_number} onChangeText={(value) => update("address_number", value)} maxLength={30} /><Field label="Bairro" value={form.neighborhood} onChangeText={(value) => update("neighborhood", value)} maxLength={120} /><Field label="Cidade" value={form.city} onChangeText={(value) => update("city", value)} maxLength={120} /><SelectField label="UF" value={form.state} onChange={(value) => update("state", value)} options={states} searchable /><Field label="CEP" value={form.zip_code} onChangeText={(value) => update("zip_code", maskZip(value))} keyboardType="number-pad" maxLength={9} placeholder="00000-000" />
        {isAdmin ? <><Text style={styles.innerTitle}>Representantes responsáveis</Text><View style={styles.sellerList}>{sellers.map((seller) => <Pressable key={seller.id} accessibilityRole="checkbox" accessibilityState={{ checked: sellerIds.includes(seller.id) }} onPress={() => setSellerIds((current) => current.includes(seller.id) ? current.filter((id) => id !== seller.id) : [...current, seller.id])} style={[styles.seller, sellerIds.includes(seller.id) && styles.sellerActive]}><Text style={styles.sellerText}>{sellerIds.includes(seller.id) ? "✓ " : ""}{seller.name}</Text></Pressable>)}</View></> : null}
      </FormSection> : null}

      {step === 2 ? <FormSection title="Informações de contato" subtitle="Informe os contatos usados por compras, financeiro e documentos fiscais."><Field label="Pessoa de contato *" value={form.contact_person} onChangeText={(value) => update("contact_person", value)} maxLength={180} /><Field label="Telefone 1 *" value={form.phone_1} onChangeText={(value) => update("phone_1", maskPhone(value))} keyboardType="phone-pad" maxLength={15} /><Field label="Telefone 2" value={form.phone_2} onChangeText={(value) => update("phone_2", maskPhone(value))} keyboardType="phone-pad" maxLength={15} /><Field label="E-mail de compras *" value={form.purchase_email} onChangeText={(value) => update("purchase_email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} /><Field label="E-mail de boletos" value={form.billing_email} onChangeText={(value) => update("billing_email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} /><Field label="E-mail de XML" value={form.xml_email} onChangeText={(value) => update("xml_email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} /></FormSection> : null}

      {step === 3 ? <FormSection title="Condições de recebimento" subtitle="Registre como o cliente recebe mercadorias e quais cuidados devem ser observados."><Field label="Endereço de entrega" value={form.delivery_address} onChangeText={(value) => update("delivery_address", value)} multiline maxLength={500} hint="Se vazio, será usado o endereço de faturamento." /><SelectField label="Entrega agendada" value={form.scheduled_delivery} onChange={changeScheduledDelivery} options={yesNo} /><Field label={form.scheduled_delivery === "yes" ? "Como agendar *" : "Como agendar"} value={form.scheduling_instructions} onChangeText={(value) => update("scheduling_instructions", value)} editable={form.scheduled_delivery === "yes"} placeholder={form.scheduled_delivery === "yes" ? "Digite as instruções para agendamento" : "Disponível ao selecionar Sim"} multiline maxLength={500} /><Field label="Advertências para recebimento" value={form.delivery_warnings} onChangeText={(value) => update("delivery_warnings", value)} multiline maxLength={1000} /><Field label="Observações adicionais" value={form.notes} onChangeText={(value) => update("notes", value)} multiline maxLength={1000} /></FormSection> : null}

      {notice ? <View style={styles.notice}><AppIcon name="information-circle" color={colors.success} size={19} /><Text style={styles.noticeText}>{notice}</Text></View> : null}
      <View style={styles.navigation}>{step > 0 ? <Pressable accessibilityRole="button" onPress={() => setStep((current) => current - 1)} style={styles.previous}><AppIcon name="arrow-back" color={colors.ink} size={18} /><Text style={styles.previousText}>Voltar</Text></Pressable> : <View />}{step < steps.length - 1 ? <Pressable accessibilityRole="button" onPress={next} style={styles.next}><Text style={styles.nextText}>Continuar</Text><AppIcon name="arrow-forward" color="#FFF" size={18} /></Pressable> : <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void submit()} style={[styles.next, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.nextText}>{editId ? "Salvar alterações" : isAdmin ? "Cadastrar cliente" : "Enviar solicitação"}</Text><AppIcon name="checkmark" color="#FFF" size={18} /></>}</Pressable>}</View>
    </ScrollView></KeyboardAvoidingView>
    <FeedbackDialog visible={Boolean(error)} title="Revise o cadastro" message={error} tone="error" onClose={() => setError("")} />
    <FeedbackDialog visible={Boolean(success)} title={editId ? "Cliente atualizado" : isAdmin ? "Cliente cadastrado" : "Solicitação enviada"} message={success} tone="success" onClose={() => { setSuccess(""); router.replace("/(app)/customers"); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas }, loadingText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: colors.surface }, back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF3F7" }, headerCopy: { flex: 1 }, eyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 2 }, subtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  progress: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, progressItem: { flex: 1, alignItems: "center", gap: 5 }, progressDot: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#E6ECEF" }, progressDotActive: { backgroundColor: colors.brand }, progressNumber: { color: colors.muted, fontSize: 11, fontWeight: "900" }, progressNumberActive: { color: "#FFF" }, progressLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" }, progressLabelActive: { color: colors.brandDark, fontWeight: "900" },
  content: { gap: 14, padding: 16, paddingBottom: 38 }, lookup: { height: 50, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brand }, lookupText: { color: "#FFF", fontSize: 14, fontWeight: "900" }, verified: { flexDirection: "row", alignItems: "center", gap: 7 }, verifiedText: { color: colors.success, fontSize: 12, fontWeight: "800" },
  registrationRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 }, registrationField: { flex: 1 }, exempt: { height: 50, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EDF3F7" }, exemptText: { color: colors.brandDark, fontSize: 10, fontWeight: "900" }, innerTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 3 }, sellerList: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, seller: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFF", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13 }, sellerActive: { borderColor: colors.brand, backgroundColor: "#E9F3FF" }, sellerText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 13, backgroundColor: "#E9F8F1", padding: 14 }, noticeText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18, fontWeight: "600" }, navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, previous: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 20, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, previousText: { color: colors.ink, fontSize: 14, fontWeight: "900" }, next: { minWidth: 145, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, borderRadius: 15, backgroundColor: colors.brand }, nextText: { color: "#FFF", fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.48 },
});
