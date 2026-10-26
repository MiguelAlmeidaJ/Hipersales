import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { colors } from "@/constants/colors";

type Tone = "error" | "success" | "info";

const toneConfig: Record<Tone, { icon: AppIconName; color: string; background: string }> = {
  error: { icon: "alert-circle-outline", color: colors.danger, background: "#FDEBEC" },
  success: { icon: "checkmark-circle-outline", color: colors.success, background: "#E7F7F0" },
  info: { icon: "information-circle-outline", color: colors.brand, background: "#E8F3FB" },
};

export function FeedbackDialog({ visible, title, message, tone = "info", buttonLabel = "OK", onClose }: {
  visible: boolean;
  title: string;
  message: string;
  tone?: Tone;
  buttonLabel?: string;
  onClose: () => void;
}) {
  const config = toneConfig[tone];
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.dialog}>
          <View style={[styles.icon, { backgroundColor: config.background }]}><AppIcon name={config.icon} color={config.color} size={30} /></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>{buttonLabel}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,25,28,0.68)" },
  dialog: { width: "100%", maxWidth: 380, alignItems: "center", borderRadius: 26, backgroundColor: colors.surface, padding: 24, shadowColor: "#00191B", shadowOpacity: 0.3, shadowRadius: 22, elevation: 12 },
  icon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900", textAlign: "center", marginTop: 17 },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  button: { width: "100%", height: 52, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.brand, marginTop: 23 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.82 },
});
