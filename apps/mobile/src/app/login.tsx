import { Image, ImageBackground } from "expo-image";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { apiUrl } from "@/lib/api";

export default function LoginScreen() {
  const { status, user, login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "authenticated") {
    return <Redirect href={user?.must_change_password ? "/change-password" : "/(app)"} />;
  }

  async function submit() {
    if (!username.trim() || !password) {
      setError("Informe usuário e senha.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao entrar.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <ImageBackground source={require("../../assets/images/login.jpeg")} style={styles.background} contentFit="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.card}>
            <Image source={require("../../assets/images/hipersales-logo.png")} style={styles.logo} contentFit="contain" />
            <Text style={styles.eyebrow}>HIPERMIX REPRESENTAÇÕES</Text>
            <Text style={styles.title}>Bem-vindo</Text>
            <Text style={styles.subtitle}>Acesse sua operação comercial de onde estiver.</Text>
            <Text style={styles.label}>Usuário</Text>
            <TextInput autoCapitalize="none" autoComplete="username" editable={!busy} onChangeText={setUsername} placeholder="Seu usuário" placeholderTextColor="#94A3B8" returnKeyType="next" style={styles.input} value={username} />
            <Text style={styles.label}>Senha</Text>
            <TextInput autoCapitalize="none" autoComplete="current-password" editable={!busy} onChangeText={setPassword} onSubmitEditing={submit} placeholder="Sua senha" placeholderTextColor="#94A3B8" returnKeyType="done" secureTextEntry style={styles.input} value={password} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Entrar</Text>}
            </Pressable>
            {__DEV__ ? <Text style={styles.apiHint}>API: {apiUrl}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.brandDark },
  overlay: { position: "absolute", inset: 0, backgroundColor: "rgba(3, 27, 66, 0.62)" },
  safeArea: { flex: 1 },
  keyboard: { flex: 1, justifyContent: "flex-end", padding: 20 },
  card: { borderRadius: 28, backgroundColor: "rgba(255,255,255,0.97)", padding: 24, shadowColor: "#001B44", shadowOpacity: 0.25, shadowRadius: 24, elevation: 10 },
  logo: { width: 190, height: 68, alignSelf: "center", marginBottom: 16 },
  eyebrow: { color: colors.brandDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 4, marginBottom: 22 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 10 },
  input: { height: 52, borderWidth: 1, borderColor: "#CBD8E4", borderRadius: 14, backgroundColor: "#FFFFFF", color: colors.ink, fontSize: 16, paddingHorizontal: 16 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
  button: { height: 54, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brand, marginTop: 20 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.65 },
  apiHint: { color: "#94A3B8", fontSize: 10, textAlign: "center", marginTop: 14 },
});
