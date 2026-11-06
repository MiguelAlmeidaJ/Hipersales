import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { Field, FormSection, SelectField, type SelectOption } from "@/components/form-controls";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api, lookupCnpj, type CnpjLookupData } from "@/lib/api";
import { isValidCnpj, maskCnpj, normalizeCnpj } from "@/lib/cnpj";
import { digitsOnly } from "@/lib/format";
import type { Customer } from "@/types/commercial";

type CustomerForm = {
  cnpj: string;
  legal_name: string;
  trade_name: string;
  network_member: string;
  network_name: string;
  state_registration: string;
  municipal_registration: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  tax_regime: string;
  has_tax_benefit: string;
  tax_benefit: string;
  buyer_contact: string;
  buyer_phone_1: string;
  buyer_phone_2: string;
  buyer_email: string;
  finance_contact: string;
  finance_phone_1: string;
  finance_phone_2: string;
  finance_email: string;
  logistics_contact: string;
  logistics_phone_1: string;
  logistics_phone_2: string;
  xml_email: string;
  delivery_address_type: string;
  delivery_street: string;
  delivery_number: string;
  delivery_neighborhood: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip_code: string;
  unloading_type: string;
  scheduling_instructions: string;
  receiving_days: string;
  receiving_hours: string;
  load_type: string;
  unloading_helper: string;
  unloading_charge: string;
  unloading_value: string;
  unloading_paid_by: string;
  notes: string;
};

type SellerOption = { id: number; name: string; role: string; active: boolean | number };

const initial: CustomerForm = {
  cnpj: "",
  legal_name: "",
  trade_name: "",
  network_member: "",
  network_name: "",
  state_registration: "",
  municipal_registration: "",
  address: "",
  address_number: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  tax_regime: "",
  has_tax_benefit: "",
  tax_benefit: "",
  buyer_contact: "",
  buyer_phone_1: "",
  buyer_phone_2: "",
  buyer_email: "",
  finance_contact: "",
  finance_phone_1: "",
  finance_phone_2: "",
  finance_email: "",
  logistics_contact: "",
  logistics_phone_1: "",
  logistics_phone_2: "",
  xml_email: "",
  delivery_address_type: "same",
  delivery_street: "",
  delivery_number: "",
  delivery_neighborhood: "",
  delivery_city: "",
  delivery_state: "",
  delivery_zip_code: "",
  unloading_type: "",
  scheduling_instructions: "",
  receiving_days: "mon_fri",
  receiving_hours: "",
  load_type: "",
  unloading_helper: "",
  unloading_charge: "",
  unloading_value: "",
  unloading_paid_by: "",
  notes: "",
};

const steps = [
  { title: "Consulta cadastral", short: "Consulta" },
  { title: "Dados básicos", short: "Básicos" },
  { title: "Dados fiscais", short: "Fiscal" },
  { title: "Contatos", short: "Contatos" },
  { title: "Informações de entrega", short: "Entrega" },
  { title: "Revisão dos dados", short: "Revisão" },
];

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((value) => ({ value, label: value }));
const yesNo: SelectOption[] = [{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }];
const taxRegimes: SelectOption[] = [
  { value: "lucro_real", label: "Lucro real" },
  { value: "lucro_presumido", label: "Lucro presumido" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "mei", label: "MEI" },
];
const receivingDays: SelectOption[] = [
  { value: "monday", label: "Segunda-feira" },
  { value: "tuesday", label: "Terça-feira" },
  { value: "wednesday", label: "Quarta-feira" },
  { value: "thursday", label: "Quinta-feira" },
  { value: "friday", label: "Sexta-feira" },
  { value: "mon_wed", label: "De segunda a quarta-feira" },
  { value: "mon_thu", label: "De segunda a quinta-feira" },
  { value: "mon_fri", label: "De segunda a sexta-feira" },
];
const receivingHours: SelectOption[] = Array.from({ length: 8 }, (_, index) => {
  const end = 11 + index;
  return { value: `08_${end}`, label: `De 08:00 às ${String(end).padStart(2, "0")}:00` };
});

function maskPhone(value: string) {
  const raw = digitsOnly(value).slice(0, 11);
  if (raw.length <= 2) return raw.replace(/^(\d{1,2})/, "($1");
  if (raw.length <= 6) return raw.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (raw.length <= 10) return raw.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return raw.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}
