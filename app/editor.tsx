import { Temporal } from '@js-temporal/polyfill';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  buildManualItem,
  defaultManualItemInput,
  manualInputFromItem,
  previewNextOccurrence,
  type ManualItemInput,
} from '@/application/manual-item';
import { scheduleSummary } from '@/application/schedule-presentation';
import type { Frequency, ItemKind, RecurrenceAnchor, TimeZonePolicy } from '@/domain/schedule';
import { deviceTimeZone, localDateTimeToInstant } from '@/domain/time';
import { cancelNotification, reconcileNotifications } from '@/infrastructure/notifications';
import { createScheduledItem, editScheduledItem, getScheduledItem } from '@/infrastructure/schedule-repository';
import { uuidv7 } from '@/lib/ids';
import { colors } from '@/theme';
import { AppButton, ButtonRow, Card, Field, Notice, Screen, SectionTitle, Segment, uiStyles } from '@/ui/components';

const FREQUENCIES: ReadonlyArray<{ value: Frequency; label: string }> = [
  { value: 'none', label: 'Once' },
  { value: 'minute', label: 'Minutes' },
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatOccurrence(value: string, zone: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: zone }).format(new Date(value));
}

function saveHorizon(item: NonNullable<ReturnType<typeof buildManualItem>['item']>, nowUtc: string): string {
  const fallback = Temporal.Instant.from(nowUtc).add({ hours: 24 * 370 });
  try {
    const zone = item.schedule.timeZonePolicy === 'follow_device' ? deviceTimeZone() : item.schedule.timeZone;
    const start = Temporal.Instant.from(localDateTimeToInstant(item.schedule.startLocal, zone));
    const base = Temporal.Instant.compare(start, fallback) > 0 ? start : fallback;
    return base.add({ hours: 24 * 370 }).toString({ smallestUnit: 'millisecond' });
  } catch {
    return fallback.toString({ smallestUnit: 'millisecond' });
  }
}

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editingId = typeof id === 'string' ? id : null;
  const [identity] = useState(() => editingId ?? uuidv7());
  const [revision, setRevision] = useState(1);
  const [input, setInput] = useState<ManualItemInput>(() => defaultManualItemInput());
  const [loading, setLoading] = useState(editingId !== null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    void getScheduledItem(editingId).then((item) => {
      setInput(manualInputFromItem(item));
      setRevision(item.revision + 1);
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'The item could not be loaded.')).finally(() => setLoading(false));
  }, [editingId]);

  const built = useMemo(() => buildManualItem(input, { id: identity, revision }), [identity, input, revision]);
  const next = useMemo(() => built.item ? previewNextOccurrence(built.item) : null, [built.item]);
  const zone = input.timeZonePolicy === 'follow_device' ? deviceTimeZone() : input.timeZone;

  const update = <K extends keyof ManualItemInput>(key: K, value: ManualItemInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const setKind = (kind: ItemKind) => {
    setInput((current) => ({
      ...current,
      kind,
      recurrenceAnchor: kind === 'event' ? 'fixed' : current.recurrenceAnchor,
      useActiveWindow: kind === 'event' ? false : current.useActiveWindow,
    }));
  };

  const setFrequency = (frequency: Frequency) => {
    setInput((current) => ({
      ...current,
      frequency,
      weekdays: frequency === 'week' ? current.weekdays : [],
      timesOfDay: frequency === 'day' || frequency === 'week' ? current.timesOfDay : '',
      useActiveWindow: frequency === 'minute' || frequency === 'hour' ? current.useActiveWindow : false,
      recurrenceAnchor: frequency === 'none' ? 'fixed' : current.recurrenceAnchor,
      stopKind: frequency === 'none' ? 'never' : current.stopKind,
    }));
  };

  const toggleWeekday = (day: number) => update(
    'weekdays',
    input.weekdays.includes(day) ? input.weekdays.filter((value) => value !== day) : [...input.weekdays, day],
  );

  const save = async () => {
    setSubmitted(true);
    if (!built.item || !next) return;
    setSaving(true);
    setMessage(null);
    const now = new Date().toISOString();
    try {
      if (editingId) {
        const identifiers = await editScheduledItem(built.item, now, saveHorizon(built.item, now), deviceTimeZone());
        await Promise.all(identifiers.map(cancelNotification));
      } else {
        await createScheduledItem(built.item, now, saveHorizon(built.item, now), deviceTimeZone());
      }
      await reconcileNotifications();
      router.replace({ pathname: '/item/[id]', params: { id: built.item.id } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The item could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const recurring = input.frequency !== 'none';
  const intervalWindow = input.frequency === 'minute' || input.frequency === 'hour';

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: editingId ? 'Edit item' : 'New item' }} />
      <SectionTitle
        eyebrow={editingId ? 'EDIT SERIES' : 'MANUAL CREATION'}
        title={editingId ? 'Change the schedule' : 'What should happen?'}
        description="Every field stays local. The same deterministic engine that registers notifications validates this form."
      />

      <Card>
        <Segment<ItemKind>
          label="Item type"
          value={input.kind}
          options={[{ value: 'reminder', label: 'Reminder' }, { value: 'event', label: 'Event' }]}
          onChange={setKind}
        />
        <Field label="Title" value={input.title} onChangeText={(value) => update('title', value)} placeholder="Take medication" />
        <Field label="Notes (optional)" value={input.notes} onChangeText={(value) => update('notes', value)} multiline placeholder="Add details" />
        {input.kind === 'event' ? (
          <>
            <Field label="Duration in minutes" value={input.eventDurationMinutes} onChangeText={(value) => update('eventDurationMinutes', value)} keyboardType="number-pad" />
            <Field label="Location (optional)" value={input.eventLocation} onChangeText={(value) => update('eventLocation', value)} />
            <Field label="Alerts before start (minutes)" value={input.eventAlertOffsets} onChangeText={(value) => update('eventAlertOffsets', value)} keyboardType="numbers-and-punctuation" help="Comma-separated. Use 0 for an alert at the start, or leave empty for no alert." />
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Starts" />
        <Field label="Date" value={input.date} onChangeText={(value) => update('date', value)} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Field label="Time" value={input.time} onChangeText={(value) => update('time', value)} placeholder="HH:MM" autoCapitalize="none" />
        <Segment<TimeZonePolicy>
          label="Time-zone behavior"
          value={input.timeZonePolicy}
          options={[{ value: 'follow_device', label: 'Follow device' }, { value: 'fixed', label: 'Fixed zone' }]}
          onChange={(value) => update('timeZonePolicy', value)}
        />
        {input.timeZonePolicy === 'fixed' ? (
          <Field label="IANA time zone" value={input.timeZone} onChangeText={(value) => update('timeZone', value)} placeholder="America/Toronto" autoCapitalize="none" />
        ) : (
          <Text style={uiStyles.muted}>Current device zone: {deviceTimeZone()}</Text>
        )}
      </Card>

      <Card>
        <SectionTitle title="Repeats" description="Choose Once for a single occurrence." />
        <Segment<Frequency> label="Frequency" value={input.frequency} options={FREQUENCIES} onChange={setFrequency} />
        {recurring ? (
          <Field label={`Repeat every how many ${input.frequency}s?`} value={input.interval} onChangeText={(value) => update('interval', value)} keyboardType="number-pad" />
        ) : null}
        {input.frequency === 'week' ? (
          <View style={styles.fieldGroup} accessibilityRole="radiogroup" accessibilityLabel="Weekdays">
            <Text style={styles.fieldLabel}>Weekdays</Text>
            <View style={styles.weekdays}>
              {WEEKDAYS.map((label, index) => {
                const day = index + 1;
                const selected = input.weekdays.includes(day);
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={label}
                    onPress={() => toggleWeekday(day)}
                    style={[styles.weekday, selected && styles.weekdaySelected]}
                  >
                    <Text style={[styles.weekdayLabel, selected && styles.weekdayLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {(input.frequency === 'day' || input.frequency === 'week') ? (
          <Field label="Times of day (optional)" value={input.timesOfDay} onChangeText={(value) => update('timesOfDay', value)} placeholder="09:00, 17:00" autoCapitalize="none" help="Comma-separated. When empty, the start time is used." />
        ) : null}
        {intervalWindow && input.kind === 'reminder' ? (
          <>
            <Segment<'off' | 'on'>
              label="Active hours"
              value={input.useActiveWindow ? 'on' : 'off'}
              options={[{ value: 'off', label: 'All day' }, { value: 'on', label: 'Use window' }]}
              onChange={(value) => update('useActiveWindow', value === 'on')}
            />
            {input.useActiveWindow ? (
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Window starts" value={input.activeWindowStart} onChangeText={(value) => update('activeWindowStart', value)} autoCapitalize="none" /></View>
                <View style={styles.column}><Field label="Window ends" value={input.activeWindowEnd} onChangeText={(value) => update('activeWindowEnd', value)} autoCapitalize="none" /></View>
              </View>
            ) : null}
          </>
        ) : null}
        {recurring && input.kind === 'reminder' ? (
          <Segment<RecurrenceAnchor>
            label="Timing"
            value={input.recurrenceAnchor}
            options={[{ value: 'fixed', label: 'Fixed schedule' }, { value: 'completion', label: 'After completion' }]}
            onChange={(value) => update('recurrenceAnchor', value)}
          />
        ) : null}
        {recurring && input.recurrenceAnchor === 'completion' ? (
          <Text style={uiStyles.muted}>After completion creates one occurrence at a time. The next is calculated from when you complete the current one.</Text>
        ) : null}
      </Card>

      {recurring ? (
        <Card>
          <SectionTitle title="Ends" />
          <Segment<ManualItemInput['stopKind']>
            label="Stopping rule"
            value={input.stopKind}
            options={[{ value: 'never', label: 'Manually' }, { value: 'on_date', label: 'On date' }, { value: 'after_occurrences', label: 'After count' }]}
            onChange={(value) => update('stopKind', value)}
          />
          {input.stopKind === 'on_date' ? <Field label="Inclusive end date" value={input.stopOnDate} onChangeText={(value) => update('stopOnDate', value)} placeholder="YYYY-MM-DD" autoCapitalize="none" /> : null}
          {input.stopKind === 'after_occurrences' ? <Field label="Number of occurrences" value={input.stopAfterOccurrences} onChangeText={(value) => update('stopAfterOccurrences', value)} keyboardType="number-pad" /> : null}
        </Card>
      ) : null}

      <Card tone={built.item && next ? 'success' : 'warning'}>
        <Text style={uiStyles.eyebrow}>NEXT OCCURRENCE</Text>
        {built.item && next ? (
          <>
            <Text style={uiStyles.title}>{formatOccurrence(next.scheduledAtUtc, zone)}</Text>
            <Text style={uiStyles.body}>{scheduleSummary(built.item)}</Text>
            {next.dstAdjusted ? <Notice tone="warning">This local time falls in a daylight-saving gap and will be adjusted by the device.</Notice> : null}
          </>
        ) : (
          <Text style={uiStyles.body}>Complete the required fields to calculate the next occurrence.</Text>
        )}
      </Card>

      {(submitted || input.title.trim()) && built.errors.length ? (
        <Notice tone="error">{built.errors.join('\n')}</Notice>
      ) : null}
      {submitted && built.item && !next ? <Notice tone="error">This schedule does not produce a next occurrence. Check its start and ending rule.</Notice> : null}
      {message ? <Notice tone="error">{message}</Notice> : null}

      <ButtonRow>
        <AppButton label="Cancel" variant="secondary" onPress={() => router.back()} />
        <AppButton label={saving ? 'Saving…' : editingId ? 'Save changes' : `Create ${input.kind}`} disabled={saving || !built.item || !next} onPress={() => void save()} />
      </ButtonRow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  weekday: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  weekdaySelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  weekdayLabel: { color: colors.ink, fontWeight: '800' },
  weekdayLabelSelected: { color: colors.white },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  column: { flex: 1, minWidth: 140 },
});
