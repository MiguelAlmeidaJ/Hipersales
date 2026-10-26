import { useMemo, useState, type ReactNode } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
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
        <View style={styles.selectIcon}><AppIcon name="options-outline" color={selected ? colors.brand : "#91A0AF"} size={18} /></View>
        <Text numberOfLines={1} style={[styles.selectText, !selected && styles.placeholder]}>{selected?.label || placeholder}</Text><AppIcon name="chevron-down" color={colors.muted} size={18} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal transparent visible={open} animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Fechar opções" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.modal} edges={["bottom"]}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>SELECIONAR</Text><Text style={styles.modalTitle}>{label.replace(/\s*\*$/, "")}</Text><Text style={styles.modalCount}>{options.length} {options.length === 1 ? "opção disponível" : "opções disponíveis"}</Text></View><Pressable accessibilityLabel="Fechar opções" accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}><AppIcon name="close" color={colors.ink} size={23} /></Pressable></View>
          {searchable ? <View style={styles.searchWrap}><AppIcon name="search" color={colors.muted} size={20} /><TextInput accessibilityLabel={`Buscar em ${label}`} autoFocus autoCapitalize="none" onChangeText={setQuery} placeholder="Buscar por nome ou código" placeholderTextColor="#91A0AF" style={styles.search} value={query} />{query ? <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery("")}><AppIcon name="close-circle" color="#91A0AF" size={20} /></Pressable> : null}</View> : null}
          <FlatList data={visible} keyboardShouldPersistTaps="handled" keyExtractor={(item) => item.value} contentContainerStyle={styles.optionList} ListEmptyComponent={<View style={styles.emptyState}><View style={styles.emptyIcon}><AppIcon name="search-outline" color={colors.muted} size={26} /></View><Text style={styles.emptyTitle}>Nenhuma opção encontrada</Text><Text style={styles.empty}>Tente outro termo ou volte para conferir os filtros anteriores.</Text></View>} renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: item.value === value }} onPress={() => { onChange(item.value); setQuery(""); setOpen(false); }} style={[styles.option, item.value === value && styles.optionActive]}>
              <View style={[styles.radio, item.value === value && styles.radioActive]}>{item.value === value ? <View style={styles.radioDot} /> : null}</View><View style={styles.optionCopy}><Text style={[styles.optionLabel, item.value === value && styles.optionLabelActive]}>{item.label}</Text>{item.detail ? <Text style={styles.optionDetail}>{item.detail}</Text> : null}</View>{item.value === value ? <AppIcon name="checkmark-circle" color={colors.brand} size={22} /> : null}
            </Pressable>
          )} />
          </SafeAreaView>
        </View>
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
  select: { minHeight: 54, flexDirection: "row", alignItems: "center", borderRadius: 15, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: colors.surface, paddingHorizontal: 12 },
  selectIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#EFF5F7", marginRight: 10 },
  disabled: { opacity: 0.5 },
  selectText: { flex: 1, color: colors.ink, fontSize: 15 },
  placeholder: { color: "#91A0AF" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,25,28,0.58)" },
  modal: { maxHeight: "86%", minHeight: "46%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.canvas, overflow: "hidden" },
  handle: { width: 44, height: 5, alignSelf: "center", borderRadius: 3, backgroundColor: "#C4D0D0", marginTop: 10 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 15, paddingBottom: 13 },
  modalEyebrow: { color: colors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  modalTitle: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 2 },
  modalCount: { color: colors.muted, fontSize: 11, marginTop: 3 },
  close: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E8EFF2" },
  searchWrap: { height: 52, flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 7, borderRadius: 15, borderWidth: 1, borderColor: "#C9D7E4", backgroundColor: colors.surface, paddingHorizontal: 14 },
  search: { flex: 1, height: "100%", color: colors.ink, fontSize: 14 },
  optionList: { flexGrow: 1, padding: 16, paddingTop: 8, paddingBottom: 30 },
  option: { minHeight: 66, flexDirection: "row", alignItems: "center", borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 9 },
  optionActive: { borderColor: colors.brand, backgroundColor: "#EDF6FC" },
  optionCopy: { flex: 1 },
  radio: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 2, borderColor: "#BCCACA", marginRight: 12 },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  optionLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  optionLabelActive: { color: colors.brandDark },
  optionDetail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  emptyState: { alignItems: "center", paddingHorizontal: 30, paddingVertical: 48 },
  emptyIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#E8EFF2" },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", textAlign: "center", marginTop: 14 },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5 },
  section: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionBody: { gap: 15, marginTop: 18 },
});
