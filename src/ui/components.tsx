import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';

export function Screen({ children, loading = false, includeTopInset = false }: { children: ReactNode; loading?: boolean; includeTopInset?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: includeTopInset ? insets.top + 20 : 20, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading…</Text></View> : children}
    </ScrollView>
  );
}

export function Card({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' | 'success' }) {
  return <View style={[styles.card, tone === 'warning' && styles.warningCard, tone === 'success' && styles.successCard]}>{children}</View>;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        variant === 'quiet' && styles.quietButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[
        styles.buttonLabel,
        variant === 'primary' && styles.primaryLabel,
        variant === 'danger' && styles.dangerLabel,
      ]}>{label}</Text>
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  help,
  multiline = false,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  help?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize !== 'none'}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7A837E"
        style={[styles.input, multiline && styles.multiline]}
        value={value}
      />
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

export function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label}: ${option.label}`}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <View style={styles.sectionHeading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.body}>{description}</Text> : null}
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'warning' }) {
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'text'} style={[styles.notice, tone === 'error' && styles.errorNotice, tone === 'warning' && styles.warningNotice]}>
      <Text style={[styles.noticeText, tone === 'error' && styles.errorText]}>{children}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  pageTitle: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  eyebrow: { color: colors.accentDark, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
});

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, gap: 16 },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: colors.muted, fontSize: 16 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  warningCard: { backgroundColor: '#FFF5DF', borderColor: '#E5C98F' },
  successCard: { backgroundColor: colors.greenSoft, borderColor: '#B6D5C8' },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  primaryButton: { backgroundColor: colors.accent },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  dangerButton: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#E9B4AB' },
  quietButton: { backgroundColor: 'transparent' },
  buttonLabel: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '800', textAlign: 'center' },
  primaryLabel: { color: colors.white },
  dangerLabel: { color: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  field: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 94, textAlignVertical: 'top' },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  segmentSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  segmentLabel: { color: colors.ink, fontWeight: '700' },
  segmentLabelSelected: { color: colors.white },
  sectionHeading: { gap: 5 },
  eyebrow: { color: colors.accentDark, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  notice: { backgroundColor: colors.greenSoft, padding: 13, borderRadius: 13 },
  warningNotice: { backgroundColor: '#FFF0CE' },
  errorNotice: { backgroundColor: colors.dangerSoft },
  noticeText: { color: colors.green, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  errorText: { color: colors.danger },
});
