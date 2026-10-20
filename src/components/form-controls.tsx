import { useMemo, useState, type ReactNode } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";

export type SelectOption = { label: string; value: string; detail?: string };

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={props.accessibilityLabel || label} placeholderTextColor="#91A0AF" {...props} style={[styles.input, props.multiline && styles.multiline, error && styles.inputError, props.style]} />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SelectField({ label, value, placeholder = "Selecione", options, onChange, searchable = false, disabled = false, error }: {
  label: string;
  value: string;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term ? options.filter((option) => `${option.label} ${option.detail || ""}`.toLocaleLowerCase("pt-BR").includes(term)) : options;
  }, [options, query]);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => setOpen(true)} style={[styles.select, disabled && styles.disabled, error && styles.inputError]}>
        <Text numberOfLines={1} style={[styles.selectText, !selected && styles.placeholder]}>{selected?.label || placeholder}</Text><Text style={styles.arrow}>⌄</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>{label}</Text><Pressable accessibilityLabel="Fechar opções" accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
          {searchable ? <TextInput accessibilityLabel={`Buscar em ${label}`} autoFocus autoCapitalize="none" onChangeText={setQuery} placeholder="Buscar…" placeholderTextColor="#91A0AF" style={styles.search} value={query} /> : null}
          <FlatList data={visible} keyExtractor={(item) => item.value} contentContainerStyle={styles.optionList} ListEmptyComponent={<Text style={styles.empty}>Nenhuma opção encontrada.</Text>} renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: item.value === value }} onPress={() => { onChange(item.value); setQuery(""); setOpen(false); }} style={[styles.option, item.value === value && styles.optionActive]}>
              <View style={styles.optionCopy}><Text style={[styles.optionLabel, item.value === value && styles.optionLabelActive]}>{item.label}</Text>{item.detail ? <Text style={styles.optionDetail}>{item.detail}</Text> : null}</View>{item.value === value ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          )} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function FormSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}<View style={styles.sectionBody}>{children}</View></View>;
}

const styles = StyleSheet.create({
  fieldWrap: { gap: 7 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: colors.surface, color: colors.ink, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11 },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  select: { minHeight: 50, flexDirection: "row", alignItems: "center", borderRadius: 13, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: colors.surface, paddingHorizontal: 14 },
  disabled: { opacity: 0.5 },
  selectText: { flex: 1, color: colors.ink, fontSize: 15 },
  placeholder: { color: "#91A0AF" },
  arrow: { color: colors.muted, fontSize: 19, marginLeft: 8 },
  modal: { flex: 1, backgroundColor: colors.canvas },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3F7" },
  closeText: { color: colors.ink, fontSize: 27, lineHeight: 29 },
  search: { height: 48, margin: 16, marginBottom: 4, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: 14 },
  optionList: { padding: 16, paddingBottom: 30 },
  option: { minHeight: 58, flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 13, marginBottom: 8 },
  optionActive: { borderColor: colors.brand, backgroundColor: "#EDF6FC" },
  optionCopy: { flex: 1 },
  optionLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  optionLabelActive: { color: colors.brandDark },
  optionDetail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  check: { color: colors.brand, fontSize: 18, fontWeight: "900", marginLeft: 10 },
  empty: { color: colors.muted, textAlign: "center", padding: 30 },
  section: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionBody: { gap: 15, marginTop: 18 },
});
