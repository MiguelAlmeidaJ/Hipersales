import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Field, FormSection } from "@/components/form-controls";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";
import { digitsOnly, formatCnpj } from "@/lib/format";

type CustomerForm = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const initial: CustomerForm = { legalName: "", tradeName: "", cnpj: "", stateRegistration: "", contactPerson: "", phone: "", email: "", address: "", notes: "" };

export default function NewCustomerScreen() {
  const { status, user } = useSession();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "admin";
  const title = isAdmin ? "Cadastrar cliente" : "Solicitar cliente";
  const valid = useMemo(() => Boolean(form.legalName.trim() && digitsOnly(form.cnpj).length === 14 && (isAdmin || (form.contactPerson.trim() && digitsOnly(form.phone).length >= 10))), [form, isAdmin]);

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (status === "loading") return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Preparando cadastro…</Text></SafeAreaView>;

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (!valid) {
      setError(isAdmin ? "Informe razão social e um CNPJ válido." : "Informe razão social, CNPJ, contato e telefone com DDD.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const common = {
        legal_name: form.legalName.trim(), trade_name: form.tradeName.trim(), cnpj: form.cnpj,
        state_registration: form.stateRegistration.trim(), address: form.address.trim(), notes: form.notes.trim(),
      };
      const payload = isAdmin
        ? { ...common, phone: form.phone.trim(), email: form.email.trim(), active: true }
        : { ...common, contact_person: form.contactPerson.trim(), phone_1: form.phone.trim(), purchase_email: form.email.trim() };
      const result = await api<{ id: number; message?: string }>(isAdmin ? "/api/admin/customers" : "/api/customer-requests", {
        method: "POST", body: JSON.stringify(payload), timeoutMs: 30_000,
      });
      Alert.alert(isAdmin ? "Cliente cadastrado" : "Solicitação enviada", result.message || "Operação concluída.", [
        { text: "OK", onPress: () => router.replace("/(app)/customers") },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}><Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>CARTEIRA</Text><Text style={styles.title}>{title}</Text></View></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <FormSection title="Identificação" subtitle={isAdmin ? "O cliente será disponibilizado imediatamente." : "A solicitação seguirá para validação do back office."}>
            <Field label="Razão social *" value={form.legalName} onChangeText={(value) => update("legalName", value)} autoCapitalize="words" maxLength={240} />
            <Field label="Nome fantasia" value={form.tradeName} onChangeText={(value) => update("tradeName", value)} autoCapitalize="words" maxLength={240} />
            <Field label="CNPJ *" value={form.cnpj} onChangeText={(value) => update("cnpj", formatCnpj(value))} keyboardType="number-pad" maxLength={18} hint="Digite os 14 números do CNPJ." />
            <Field label="Inscrição estadual" value={form.stateRegistration} onChangeText={(value) => update("stateRegistration", value)} maxLength={40} />
          </FormSection>
          <FormSection title="Contato" subtitle="Dados utilizados pela equipe comercial.">
            {!isAdmin ? <Field label="Pessoa de contato *" value={form.contactPerson} onChangeText={(value) => update("contactPerson", value)} autoCapitalize="words" maxLength={180} /> : null}
            <Field label={isAdmin ? "Telefone" : "Telefone com DDD *"} value={form.phone} onChangeText={(value) => update("phone", value)} keyboardType="phone-pad" maxLength={24} />
            <Field label="E-mail de compras" value={form.email} onChangeText={(value) => update("email", value.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
          </FormSection>
          <FormSection title="Localização e observações">
            <Field label="Endereço" value={form.address} onChangeText={(value) => update("address", value)} multiline maxLength={500} />
            <Field label="Observações" value={form.notes} onChangeText={(value) => update("notes", value)} multiline maxLength={1000} />
          </FormSection>
          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
          <Pressable accessibilityRole="button" disabled={busy || !valid} onPress={submit} style={[styles.submit, (busy || !valid) && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{isAdmin ? "Cadastrar cliente" : "Enviar solicitação"}</Text>}</Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas }, loadingText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF3F7" }, backText: { color: colors.ink, fontSize: 31, lineHeight: 33 },
  headerCopy: { flex: 1 }, eyebrow: { color: colors.brandDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 2 },
  content: { gap: 14, padding: 16, paddingBottom: 38 },
  errorCard: { borderRadius: 13, backgroundColor: "#FDECEC", padding: 14 }, errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  submit: { height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, marginTop: 3 }, disabled: { opacity: 0.48 }, submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
