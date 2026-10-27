import * as Notifications from 'expo-notifications';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

import {
  connectOpenRouter,
  beginOpenRouterCopyCode,
  disconnectOpenRouter,
  finishOpenRouterCopyCode,
  isOpenRouterConnected,
  openOpenRouterKeySettings,
} from '@/infrastructure/openrouter';
import { prepareNotifications, reconcileNotifications } from '@/infrastructure/notifications';
import { colors } from '@/theme';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsScreen() {
  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyCodeVerifier, setCopyCodeVerifier] = useState<string | null>(null);
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<{ granted: boolean; canAskAgain: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setConnected(await isOpenRouterConnected());
    setFiles(await ExpoResourceFetcher.listDownloadedFiles());
    const permission = await Notifications.getPermissionsAsync();
    setNotificationPermission({ granted: permission.granted, canAskAgain: permission.canAskAgain });
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await operation();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The operation failed.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>REMINDER DELIVERY</Text>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.body}>
          Schedules are stored locally even when notifications are off. Permission is required for due-time alerts.
        </Text>
        <Text style={[styles.status, notificationPermission?.granted && styles.statusConnected]}>
          {notificationPermission?.granted ? '● Enabled' : '○ Not enabled'}
        </Text>
        {!notificationPermission?.granted ? (
          <Button
            label={notificationPermission?.canAskAgain === false ? 'Open system settings' : 'Enable notifications'}
            disabled={busy}
            onPress={() => void run(async () => {
              if (notificationPermission?.canAskAgain === false) await Linking.openSettings();
              else if (await prepareNotifications()) await reconcileNotifications();
            })}
          />
        ) : (
          <OutlineButton label="Open system settings" disabled={busy} onPress={() => void run(Linking.openSettings)} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>OPTIONAL REMOTE ENGINE</Text>
        <Text style={styles.title}>OpenRouter</Text>
        <Text style={styles.body}>
          Connect with OAuth PKCE. The user-controlled key is stored in the device keychain. Remote interpretation sends transcript text and context, never audio.
        </Text>
        <View style={styles.statusRow}>
          <Text style={[styles.status, connected && styles.statusConnected]}>
            {connected ? '● Connected' : '○ Not connected'}
          </Text>
          {busy && <ActivityIndicator color={colors.accent} />}
        </View>
        {!connected ? (
          <View style={styles.buttons}>
            <Button label="Connect OpenRouter" disabled={busy} onPress={() => void run(connectOpenRouter)} />
            <OutlineButton
              label="Use copy-code fallback"
              disabled={busy}
              onPress={() => void run(async () => setCopyCodeVerifier(await beginOpenRouterCopyCode()))}
            />
            {copyCodeVerifier && (
              <>
                <TextInput
                  accessibilityLabel="OpenRouter authorization code"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Paste the code OpenRouter showed"
                  placeholderTextColor="#8B918D"
                  value={authorizationCode}
                  onChangeText={setAuthorizationCode}
                  style={styles.input}
                />
                <Button
                  label="Exchange authorization code"
                  disabled={busy || !authorizationCode.trim()}
                  onPress={() => void run(async () => {
                    await finishOpenRouterCopyCode(authorizationCode, copyCodeVerifier);
                    setAuthorizationCode('');
                    setCopyCodeVerifier(null);
                  })}
                />
              </>
            )}
          </View>
        ) : (
          <View style={styles.buttons}>
            <Button
              label="Open key settings / revoke"
              disabled={busy}
              onPress={() => void run(openOpenRouterKeySettings)}
            />
            <OutlineButton
              label="Forget key on this device"
              disabled={busy}
              onPress={() => void run(disconnectOpenRouter)}
            />
          </View>
        )}
        <Text style={styles.finePrint}>
          To fully revoke access, use OpenRouter key settings. “Forget” only removes the local key. Set a credit limit in OpenRouter before remote testing.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>LOCAL MODEL STORAGE</Text>
        <Text style={styles.title}>{files.length} downloaded files</Text>
        <Text style={styles.body}>
          Model files are cached separately from reminders. Use “Remove models” on the main screen so native inference resources unload before files are deleted.
        </Text>
        {files.slice(0, 8).map((file) => (
          <Text key={file} numberOfLines={1} style={styles.file}>{file.split('/').pop()}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>VALIDATION SCOPE</Text>
        <Text style={styles.title}>Manual product</Text>
        <Text style={styles.body}>
          Reminders and events can be created, edited, completed, snoozed, paused, resumed, rescheduled, ended, and deleted without voice. Physical notification delivery, memory, battery, thermal, and Android qualification remain later hardening work.
        </Text>
        <Link href={'/voice-spike' as never} asChild>
          <Pressable accessibilityRole="button" style={styles.outlineButton}>
            <Text style={styles.outlineText}>Open voice technical spike</Text>
          </Pressable>
        </Link>
        <Text style={styles.finePrint}>The voice route preserves Milestone 1 engineering evidence. Its product UX will be replaced during Milestone 4.</Text>
      </View>

      {message && <Text style={styles.error}>{message}</Text>}
    </ScrollView>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function OutlineButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.outlineButton, disabled && styles.disabled]}>
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, gap: 12 },
  eyebrow: { color: colors.accentDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  finePrint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { color: colors.muted, fontWeight: '800' },
  statusConnected: { color: colors.green },
  buttons: { gap: 10 },
  button: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, paddingHorizontal: 18 },
  buttonText: { color: colors.white, fontWeight: '800', textAlign: 'center' },
  outlineButton: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 18 },
  outlineText: { color: colors.ink, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  file: { color: colors.muted, fontSize: 12, fontFamily: 'monospace' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, color: colors.ink },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12 },
});
