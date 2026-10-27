import { Temporal } from '@js-temporal/polyfill';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { displayStatus, displayedOccurrenceTime, nextStoredOccurrence, scheduleSummary } from '@/application/schedule-presentation';
import { deviceTimeZone, localDateTimeToInstant } from '@/domain/time';
import { cancelNotification, reconcileNotifications } from '@/infrastructure/notifications';
import {
  completeStoredOccurrence,
  deleteScheduledItem,
  pauseScheduledItem,
  rescheduleStoredOccurrence,
  resumeScheduledItem,
  snoozeStoredOccurrence,
  stopScheduledItem,
} from '@/infrastructure/schedule-repository';
import { getScheduleView, type ScheduleView } from '@/infrastructure/schedule-views';
import { colors } from '@/theme';
import { AppButton, ButtonRow, Card, Field, Notice, Screen, SectionTitle, uiStyles } from '@/ui/components';

const HORIZON_HOURS = 24 * 370;

function formatInstant(value: string, zone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(value));
}

function historyLabel(status: string): string {
  if (status === 'completed') return 'Completed';
  if (status === 'missed') return 'Missed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Scheduled';
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const itemId = typeof id === 'string' ? id : '';
  const [view, setView] = useState<ScheduleView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const refresh = useCallback(async () => {
    try {
      const nextView = await getScheduleView(itemId);
      setView(nextView);
      const upcoming = nextStoredOccurrence(nextView.occurrences);
      if (upcoming) {
        const [date = '', time = ''] = upcoming.scheduledLocal.split('T');
        setRescheduleDate(date);
        setRescheduleTime(time.slice(0, 5));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The item could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const next = useMemo(() => view ? nextStoredOccurrence(view.occurrences) : null, [view]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await reconcileNotifications();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  if (!view) {
    return <Screen loading={loading}>{error ? <Notice tone="error">{error}</Notice> : null}</Screen>;
  }

  const status = displayStatus(view.item, view.occurrences);
  const complete = () => next && run(() => completeStoredOccurrence(next.id, new Date().toISOString(), deviceTimeZone()));
  const snooze = (minutes: number) => next && run(() => {
    const now = Temporal.Now.instant();
    return snoozeStoredOccurrence(next.id, now.add({ minutes }).toString({ smallestUnit: 'millisecond' }), now.toString({ smallestUnit: 'millisecond' }));
  });
  const reschedule = () => next && run(async () => {
    const local = `${rescheduleDate}T${rescheduleTime}:00`;
    const utc = localDateTimeToInstant(local, next.effectiveTimeZone);
    if (Temporal.Instant.compare(Temporal.Instant.from(utc), Temporal.Now.instant()) <= 0) throw new Error('The rescheduled time must be in the future.');
    await rescheduleStoredOccurrence(next.id, utc, local, next.effectiveTimeZone, new Date().toISOString());
  });

  const confirmDelete = () => Alert.alert(
    `Delete “${view.item.title}”?`,
    'This removes its schedule and local history. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => void (async () => {
          setBusy(true);
          try {
            const identifiers = await deleteScheduledItem(view.item.id);
            await Promise.all(identifiers.map(cancelNotification));
            router.replace('/');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The item could not be deleted.');
            setBusy(false);
          }
        })(),
      },
    ],
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: view.item.kind === 'event' ? 'Event details' : 'Reminder details' }} />
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={uiStyles.eyebrow}>{view.item.kind.toUpperCase()}</Text>
          <Text style={uiStyles.pageTitle}>{view.item.title}</Text>
        </View>
        <Link href={{ pathname: '/editor', params: { id: view.item.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${view.item.title}`} style={styles.editButton}>
            <Text style={styles.editLabel}>Edit</Text>
          </Pressable>
        </Link>
      </View>

      <View style={[styles.statusPill, status === 'Paused' && styles.pausedPill, (status === 'Ended' || status === 'Completed') && styles.endedPill]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {view.hasNotificationFailure ? (
        <Notice tone="error">This item is saved, but at least one notification could not be registered. Check notification permission and try again.</Notice>
      ) : null}

      <Card tone={next ? 'success' : 'default'}>
        <Text style={uiStyles.eyebrow}>NEXT OCCURRENCE</Text>
        {next ? (
          <>
            <Text style={uiStyles.title}>{formatInstant(displayedOccurrenceTime(next), next.effectiveTimeZone)}</Text>
            {next.snoozedUntilUtc ? <Text style={uiStyles.body}>Snoozed from {formatInstant(next.scheduledAtUtc, next.effectiveTimeZone)}</Text> : null}
            {view.item.status === 'paused' ? <Text style={uiStyles.body}>Notifications resume when this item is resumed.</Text> : null}
          </>
        ) : (
          <Text style={uiStyles.body}>{status === 'Completed' ? 'This reminder was completed.' : 'No further occurrence is scheduled.'}</Text>
        )}
      </Card>

      <Card>
        <SectionTitle title="Schedule" />
        <Text style={uiStyles.body}>{scheduleSummary(view.item)}</Text>
        <Text style={uiStyles.muted}>Starts {view.item.schedule.startLocal.replace('T', ' ')} · {view.item.schedule.timeZonePolicy === 'follow_device' ? 'follows device time' : view.item.schedule.timeZone}</Text>
        {view.item.notes ? <Text style={uiStyles.body}>{view.item.notes}</Text> : null}
        {view.item.event ? (
          <>
            <Text style={uiStyles.muted}>Duration: {view.item.event.durationMinutes} minutes</Text>
            {view.item.event.location ? <Text style={uiStyles.muted}>Location: {view.item.event.location}</Text> : null}
            <Text style={uiStyles.muted}>Alerts: {view.item.event.alertOffsetsMinutes.length ? view.item.event.alertOffsetsMinutes.map((value) => value === 0 ? 'at start' : `${value} min before`).join(', ') : 'none'}</Text>
          </>
        ) : null}
      </Card>

      {next && view.item.kind === 'reminder' && view.item.status === 'active' ? (
        <Card>
          <SectionTitle title="Do it now" />
          <ButtonRow>
            <AppButton label="Complete" onPress={() => void complete()} disabled={busy} accessibilityLabel={`Complete ${view.item.title}`} />
            <AppButton label="Snooze 10 min" variant="secondary" onPress={() => void snooze(10)} disabled={busy} accessibilityLabel={`Snooze ${view.item.title} for 10 minutes`} />
            <AppButton label="30 min" variant="secondary" onPress={() => void snooze(30)} disabled={busy} accessibilityLabel={`Snooze ${view.item.title} for 30 minutes`} />
            <AppButton label="1 hour" variant="secondary" onPress={() => void snooze(60)} disabled={busy} accessibilityLabel={`Snooze ${view.item.title} for 1 hour`} />
          </ButtonRow>
        </Card>
      ) : null}

      {next && view.item.status === 'active' ? (
        <Card>
          <SectionTitle title="Reschedule this occurrence" description="The rest of the series stays unchanged." />
          <View style={styles.twoColumns}>
            <View style={styles.column}><Field label="Date" value={rescheduleDate} onChangeText={setRescheduleDate} autoCapitalize="none" /></View>
            <View style={styles.column}><Field label="Time" value={rescheduleTime} onChangeText={setRescheduleTime} autoCapitalize="none" /></View>
          </View>
          <AppButton label="Reschedule" variant="secondary" onPress={() => void reschedule()} disabled={busy || !rescheduleDate || !rescheduleTime} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Manage" />
        <ButtonRow>
          {view.item.status === 'active' ? (
            <AppButton label="Pause" variant="secondary" disabled={busy} onPress={() => void run(async () => {
              const identifiers = await pauseScheduledItem(view.item.id, new Date().toISOString());
              await Promise.all(identifiers.map(cancelNotification));
            })} accessibilityLabel={`Pause ${view.item.title}`} />
          ) : null}
          {view.item.status === 'paused' ? (
            <AppButton label="Resume" disabled={busy} onPress={() => void run(() => {
              const now = Temporal.Now.instant();
              return resumeScheduledItem(view.item.id, now.toString({ smallestUnit: 'millisecond' }), now.add({ hours: HORIZON_HOURS }).toString({ smallestUnit: 'millisecond' }), deviceTimeZone());
            })} accessibilityLabel={`Resume ${view.item.title}`} />
          ) : null}
          {view.item.status === 'active' || view.item.status === 'paused' ? (
            <AppButton label="End schedule" variant="secondary" disabled={busy} onPress={() => void run(async () => {
              const identifiers = await stopScheduledItem(view.item.id, new Date().toISOString());
              await Promise.all(identifiers.map(cancelNotification));
            })} accessibilityLabel={`End schedule for ${view.item.title}`} />
          ) : null}
          <AppButton label="Delete" variant="danger" disabled={busy} onPress={confirmDelete} accessibilityLabel={`Delete ${view.item.title}`} />
        </ButtonRow>
      </Card>

      <Card>
        <SectionTitle title="Recent activity" />
        {view.occurrences.length ? view.occurrences.slice(0, 12).map((occurrence) => (
          <View key={occurrence.id} style={styles.historyRow}>
            <View style={styles.historyCopy}>
              <Text style={styles.historyStatus}>{historyLabel(occurrence.status)}</Text>
              <Text style={uiStyles.muted}>{formatInstant(occurrence.scheduledAtUtc, occurrence.effectiveTimeZone)}</Text>
            </View>
            {occurrence.completedAtUtc ? <Text style={uiStyles.muted}>at {formatInstant(occurrence.completedAtUtc)}</Text> : null}
          </View>
        )) : <Text style={uiStyles.body}>No occurrence history yet.</Text>}
      </Card>

      {error ? <Notice tone="error">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1, gap: 4 },
  editButton: { minHeight: 48, minWidth: 60, justifyContent: 'center', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  editLabel: { color: colors.ink, fontWeight: '800' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.greenSoft },
  pausedPill: { backgroundColor: '#FFF0CE' },
  endedPill: { backgroundColor: '#E7E5E0' },
  statusText: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  column: { flex: 1, minWidth: 130 },
  historyRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11 },
  historyCopy: { flex: 1, gap: 2 },
  historyStatus: { color: colors.ink, fontWeight: '800' },
});
