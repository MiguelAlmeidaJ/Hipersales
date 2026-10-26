import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";

export default function ChangePasswordScreen() {
  const { status, user, refresh, logout } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "anonymous") return <Redirect href="/login" />;

  async function submit() {
    if (newPassword.length < 12) return setError("A nova senha precisa ter pelo menos 12 caracteres.");
    if (newPassword !== confirmation) return setError("A confirmação não corresponde à nova senha.");
    setBusy(true);
    setError("");
    try {
      await api<{ message?: string }>("/api/me/password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      await refresh();
      router.replace("/(app)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>SEGURANÇA</Text>
          <Text style={styles.title}>{user?.must_change_password ? "Crie sua nova senha" : "Alterar senha"}</Text>
          <Text style={styles.subtitle}>Use ao menos 12 caracteres. Sua nova senha deve ser diferente da atual.</Text>
          {!user?.must_change_password ? <><Text style={styles.label}>Senha atual</Text><TextInput secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} style={styles.input} /></> : null}
          <Text style={styles.label}>Nova senha</Text><TextInput secureTextEntry value={newPassword} onChangeText={setNewPassword} style={styles.input} />
          <Text style={styles.label}>Confirme a nova senha</Text><TextInput secureTextEntry value={confirmation} onChangeText={setConfirmation} onSubmitEditing={submit} style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable disabled={busy} onPress={submit} style={styles.button}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Salvar nova senha</Text>}</Pressable>
          <Pressable onPress={logout} style={styles.cancel}><Text style={styles.cancelText}>Sair da conta</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, justifyContent: "center", padding: 20 },
  card: { padding: 24, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  eyebrow: { color: colors.brandDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "900", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 15 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700", marginTop: 13, marginBottom: 7 },
  input: { height: 50, borderRadius: 13, borderWidth: 1, borderColor: "#CBD8E4", paddingHorizontal: 15, fontSize: 16, color: colors.ink },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 13 },
  button: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, marginTop: 20 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  cancel: { alignItems: "center", padding: 13, marginTop: 5 },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
});
