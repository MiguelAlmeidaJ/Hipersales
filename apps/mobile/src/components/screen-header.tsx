import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";

export function ScreenHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  eyebrow: { color: colors.brandDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 26, fontWeight: "900", marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
});
