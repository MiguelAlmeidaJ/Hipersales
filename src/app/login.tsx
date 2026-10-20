import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { ActivityIndicator, Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordInput = useRef<TextInput>(null);
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";

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
    <ImageBackground source={require("../../assets/images/login.jpeg")} style={styles.background} resizeMode="cover">
      <StatusBar style="light" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Image source={require("../../assets/images/hipersales-logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.eyebrow}>HIPERMIX REPRESENTAÇÕES</Text>
              <Text style={styles.title}>Bem-vindo</Text>
              <Text style={styles.subtitle}>Gerencie sua operação comercial de onde estiver.</Text>
              <Text style={styles.label}>Usuário</Text>
              <TextInput
                accessibilityLabel="Usuário"
                autoCapitalize="none"
                autoComplete="username"
                editable={!busy}
                onChangeText={setUsername}
                onSubmitEditing={() => passwordInput.current?.focus()}
                placeholder="Seu usuário"
                placeholderTextColor="#94A3B8"
                returnKeyType="next"
                style={styles.input}
                value={username}
              />
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordField}>
                <TextInput
                  ref={passwordInput}
                  accessibilityLabel="Senha"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!busy}
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  placeholder="Sua senha"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="done"
                  secureTextEntry={!passwordVisible}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  style={styles.passwordToggle}>
                  <Text style={styles.passwordToggleText}>{passwordVisible ? "Ocultar" : "Mostrar"}</Text>
                </Pressable>
              </View>
              {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Entrar</Text>}
              </Pressable>
              <Text style={styles.version}>HiperSales • Beta • v{appVersion}</Text>
              {__DEV__ ? <Text numberOfLines={1} style={styles.apiHint}>API: {apiUrl}</Text> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.brandDark },
  overlay: { position: "absolute", inset: 0, backgroundColor: "rgba(2, 24, 58, 0.7)" },
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 18, paddingVertical: 20 },
  card: { width: "100%", maxWidth: 460, alignSelf: "center", borderRadius: 28, backgroundColor: "rgba(255,255,255,0.98)", paddingHorizontal: 24, paddingVertical: 22, shadowColor: "#001B44", shadowOpacity: 0.28, shadowRadius: 24, elevation: 12 },
  logo: { width: 176, height: 58, alignSelf: "center", marginBottom: 12 },
  eyebrow: { color: colors.brandDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "900", marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 3, marginBottom: 14 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 9 },
  input: { height: 52, borderWidth: 1, borderColor: "#CBD8E4", borderRadius: 14, backgroundColor: "#FFFFFF", color: colors.ink, fontSize: 16, paddingHorizontal: 16 },
  passwordField: { height: 52, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#CBD8E4", borderRadius: 14, backgroundColor: "#FFFFFF" },
  passwordInput: { flex: 1, height: "100%", color: colors.ink, fontSize: 16, paddingLeft: 16, paddingRight: 8 },
  passwordToggle: { height: "100%", justifyContent: "center", paddingHorizontal: 14 },
  passwordToggleText: { color: colors.brand, fontSize: 12, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
  button: { height: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brand, marginTop: 18 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.65 },
  version: { color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 12 },
  apiHint: { color: "#94A3B8", fontSize: 9, textAlign: "center", marginTop: 5 },
});
