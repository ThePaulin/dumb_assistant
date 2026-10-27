import * as Notifications from 'expo-notifications';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  displayStatus,
  displayedOccurrenceTime,
  isOverdue,
  nextStoredOccurrence,
  scheduleSummary,
} from '@/application/schedule-presentation';
import { deviceTimeZone } from '@/domain/time';
import { cleanupExpiredDrafts, getDatabase } from '@/infrastructure/database';
import { prepareNotifications, reconcileNotifications } from '@/infrastructure/notifications';
import { completeStoredOccurrence, snoozeStoredOccurrence } from '@/infrastructure/schedule-repository';
import { listScheduleViews, type ScheduleView } from '@/infrastructure/schedule-views';
import { colors } from '@/theme';
import { AppButton, ButtonRow, Card, Notice, Screen, uiStyles } from '@/ui/components';

type PermissionState = { granted: boolean; canAskAgain: boolean };

function localDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatOccurrence(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function groupLabel(view: ScheduleView, nowUtc: string): 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'PAUSED & FINISHED' {
  const next = nextStoredOccurrence(view.occurrences);
  if (view.item.status !== 'active' || !next) return 'PAUSED & FINISHED';
  if (isOverdue(next, nowUtc)) return 'OVERDUE';
  if (localDateKey(displayedOccurrenceTime(next)) === localDateKey(nowUtc)) return 'TODAY';
  return 'UPCOMING';
}

function ItemRow({ view, busy, onComplete, onSnooze }: {
  view: ScheduleView;
  busy: boolean;
  onComplete: () => void;
  onSnooze: () => void;
}) {
  const router = useRouter();
  const next = nextStoredOccurrence(view.occurrences);
  const status = displayStatus(view.item, view.occurrences);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${view.item.title}. ${status}. ${next ? `Next ${formatOccurrence(displayedOccurrenceTime(next))}.` : 'No next occurrence.'}`}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: view.item.id } })}
        style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}
      >
        <View style={styles.itemHeading}>
          <View style={styles.kindPill}><Text style={styles.kindLabel}>{view.item.kind.toUpperCase()}</Text></View>
          <Text style={styles.status}>{status}</Text>
        </View>
        <Text style={styles.itemTitle}>{view.item.title}</Text>
        {next ? (
          <Text style={styles.nextText}>{displayedOccurrenceTime(next) < new Date().toISOString() ? 'Overdue · ' : ''}{formatOccurrence(displayedOccurrenceTime(next))}</Text>
        ) : <Text style={uiStyles.muted}>No next occurrence</Text>}
        <Text style={uiStyles.muted}>{scheduleSummary(view.item)}</Text>
        {view.hasNotificationFailure ? <Text style={styles.failure}>Notification registration needs attention</Text> : null}
      </Pressable>
      {next && view.item.kind === 'reminder' && view.item.status === 'active' ? (
        <ButtonRow>
          <AppButton label="Complete" disabled={busy} onPress={onComplete} accessibilityLabel={`Complete ${view.item.title}`} />
          <AppButton label="Snooze 10 min" variant="secondary" disabled={busy} onPress={onSnooze} accessibilityLabel={`Snooze ${view.item.title} for 10 minutes`} />
        </ButtonRow>
      ) : null}
    </Card>
  );
}

export default function HomeScreen() {
  const [views, setViews] = useState<ScheduleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const nowUtc = new Date().toISOString();

  const refresh = useCallback(async () => {
    try {
      await getDatabase();
      await cleanupExpiredDrafts();
      await reconcileNotifications();
      const [items, permissionResponse] = await Promise.all([
        listScheduleViews(),
        Notifications.getPermissionsAsync(),
      ]);
      setViews(items);
      setPermission({ granted: permissionResponse.granted, canAskAgain: permissionResponse.canAskAgain });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your schedules could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const groups = useMemo(() => {
    const labels = ['OVERDUE', 'TODAY', 'UPCOMING', 'PAUSED & FINISHED'] as const;
    return labels.map((label) => ({ label, rows: views.filter((view) => groupLabel(view, nowUtc) === label) })).filter((group) => group.rows.length);
  }, [nowUtc, views]);

  const act = useCallback(async (itemId: string, operation: () => Promise<void>) => {
    setBusyId(itemId);
    setError(null);
    try {
      await operation();
      await reconcileNotifications();
      setViews(await listScheduleViews());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const enableNotifications = async () => {
    try {
      if (permission?.canAskAgain === false) {
        await Linking.openSettings();
        return;
      }
      const granted = await prepareNotifications();
      const response = await Notifications.getPermissionsAsync();
      setPermission({ granted, canAskAgain: response.canAskAgain });
      if (granted) await reconcileNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notification permission could not be updated.');
    }
  };

  return (
    <Screen loading={loading} includeTopInset>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={uiStyles.eyebrow}>DUMB ASSISTANT</Text>
          <Text style={uiStyles.pageTitle}>Today & upcoming</Text>
          <Text style={uiStyles.body}>Your next commitment is always visible.</Text>
        </View>
        <View style={styles.headerActions}>
          <Link href="/settings" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Open settings" style={styles.roundButton}><Text style={styles.roundLabel}>•••</Text></Pressable>
          </Link>
          <Link href="/editor" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Create reminder or event" style={StyleSheet.flatten([styles.roundButton, styles.addButton])}><Text style={styles.addLabel}>＋</Text></Pressable>
          </Link>
        </View>
      </View>

      {permission && !permission.granted && !permissionDismissed ? (
        <Card tone="warning">
          <Text style={uiStyles.title}>Turn on notifications</Text>
          <Text style={uiStyles.body}>Schedules are saved locally either way. Notifications let the app alert you when an occurrence is due.</Text>
          <ButtonRow>
            <AppButton label={permission.canAskAgain ? 'Enable notifications' : 'Open system settings'} onPress={() => void enableNotifications()} />
            <AppButton label="Not now" variant="quiet" onPress={() => setPermissionDismissed(true)} />
          </ButtonRow>
        </Card>
      ) : null}

      {views.some((view) => view.hasNotificationFailure) ? (
        <Notice tone="error">Some reminders are saved but cannot notify you. Open an affected item after enabling notifications to retry registration.</Notice>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {views.length === 0 ? (
        <Card>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={uiStyles.title}>Nothing scheduled yet</Text>
          <Text style={uiStyles.body}>Create a one-time reminder, a flexible recurrence, or a basic event. Voice is never required.</Text>
          <Link href="/editor" asChild>
            <Pressable accessibilityRole="button" style={styles.emptyAction}><Text style={styles.emptyActionLabel}>Create your first item</Text></Pressable>
          </Link>
        </Card>
      ) : groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <Text style={styles.groupCount}>{group.rows.length}</Text>
          </View>
          {group.rows.map((view) => {
            const next = nextStoredOccurrence(view.occurrences);
            return (
              <ItemRow
                key={view.item.id}
                view={view}
                busy={busyId === view.item.id}
                onComplete={() => next && void act(view.item.id, () => completeStoredOccurrence(next.id, new Date().toISOString(), deviceTimeZone()))}
                onSnooze={() => next && void act(view.item.id, () => {
                  const now = new Date();
                  return snoozeStoredOccurrence(next.id, new Date(now.getTime() + 10 * 60_000).toISOString(), now.toISOString());
                })}
              />
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  headerCopy: { flex: 1, gap: 5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  roundButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { color: colors.ink, fontSize: 20 },
  addButton: { backgroundColor: colors.accent, borderColor: colors.accent },
  addLabel: { color: colors.white, fontSize: 27, lineHeight: 30 },
  group: { gap: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  groupTitle: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  groupCount: { color: colors.muted, backgroundColor: '#E8E3DA', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, fontWeight: '800' },
  itemMain: { gap: 6 },
  pressed: { opacity: 0.7 },
  itemHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  kindPill: { borderRadius: 999, backgroundColor: '#EFE5D7', paddingHorizontal: 8, paddingVertical: 4 },
  kindLabel: { color: colors.accentDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  status: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  itemTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  nextText: { color: colors.green, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  failure: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  emptyIcon: { color: colors.green, fontSize: 36, fontWeight: '900' },
  emptyAction: { minHeight: 50, borderRadius: 999, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyActionLabel: { color: colors.white, fontWeight: '900', fontSize: 16 },
});
