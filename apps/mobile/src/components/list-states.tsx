import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return <View style={styles.state}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.text}>{label}</Text></View>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <View style={styles.card}><Text style={styles.title}>{title}</Text><Text style={styles.text}>{description}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={[styles.card, styles.errorCard]}><Text style={styles.errorTitle}>Não foi possível carregar</Text><Text style={styles.text}>{message}</Text><Pressable onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>Tentar novamente</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  state: { alignItems: "center", padding: 32, gap: 12 },
  card: { alignItems: "center", margin: 20, padding: 24, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  errorCard: { borderColor: "#F1CACA" },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  errorTitle: { color: colors.danger, fontSize: 17, fontWeight: "800", textAlign: "center" },
  text: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 5 },
  button: { borderRadius: 12, backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16 },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
