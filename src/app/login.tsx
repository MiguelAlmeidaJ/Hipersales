import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { AppIcon } from "@/components/app-icon";
import { useSession } from "@/contexts/session-context";
import { useMockApi } from "@/lib/api";

export default function LoginScreen() {
  const { status, user, login } = useSession();
  const [username, setUsername] = useState(useMockApi ? "demo" : "");
  const [password, setPassword] = useState(useMockApi ? "demo123" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const passwordInput = useRef<TextInput>(null);
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (status === "authenticated") return <Redirect href={user?.must_change_password ? "/change-password" : "/(app)"} />;

  async function submit() {
    if (!username.trim() || !password) { setError("Informe usuário e senha."); return; }
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password, keepConnected);
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao entrar.");
    } finally { setPassword(""); setBusy(false); }
  }

  return (
    <ImageBackground source={require("../../assets/images/login-background.png")} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView automaticallyAdjustKeyboardInsets={Platform.OS === "ios"} contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={keyboardOpen}>
            <View style={styles.card}>
              <Image accessibilityLabel="HiperSales Software" source={require("../../assets/images/hipersales-logo.png")} style={styles.logoImage} resizeMode="contain" />
              <Text style={styles.eyebrow}>SUA OPERAÇÃO COMERCIAL, CONECTADA</Text>
              <Text style={styles.title}>Bem-vindo</Text>
              <Text style={styles.subtitle}>Sua gestão comercial em um só lugar.</Text>
              {useMockApi ? <View style={styles.mockBadge}><AppIcon name="flask-outline" color={colors.accent} size={16} /><Text style={styles.mockBadgeText}>AMBIENTE DE DEMONSTRAÇÃO</Text></View> : null}
              <Text style={styles.label}>Usuário</Text>
              <TextInput accessibilityLabel="Usuário" autoCapitalize="none" autoComplete="username" editable={!busy}
                onChangeText={setUsername} onSubmitEditing={() => passwordInput.current?.focus()}
                placeholder="Seu usuário" placeholderTextColor="#7D8F90" returnKeyType="next" style={styles.input} value={username} />
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordField}>
                <TextInput ref={passwordInput} accessibilityLabel="Senha" autoCapitalize="none" autoComplete="current-password"
                  editable={!busy} onChangeText={setPassword} onSubmitEditing={submit}
                  placeholder="Sua senha" placeholderTextColor="#7D8F90" returnKeyType="done"
                  secureTextEntry={!passwordVisible} style={styles.passwordInput} value={password} />
                <Pressable accessibilityLabel={passwordVisible ? "Ocultar senha" : "Mostrar senha"} accessibilityRole="button"
                  hitSlop={8} onPress={() => setPasswordVisible((visible) => !visible)} style={styles.passwordToggle}>
                  <Text style={styles.passwordToggleText}>{passwordVisible ? "Ocultar" : "Mostrar"}</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: keepConnected }} onPress={() => setKeepConnected((value) => !value)} style={styles.rememberRow}>
                <View style={[styles.checkbox, keepConnected && styles.checkboxChecked]}>{keepConnected ? <AppIcon name="checkmark" color="#FFFFFF" size={16} /> : null}</View>
                <View style={styles.rememberCopy}><Text style={styles.rememberTitle}>Manter conectado</Text><Text style={styles.rememberHint}>Salva esta sessão com segurança neste aparelho.</Text></View>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={submit}
                style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color={colors.brandDark} /> : <Text style={styles.buttonText}>Entrar</Text>}
              </Pressable>
              <Text style={styles.version}>HiperSales • Beta • v{appVersion}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <FeedbackDialog visible={Boolean(error)} title="Não foi possível entrar" message={error} tone="error" onClose={() => setError("")} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.brandDark },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0, 22, 24, 0.30)" },
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 16 },
  card: { width: "100%", maxWidth: 440, alignSelf: "center", borderRadius: 28, backgroundColor: "rgba(3,34,37,0.97)", paddingHorizontal: 24, paddingVertical: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.19)", shadowColor: "#00191B", shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  logoImage: { width: "100%", height: 74, alignSelf: "center", marginBottom: 18 },
  wordmark: { marginLeft: 2 },
  wordmarkText: { fontSize: 31, fontWeight: "800", color: "#FFF3E7", letterSpacing: -1.6 },
  software: { textAlign: "right", color: "#FFF3E7", fontSize: 10, letterSpacing: 1.0, marginTop: -2 },
  eyebrow: { color: "#B2C3C0", fontSize: 10, fontWeight: "700", letterSpacing: 1.1, textAlign: "center", marginBottom: 20 },
  title: { color: "#FFF3E7", fontSize: 29, lineHeight: 36, fontWeight: "800" },
  subtitle: { color: "#B2C3C0", fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 17 },
  mockBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, backgroundColor: "rgba(255,149,30,0.13)", paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 },
  mockBadgeText: { color: colors.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  label: { color: "#FFF3E7", fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 9 },
  input: { height: 53, borderWidth: 1, borderColor: "#CCD9D5", borderRadius: 13, backgroundColor: "#FFFFFF", color: colors.ink, fontSize: 16, paddingHorizontal: 16 },
  passwordField: { height: 53, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#CCD9D5", borderRadius: 13, backgroundColor: "#FFFFFF" },
  passwordInput: { flex: 1, height: "100%", color: colors.ink, fontSize: 16, paddingLeft: 16, paddingRight: 8 },
  passwordToggle: { height: "100%", justifyContent: "center", paddingHorizontal: 14 },
  passwordToggleText: { color: "#07525A", fontSize: 12, fontWeight: "800" },
  rememberRow: { flexDirection: "row", alignItems: "center", marginTop: 15 },
  checkbox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1.5, borderColor: "#8FA7A5", backgroundColor: "rgba(255,255,255,0.08)" },
  checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  rememberCopy: { flex: 1, marginLeft: 10 },
  rememberTitle: { color: "#FFF3E7", fontSize: 13, fontWeight: "800" },
  rememberHint: { color: "#9FB5B3", fontSize: 10, lineHeight: 14, marginTop: 2 },
  button: { height: 53, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.accent, marginTop: 20 },
  buttonText: { color: colors.brandDark, fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.65 },
  version: { color: "#B2C3C0", fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 16 },
});