function maskZip(value: string) { return digitsOnly(value).slice(0, 8).replace(/^(\d{5})(\d+)/, "$1-$2"); }
function maskMoney(value: string) {
  const cents = digitsOnly(value).slice(0, 11);
  if (!cents) return "";
  return (Number(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function validPhone(value: string) { return digitsOnly(value).length >= 10; }
function optionLabel(options: SelectOption[], value: string) { return options.find((item) => item.value === value)?.label || "Não informado"; }
function billingAddress(form: CustomerForm) { return [form.address, form.address_number, form.neighborhood, [form.city, form.state].filter(Boolean).join("/"), form.zip_code].filter((value) => value.trim()).join(", "); }
function deliveryAddress(form: CustomerForm) {
  if (form.delivery_address_type === "same") return billingAddress(form);
  return [form.delivery_street, form.delivery_number, form.delivery_neighborhood, [form.delivery_city, form.delivery_state].filter(Boolean).join("/"), form.delivery_zip_code].filter((value) => value.trim()).join(", ");
}
function recordFrom(value: unknown): CnpjLookupData { return value && typeof value === "object" && !Array.isArray(value) ? value as CnpjLookupData : {}; }
function comparableKey(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase(); }
function textFrom(data: CnpjLookupData, ...keys: string[]) {
  for (const key of keys) { const value = data[key]; if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); }
  const wanted = new Set(keys.map(comparableKey));
  for (const [key, value] of Object.entries(data)) { if (!wanted.has(comparableKey(key))) continue; if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); }
  return "";
}
function normalizeCnpjResult(data: CnpjLookupData) {
  const root = recordFrom(data.data || data.dados || data.resultado);
  const source = Object.keys(root).length ? root : data;
  const company = recordFrom(source.empresa || data.empresa);
  const establishment = recordFrom(source.estabelecimento || data.estabelecimento);
  const address = recordFrom(establishment.endereco || source.endereco || data.endereco || source.address);
  const city = recordFrom(address.municipio || address.cidade || establishment.municipio || establishment.cidade || source.municipio || source.cidade);
  const state = recordFrom(address.estado || establishment.estado || source.estado);
  const normalized: CnpjLookupData = { ...company, ...establishment, ...address, ...source, ...data };
  normalized.city = textFrom(normalized, "city", "municipio", "nome_municipio") || textFrom(city, "nome", "descricao");
  normalized.state = textFrom(normalized, "state", "uf", "sigla") || textFrom(state, "sigla", "uf");
  return normalized;
}
function phoneFrom(data: CnpjLookupData, secondary = false) {
  const direct = textFrom(data, ...(secondary ? ["phone_2", "telefone2", "ddd_telefone_2"] : ["phone", "telefone", "ddd_telefone_1", "telefone1"]));
  const digits = digitsOnly(direct);
  if (digits.length >= 10) return direct;
  const areaCode = textFrom(data, secondary ? "ddd2" : "ddd1", secondary ? "ddd_2" : "ddd_1", "ddd");
  return `${areaCode}${direct}`;
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
function formatStateRegistration(value: string, state: string) {
  const digits = digitsOnly(value);
  if (state === "MG" && digits.length === 13) return digits.replace(/^(\d{9})(\d{2})(\d{2})$/, "$1.$2-$3");
  return value;
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value?.trim() || "Não informado"}</Text></View>;
}

export default function NewCustomerScreen() {
  const { status, user } = useSession();
  const isAdmin = user?.role === "admin" || user?.role === "dev";
  const params = useLocalSearchParams<{ id?: string; resubmit?: string }>();
  const editId = Number(params.id || 0);
  const isResubmission = params.resubmit === "1";
  const isAdministrativeEdit = Boolean(editId && isAdmin && !isResubmission);
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
    if (!editId) return;
    let active = true;
    api<{ customers: (Customer & { seller_ids?: number[]; form_payload?: Record<string, unknown> })[] }>(isAdministrativeEdit ? "/api/admin/customers" : "/api/customers").then((result) => {
      const item = result.customers.find((customer) => customer.id === editId);
      if (!item) { if (active) setError("Cliente não encontrado."); return; }
      const payload = item.form_payload || {};
      const read = (...keys: string[]) => { for (const key of keys) { const value = payload[key]; if (value !== undefined && value !== null && String(value).trim()) return String(value); } return ""; };
      if (active) {
        const savedDeliveryAddress = read("delivery_address");
        const addressType = read("delivery_address_type") || (savedDeliveryAddress && savedDeliveryAddress !== item.address ? "different" : "same");
        setSellerIds(item.seller_ids || []);
        setCustomerStatus(item.status || (item.active ? "ativo" : "inativo"));
        setForm((current) => ({
          ...current,
          cnpj: maskCnpj(item.cnpj),
          legal_name: item.legal_name,
          trade_name: item.trade_name || "",
          network_member: read("network_member") || "no",
          network_name: read("network_name"),
          state_registration: item.state_registration || "",
          municipal_registration: read("municipal_registration"),
          address: read("address") || item.address || "",
          address_number: read("address_number"),
          neighborhood: read("neighborhood"),
          city: read("city"),
          state: read("state"),
          zip_code: read("zip_code"),
          tax_regime: read("tax_regime"),
          has_tax_benefit: read("has_tax_benefit") || "no",
          tax_benefit: read("tax_benefit"),
          buyer_contact: read("buyer_contact", "contact_person"),
          buyer_phone_1: read("buyer_phone_1", "phone_1") || item.phone || "",
          buyer_phone_2: read("buyer_phone_2", "phone_2"),
          buyer_email: read("buyer_email", "purchase_email") || item.email || "",
          finance_contact: read("finance_contact"),
          finance_phone_1: read("finance_phone_1"),
          finance_phone_2: read("finance_phone_2"),
          finance_email: read("finance_email", "billing_email"),
          logistics_contact: read("logistics_contact"),
          logistics_phone_1: read("logistics_phone_1"),
          logistics_phone_2: read("logistics_phone_2"),
          xml_email: read("xml_email"),
          delivery_address_type: addressType,
          delivery_street: read("delivery_street") || (addressType === "different" ? savedDeliveryAddress : ""),
          delivery_number: read("delivery_number"),
          delivery_neighborhood: read("delivery_neighborhood"),
          delivery_city: read("delivery_city"),
          delivery_state: read("delivery_state"),
          delivery_zip_code: read("delivery_zip_code"),
          unloading_type: read("unloading_type") || (read("scheduled_delivery") === "yes" ? "scheduled" : "arrival"),
          scheduling_instructions: read("scheduling_instructions"),
          receiving_days: read("receiving_days") || "mon_fri",
          receiving_hours: read("receiving_hours"),
          load_type: read("load_type"),
          unloading_helper: read("unloading_helper"),
          unloading_charge: read("unloading_charge"),
          unloading_value: read("unloading_value"),
          unloading_paid_by: read("unloading_paid_by"),
          notes: read("additional_notes", "notes"),
        }));
        setVerified(normalizeCnpj(item.cnpj));
        if (isResubmission) setStep(1);
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar cliente."); });
    return () => { active = false; };
  }, [editId, isAdministrativeEdit, isResubmission]);

  const stepValid = useMemo(() => {
    const basicAddress = Boolean(form.address.trim() && form.address_number.trim() && form.neighborhood.trim() && form.city.trim() && form.state && digitsOnly(form.zip_code).length === 8);
    const contacts = Boolean(
      form.buyer_contact.trim() && validPhone(form.buyer_phone_1) && validEmail(form.buyer_email)
      && form.finance_contact.trim() && validPhone(form.finance_phone_1) && validEmail(form.finance_email)
      && form.logistics_contact.trim() && validPhone(form.logistics_phone_1) && validEmail(form.xml_email)
    );
    const differentAddress = form.delivery_address_type === "same" || Boolean(form.delivery_street.trim() && form.delivery_number.trim() && form.delivery_neighborhood.trim() && form.delivery_city.trim() && form.delivery_state && digitsOnly(form.delivery_zip_code).length === 8);
    const delivery = Boolean(
      form.delivery_address_type && differentAddress && form.unloading_type
      && (form.unloading_type !== "scheduled" || form.scheduling_instructions.trim())
      && form.receiving_days && form.receiving_hours && form.load_type && form.unloading_helper && form.unloading_charge
      && (form.unloading_charge !== "charged" || (digitsOnly(form.unloading_value).length && form.unloading_paid_by))
    );
    return [
      isValidCnpj(form.cnpj) && verified === normalizeCnpj(form.cnpj),
      Boolean(form.legal_name.trim() && form.trade_name.trim() && form.network_member && (form.network_member !== "yes" || form.network_name.trim()) && form.state_registration.trim() && basicAddress),
      Boolean(form.tax_regime && form.has_tax_benefit && (form.has_tax_benefit !== "yes" || form.tax_benefit.trim())),
      contacts,
      delivery,
      true,
    ];
  }, [form, verified]);
  const valid = stepValid.slice(0, 5).every(Boolean);

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (status === "loading") return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Preparando cadastro…</Text></SafeAreaView>;

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeCnpj(value: string) { setVerified(""); setNotice(""); update("cnpj", maskCnpj(value)); }
  function changeNetwork(value: string) { setForm((current) => ({ ...current, network_member: value, network_name: value === "yes" ? current.network_name : "" })); }
  function changeTaxBenefit(value: string) { setForm((current) => ({ ...current, has_tax_benefit: value, tax_benefit: value === "yes" ? current.tax_benefit : "" })); }
  function changeAddressType(value: string) { setForm((current) => ({ ...current, delivery_address_type: value })); }
  function changeUnloadingType(value: string) { setForm((current) => ({ ...current, unloading_type: value, scheduling_instructions: value === "scheduled" ? current.scheduling_instructions : "" })); }
  function changeUnloadingCharge(value: string) { setForm((current) => ({ ...current, unloading_charge: value, unloading_value: value === "charged" ? current.unloading_value : "", unloading_paid_by: value === "charged" ? current.unloading_paid_by : "" })); }

  async function lookup() {
    const cnpj = normalizeCnpj(form.cnpj);
    setError(""); setNotice("");
    if (!isValidCnpj(cnpj)) { setError("CNPJ inválido. Use 14 posições: letras ou números nas 12 primeiras e números nos dois dígitos finais."); return; }
    setSearching(true);
    try {
      const result = await lookupCnpj(cnpj);
      const normalized = normalizeCnpjResult(result);
      const state = textFrom(normalized, "state", "uf", "sigla").toUpperCase();
      const stateRegistration = formatStateRegistration(registrationFrom(normalized, "state"), state);
      const municipalRegistration = registrationFrom(normalized, "municipal");
      setForm((old) => normalizeCnpj(old.cnpj) !== cnpj ? old : ({
        ...old,
        legal_name: textFrom(normalized, "legal_name", "razao_social", "razaoSocial", "razao", "nome_empresarial", "nomeEmpresarial", "nome") || old.legal_name,
        trade_name: textFrom(normalized, "trade_name", "nome_fantasia", "nomeFantasia", "fantasia") || old.trade_name,
        state_registration: stateRegistration || old.state_registration,
        municipal_registration: municipalRegistration || old.municipal_registration,
        buyer_phone_1: maskPhone(phoneFrom(normalized)) || old.buyer_phone_1,
        buyer_phone_2: maskPhone(phoneFrom(normalized, true)) || old.buyer_phone_2,
        buyer_email: textFrom(normalized, "email", "correio_eletronico") || old.buyer_email,
        address: textFrom(normalized, "street", "address_line", "address", "logradouro") || old.address,
        address_number: textFrom(normalized, "number", "address_number", "numero") || old.address_number,
        neighborhood: textFrom(normalized, "neighborhood", "bairro") || old.neighborhood,
        city: textFrom(normalized, "city", "municipio", "nome_municipio") || old.city,
        state: state || old.state,
        zip_code: maskZip(textFrom(normalized, "zip_code", "cep", "codigo_postal")) || old.zip_code,
      }));
      setVerified(cnpj);
      setNotice(`Cadastro localizado${result._sources?.length ? ` em ${result._sources.join(" + ")}` : ""}. Confira os dados preenchidos e complete os campos obrigatórios.`);
      setStep(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível consultar o CNPJ."); }
    finally { setSearching(false); }
  }

  function next() {
    if (!stepValid[step]) { setError(step === 0 ? "Consulte um CNPJ válido antes de continuar." : "Preencha todos os campos obrigatórios desta etapa."); return; }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit() {
    if (!valid) { const firstInvalid = stepValid.slice(0, 5).findIndex((item) => !item); setStep(Math.max(firstInvalid, 0)); setError("Revise os campos obrigatórios antes de enviar."); return; }
    setBusy(true); setError("");
    try {
      let municipalityId: number | undefined;
      if (form.city.trim() && form.state) {
        const support = await api<unknown>((`/api/support/cities?uf=${encodeURIComponent(form.state)}&busca=${encodeURIComponent(form.city.trim())}&tamanho=50`) as `/api/${string}`);
        const rows = Array.isArray(support) ? support : ((support as { itens?: unknown[] })?.itens || []);
        const wanted = form.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
        const found = rows.find((row) => String((row as { descricao?: string }).descricao || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() === wanted) as { id?: number } | undefined;
        municipalityId = found?.id;
      }
      const payload = {
        ...form,
        cnpj: normalizeCnpj(form.cnpj),
        municipality_id: municipalityId,
        delivery_address: deliveryAddress(form),
        scheduled_delivery: form.unloading_type === "scheduled" ? "yes" : "no",
        contact_person: form.buyer_contact,
        phone_1: form.buyer_phone_1,
        phone_2: form.buyer_phone_2,
        purchase_email: form.buyer_email,
        billing_email: form.finance_email,
        additional_notes: form.notes,
        ...(isAdmin && !isResubmission ? { seller_ids: sellerIds, phone: form.buyer_phone_1, email: form.buyer_email, active: editId ? customerStatus === "ativo" : true, status: editId ? customerStatus : "ativo" } : {}),
      };
      const result = await api<{ id: number; message?: string }>((isAdministrativeEdit ? `/api/admin/customers/${editId}` : isResubmission ? `/api/customer-requests/${editId}` : isAdmin ? "/api/admin/customers" : "/api/customer-requests") as `/api/${string}`, { method: isAdministrativeEdit || isResubmission ? "PATCH" : "POST", body: JSON.stringify(payload), timeoutMs: 30_000 });
      setSuccess(!isAdmin && !isResubmission ? "O cadastro foi enviado para análise. O prazo de efetivação é de até 3 dias úteis." : result.message || "Operação concluída.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro."); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><AppIcon name="arrow-back" color={colors.ink} size={22} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>{isResubmission ? "REENVIO PARA APROVAÇÃO" : "CADASTRO DE CLIENTES"}</Text><Text style={styles.title}>{isResubmission ? "Ajustar cliente" : editId ? "Editar cliente" : isAdmin ? "Cadastrar cliente" : "Solicitar novo cliente"}</Text><Text style={styles.subtitle}>Etapa {step + 1} de {steps.length} · {steps[step].title}</Text></View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.progressScroll} contentContainerStyle={styles.progress}>
      {steps.map((item, index) => <Pressable key={item.short} accessibilityLabel={`Etapa ${index + 1}: ${item.title}`} accessibilityRole="button" accessibilityState={{ selected: index === step, disabled: index > step && !stepValid[index - 1] }} disabled={index > step && !stepValid[index - 1]} onPress={() => setStep(index)} style={styles.progressItem}><View style={[styles.progressDot, index <= step && styles.progressDotActive]}>{index < step ? <AppIcon name="checkmark" size={13} color="#FFF" /> : <Text style={[styles.progressNumber, index <= step && styles.progressNumberActive]}>{index + 1}</Text>}</View><Text numberOfLines={1} style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{item.short}</Text></Pressable>)}
    </ScrollView>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step === 0 ? <FormSection title="Consulta cadastral" subtitle="Digite o CNPJ para buscar os dados públicos da empresa e iniciar a solicitação.">
        <Field label="CNPJ *" value={form.cnpj} onChangeText={changeCnpj} autoCapitalize="characters" keyboardType="default" maxLength={18} placeholder="00.000.000/0000-00" hint="As 12 primeiras posições aceitam letras e números; os 2 dígitos finais aceitam somente números." />
        <Pressable accessibilityRole="button" disabled={searching} onPress={() => void lookup()} style={[styles.lookup, searching && styles.disabled]}>{searching ? <ActivityIndicator color="#FFF" /> : <AppIcon name="search" color="#FFF" size={18} />}<Text style={styles.lookupText}>{searching ? "Consultando fontes…" : "Pesquisar CNPJ"}</Text></Pressable>
        {verified ? <View style={styles.verified}><AppIcon name="checkmark-circle" color={colors.success} size={18} /><Text style={styles.verifiedText}>Consulta concluída</Text></View> : null}
      </FormSection> : null}

      {step === 1 ? <FormSection title="Dados básicos" subtitle="Confira as informações localizadas e preencha todos os dados que estiverem faltando.">
        {isAdministrativeEdit ? <SelectField label="Status cadastral" value={customerStatus} onChange={setCustomerStatus} options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "bloqueado", label: "Bloqueado" }]} /> : null}
        <Field label="Razão social *" value={form.legal_name} onChangeText={(value) => update("legal_name", value)} maxLength={240} />
        <Field label="Nome fantasia / fachada *" value={form.trade_name} onChangeText={(value) => update("trade_name", value)} maxLength={240} hint="Obrigatório quando a consulta não retornar um nome fantasia." />
        <SelectField label="Pertence a uma rede? *" value={form.network_member} onChange={changeNetwork} options={yesNo} />
        {form.network_member === "yes" ? <Field label="Nome da rede *" value={form.network_name} onChangeText={(value) => update("network_name", value)} maxLength={180} /> : null}
        <Field label="CNPJ" value={form.cnpj} editable={false} style={styles.readOnlyField} />
        <View style={styles.registrationRow}><View style={styles.registrationField}><Field label="Inscrição estadual *" value={form.state_registration} onChangeText={(value) => update("state_registration", value.toUpperCase())} maxLength={40} /></View><Pressable accessibilityLabel="Marcar inscrição estadual como isento" accessibilityRole="button" onPress={() => update("state_registration", "ISENTO")} style={styles.exempt}><Text style={styles.exemptText}>ISENTO</Text></Pressable></View>
        <Field label="Inscrição municipal" value={form.municipal_registration} onChangeText={(value) => update("municipal_registration", value.toUpperCase())} maxLength={40} />
        <Text style={styles.innerTitle}>Endereço cadastral</Text>
        <Field label="Logradouro *" value={form.address} onChangeText={(value) => update("address", value)} maxLength={300} />
        <Field label="Número *" value={form.address_number} onChangeText={(value) => update("address_number", value)} maxLength={30} />
        <Field label="Bairro *" value={form.neighborhood} onChangeText={(value) => update("neighborhood", value)} maxLength={120} />
        <Field label="Cidade *" value={form.city} onChangeText={(value) => update("city", value)} maxLength={120} />
        <SelectField label="UF *" value={form.state} onChange={(value) => update("state", value)} options={states} searchable />
        <Field label="CEP *" value={form.zip_code} onChangeText={(value) => update("zip_code", maskZip(value))} keyboardType="number-pad" maxLength={9} placeholder="00000-000" />
        {isAdmin && !isResubmission ? <><Text style={styles.innerTitle}>Representantes responsáveis</Text><View style={styles.sellerList}>{sellers.map((seller) => <Pressable key={seller.id} accessibilityRole="checkbox" accessibilityState={{ checked: sellerIds.includes(seller.id) }} onPress={() => setSellerIds((current) => current.includes(seller.id) ? current.filter((id) => id !== seller.id) : [...current, seller.id])} style={[styles.seller, sellerIds.includes(seller.id) && styles.sellerActive]}><Text style={styles.sellerText}>{sellerIds.includes(seller.id) ? "✓ " : ""}{seller.name}</Text></Pressable>)}</View></> : null}
      </FormSection> : null}

      {step === 2 ? <FormSection title="Dados fiscais" subtitle="Informe o enquadramento tributário e eventuais benefícios fiscais do cliente.">
        <SelectField label="Regime fiscal *" value={form.tax_regime} onChange={(value) => update("tax_regime", value)} options={taxRegimes} />
        <SelectField label="Possui benefício fiscal? *" value={form.has_tax_benefit} onChange={changeTaxBenefit} options={yesNo} />
        {form.has_tax_benefit === "yes" ? <Field label="Qual benefício fiscal? *" value={form.tax_benefit} onChangeText={(value) => update("tax_benefit", value)} multiline maxLength={500} placeholder="Descreva o benefício fiscal do cliente" /> : null}
      </FormSection> : null}

      {step === 3 ? <>
        <FormSection title="Contato de compras" subtitle="Responsável pelos pedidos e negociações.">
          <Field label="Nome do responsável *" value={form.buyer_contact} onChangeText={(value) => update("buyer_contact", value)} maxLength={180} />
          <Field label="Telefone de compras 1 *" value={form.buyer_phone_1} onChangeText={(value) => update("buyer_phone_1", maskPhone(value))} keyboardType="phone-pad" maxLength={15} />
          <Field label="Telefone de compras 2" value={form.buyer_phone_2} onChangeText={(value) => update("buyer_phone_2", maskPhone(value))} keyboardType="phone-pad" maxLength={15} />
          <Field label="E-mail de compras *" value={form.buyer_email} onChangeText={(value) => update("buyer_email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        </FormSection>
        <FormSection title="Contato financeiro" subtitle="Responsável por boletos, pagamentos e assuntos financeiros.">
          <Field label="Nome do responsável *" value={form.finance_contact} onChangeText={(value) => update("finance_contact", value)} maxLength={180} />
          <Field label="Telefone financeiro 1 *" value={form.finance_phone_1} onChangeText={(value) => update("finance_phone_1", maskPhone(value))} keyboardType="phone-pad" maxLength={15} />
          <Field label="Telefone financeiro 2" value={form.finance_phone_2} onChangeText={(value) => update("finance_phone_2", maskPhone(value))} keyboardType="phone-pad" maxLength={15} />
          <Field label="E-mail financeiro *" value={form.finance_email} onChangeText={(value) => update("finance_email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        </FormSection>
        <FormSection title="Contato de logística" subtitle="Responsável pelo recebimento de mercadorias e documentos fiscais.">
          <Field label="Nome do responsável *" value={form.logistics_contact} onChangeText={(value) => update("logistics_contact", value)} maxLength={180} />
          <Field label="Telefone de logística 1 *" value={form.logistics_phone_1} onChangeText={(value) => update("logistics_phone_1", maskPhone(value))} keyboardType="phone-pad" maxLength={15} />
          <Field label="Telefone de logística 2" value={form.logistics_phone_2} onChangeText={(value) => update("logistics_phone_2", maskPhone(value))} keyboardType="phone-pad" maxLength={15} />
          <Field label="E-mail para envio de XML *" value={form.xml_email} onChangeText={(value) => update("xml_email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        </FormSection>
      </> : null}

      {step === 4 ? <FormSection title="Informações de entrega" subtitle="Defina o endereço, a forma de descarga e as condições de recebimento.">
        <SelectField label="Endereço de entrega *" value={form.delivery_address_type} onChange={changeAddressType} options={[{ value: "same", label: "Mesmo do cadastro" }, { value: "different", label: "Local diferente do cadastro" }]} />
        {form.delivery_address_type === "same" ? <Field label="Endereço utilizado" value={billingAddress(form)} editable={false} multiline style={styles.readOnlyField} /> : <View style={styles.nestedFields}>
          <Text style={styles.innerTitle}>Endereço de entrega</Text>
          <Field label="Logradouro *" value={form.delivery_street} onChangeText={(value) => update("delivery_street", value)} maxLength={300} />
          <Field label="Número *" value={form.delivery_number} onChangeText={(value) => update("delivery_number", value)} maxLength={30} />
          <Field label="Bairro *" value={form.delivery_neighborhood} onChangeText={(value) => update("delivery_neighborhood", value)} maxLength={120} />
          <Field label="Cidade *" value={form.delivery_city} onChangeText={(value) => update("delivery_city", value)} maxLength={120} />
          <SelectField label="UF *" value={form.delivery_state} onChange={(value) => update("delivery_state", value)} options={states} searchable />
          <Field label="CEP *" value={form.delivery_zip_code} onChangeText={(value) => update("delivery_zip_code", maskZip(value))} keyboardType="number-pad" maxLength={9} placeholder="00000-000" />
        </View>}
        <SelectField label="Descarga *" value={form.unloading_type} onChange={changeUnloadingType} options={[{ value: "scheduled", label: "Somente agendada" }, { value: "arrival", label: "Por ordem de chegada" }]} />
        {form.unloading_type === "scheduled" ? <Field label="Como fazer o agendamento? *" value={form.scheduling_instructions} onChangeText={(value) => update("scheduling_instructions", value)} multiline maxLength={500} placeholder="Informe contato, canal, antecedência e horários" /> : null}
        <SelectField label="Recebimento de mercadoria *" value={form.receiving_days} onChange={(value) => update("receiving_days", value)} options={receivingDays} />
        <SelectField label="Horário de recebimento *" value={form.receiving_hours} onChange={(value) => update("receiving_hours", value)} options={receivingHours} />
        <SelectField label="Tipo de carga *" value={form.load_type} onChange={(value) => update("load_type", value)} options={[{ value: "palletized", label: "Carga paletizada" }, { value: "loose", label: "Carga batida" }]} />
        <SelectField label="Ajudante de descarga *" value={form.unloading_helper} onChange={(value) => update("unloading_helper", value)} options={[{ value: "required", label: "Levar ajudante de descarga" }, { value: "not_required", label: "Não requer ajudante de descarga" }]} />
        <SelectField label="Cliente cobra descarga? *" value={form.unloading_charge} onChange={changeUnloadingCharge} options={[{ value: "charged", label: "Cliente cobra descarga" }, { value: "free", label: "Descarga gratuita" }]} />
        {form.unloading_charge === "charged" ? <View style={styles.nestedFields}>
          <Field label="Valor da descarga *" value={form.unloading_value} onChangeText={(value) => update("unloading_value", maskMoney(value))} keyboardType="number-pad" placeholder="R$ 0,00" maxLength={18} />
          <SelectField label="Pago por *" value={form.unloading_paid_by} onChange={(value) => update("unloading_paid_by", value)} options={[{ value: "pallet", label: "Palete" }, { value: "volume", label: "Volume" }, { value: "kg", label: "Kg" }]} />
        </View> : null}
        <Field label="Observações adicionais" value={form.notes} onChangeText={(value) => update("notes", value)} multiline maxLength={1000} />
      </FormSection> : null}

      {step === 5 ? <>
        <FormSection title="Dados básicos"><ReviewRow label="CNPJ" value={form.cnpj} /><ReviewRow label="Razão social" value={form.legal_name} /><ReviewRow label="Nome fantasia" value={form.trade_name} /><ReviewRow label="Rede" value={form.network_member === "yes" ? form.network_name : "Não pertence a uma rede"} /><ReviewRow label="Inscrição estadual" value={form.state_registration} />{form.municipal_registration ? <ReviewRow label="Inscrição municipal" value={form.municipal_registration} /> : null}<ReviewRow label="Endereço cadastral" value={billingAddress(form)} /></FormSection>
        <FormSection title="Dados fiscais"><ReviewRow label="Regime fiscal" value={optionLabel(taxRegimes, form.tax_regime)} /><ReviewRow label="Benefício fiscal" value={form.has_tax_benefit === "yes" ? form.tax_benefit : "Não possui"} /></FormSection>
        <FormSection title="Contatos"><ReviewRow label="Compras" value={[form.buyer_contact, form.buyer_phone_1, form.buyer_phone_2, form.buyer_email].filter(Boolean).join(" · ")} /><ReviewRow label="Financeiro" value={[form.finance_contact, form.finance_phone_1, form.finance_phone_2, form.finance_email].filter(Boolean).join(" · ")} /><ReviewRow label="Logística" value={[form.logistics_contact, form.logistics_phone_1, form.logistics_phone_2, form.xml_email].filter(Boolean).join(" · ")} /></FormSection>
        <FormSection title="Entrega"><ReviewRow label="Endereço de entrega" value={deliveryAddress(form)} /><ReviewRow label="Descarga" value={form.unloading_type === "scheduled" ? `Somente agendada · ${form.scheduling_instructions}` : "Por ordem de chegada"} /><ReviewRow label="Dias" value={optionLabel(receivingDays, form.receiving_days)} /><ReviewRow label="Horário" value={optionLabel(receivingHours, form.receiving_hours)} /><ReviewRow label="Tipo de carga" value={form.load_type === "palletized" ? "Carga paletizada" : "Carga batida"} /><ReviewRow label="Ajudante" value={form.unloading_helper === "required" ? "Levar ajudante de descarga" : "Não requer ajudante"} /><ReviewRow label="Cobrança de descarga" value={form.unloading_charge === "charged" ? `${form.unloading_value} por ${form.unloading_paid_by === "pallet" ? "palete" : form.unloading_paid_by === "volume" ? "volume" : "kg"}` : "Descarga gratuita"} /><ReviewRow label="Observações" value={form.notes} /></FormSection>
      </> : null}

      <View style={styles.navigation}>{step > 0 ? <Pressable accessibilityRole="button" onPress={() => { setError(""); setStep((current) => current - 1); }} style={styles.previous}><AppIcon name="arrow-back" color={colors.ink} size={18} /><Text style={styles.previousText}>Voltar</Text></Pressable> : <View />}{step < steps.length - 1 ? <Pressable accessibilityRole="button" onPress={next} style={styles.next}><Text style={styles.nextText}>Continuar</Text><AppIcon name="arrow-forward" color="#FFF" size={18} /></Pressable> : <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void submit()} style={[styles.next, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.nextText}>{isResubmission ? "Reenviar solicitação" : isAdministrativeEdit ? "Salvar alterações" : isAdmin ? "Cadastrar cliente" : "Enviar solicitação de cadastro"}</Text><AppIcon name="checkmark" color="#FFF" size={18} /></>}</Pressable>}</View>
    </ScrollView></KeyboardAvoidingView>
    <FeedbackDialog visible={Boolean(notice)} title="Consulta concluída" message={notice} tone="success" buttonLabel="Conferir dados" onClose={() => setNotice("")} />
    <FeedbackDialog visible={Boolean(error)} title="Revise o cadastro" message={error} tone="error" onClose={() => setError("")} />
    <FeedbackDialog visible={Boolean(success)} title={isResubmission ? "Solicitação reenviada" : isAdministrativeEdit ? "Cliente atualizado" : isAdmin ? "Cliente cadastrado" : "Solicitação enviada"} message={success} tone="success" onClose={() => { setSuccess(""); router.replace(isResubmission ? { pathname: "/(app)/customers", params: { status: "pending" } } : "/(app)/customers"); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas },
  loadingText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: colors.surface },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF3F7" },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 2 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  progressScroll: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  progress: { minWidth: "100%", flexDirection: "row", paddingHorizontal: 8, paddingVertical: 10 },
  progressItem: { width: 70, alignItems: "center", gap: 5 },
  progressDot: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#E6ECEF" },
  progressDotActive: { backgroundColor: colors.brand },
  progressNumber: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  progressNumberActive: { color: "#FFF" },
  progressLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  progressLabelActive: { color: colors.brandDark, fontWeight: "900" },
  content: { gap: 14, padding: 16, paddingBottom: 38 },
  lookup: { height: 50, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brand },
  lookupText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  verified: { flexDirection: "row", alignItems: "center", gap: 7 },
  verifiedText: { color: colors.success, fontSize: 12, fontWeight: "800" },
  registrationRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  registrationField: { flex: 1 },
  exempt: { height: 50, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EDF3F7" },
  exemptText: { color: colors.brandDark, fontSize: 10, fontWeight: "900" },
  innerTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 3 },
  sellerList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seller: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFF", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13 },
  sellerActive: { borderColor: colors.brand, backgroundColor: "#E9F3FF" },
  sellerText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  readOnlyField: { backgroundColor: "#EEF3F5", color: colors.muted },
  nestedFields: { gap: 15, borderLeftWidth: 3, borderLeftColor: colors.brand, paddingLeft: 13 },
  navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  previous: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 20, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  previousText: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  next: { minWidth: 145, maxWidth: "72%", minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 15, backgroundColor: colors.brand },
  nextText: { color: "#FFF", fontSize: 14, fontWeight: "900", textAlign: "center" },
  disabled: { opacity: 0.48 },
  reviewRow: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  reviewValue: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "700" },
});
