import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLLM, useSpeechToText, type Message } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

import { type InterpretationProposal } from '@/domain/proposal';
import { deviceTimeZone } from '@/domain/time';
import { parseLocalInterpretation } from '@/inference/compact-proposal';
import {
  LANGUAGE_MODEL,
  LANGUAGE_MODEL_SOURCES,
  WHISPER_MODEL,
  WHISPER_SOURCES,
} from '@/inference/models';
import { localInterpretationMessages } from '@/inference/prompt';
import { hasAudibleSignal } from '@/inference/whisper-input';
import { cleanupAbandonedAudio, decodeRecording, deleteRecording } from '@/infrastructure/audio';
import {
  cleanupExpiredDrafts,
  confirmOneTimeReminder,
  deleteDraft,
  getDatabase,
  listReminders,
  removeReminder,
  saveDraft,
  type ReminderRow,
} from '@/infrastructure/database';
import { recordDiagnostic } from '@/infrastructure/diagnostics';
import { cancelNotification, reconcileNotifications, scheduleConfirmedReminder } from '@/infrastructure/notifications';
import { colors } from '@/theme';

type Engine = 'local' | 'openrouter';
type Phase = 'idle' | 'recording' | 'transcribing' | 'interpreting' | 'saving';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [modelsRequested, setModelsRequested] = useState(false);
  const [downloadsPaused, setDownloadsPaused] = useState(false);
  const speech = useSpeechToText({ model: WHISPER_MODEL, preventLoad: !modelsRequested });
  const language = useLLM({ model: LANGUAGE_MODEL, preventLoad: !modelsRequested });
  const [engine, setEngine] = useState<Engine>('local');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [proposal, setProposal] = useState<InterpretationProposal | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);

  const modelsReady = speech.isReady && language.isReady;
  const modelProgress = Math.round(((speech.downloadProgress + language.downloadProgress) / 2) * 100);
  const busy = phase !== 'idle';

  const refresh = useCallback(async () => setReminders(await listReminders()), []);

  useEffect(() => {
    void (async () => {
      await getDatabase();
      cleanupAbandonedAudio();
      await cleanupExpiredDrafts();
      await reconcileNotifications();
      await refresh();
    })().catch((error) => setNotice(errorMessage(error)));
  }, [refresh]);

  const discardDraft = useCallback(async () => {
    if (draftId) await deleteDraft(draftId);
    setDraftId(null);
    setProposal(null);
  }, [draftId]);

  const interpretLocal = useCallback(
    async (
      text: string,
      requestContext: { now: string; timeZone: string; locale: string },
    ): Promise<InterpretationProposal> => {
      if (!language.isReady) throw new Error('Download and load the offline language model first.');
      const started = performance.now();
      try {
        const raw = await language.generate(localInterpretationMessages(text, requestContext) as Message[]);
        const validated = parseLocalInterpretation(raw, requestContext);
        await recordDiagnostic({
          category: 'interpretation',
          engine: 'local',
          modelId: LANGUAGE_MODEL.modelName,
          durationMs: Math.round(performance.now() - started),
          resultKind: 'success',
          promptTokens: language.getPromptTokenCount(),
          completionTokens: language.getGeneratedTokenCount(),
        });
        return validated;
      } catch (error) {
        await recordDiagnostic({
          category: 'interpretation',
          engine: 'local',
          modelId: LANGUAGE_MODEL.modelName,
          durationMs: Math.round(performance.now() - started),
          resultKind: 'failure',
          errorCode: error instanceof Error ? error.name : 'invalid_output',
        });
        throw error;
      }
    },
    [language],
  );

  const runInterpretation = useCallback(
    async (text: string, source: 'voice' | 'text') => {
      if (!text.trim()) throw new Error('Say or type a reminder first.');
      setPhase('interpreting');
      setNotice(null);
      await discardDraft();
      const requestContext = {
        now: new Date().toISOString(),
        timeZone: deviceTimeZone(),
        locale: 'en-CA',
      };

      let nextProposal: InterpretationProposal;
      if (engine === 'local') {
        nextProposal = await interpretLocal(text.trim(), requestContext);
      } else {
        const { interpretWithOpenRouter } = await import('@/infrastructure/openrouter');
        const started = performance.now();
        try {
          const remote = await interpretWithOpenRouter(text.trim(), requestContext);
          await recordDiagnostic({
            category: 'interpretation',
            engine: 'openrouter',
            modelId: remote.model,
            durationMs: Math.round(performance.now() - started),
            resultKind: 'success',
            ...(remote.promptTokens === undefined ? {} : { promptTokens: remote.promptTokens }),
            ...(remote.completionTokens === undefined ? {} : { completionTokens: remote.completionTokens }),
            ...(remote.costUsd === undefined ? {} : { estimatedCostUsd: remote.costUsd }),
          });
          nextProposal = remote.proposal;
        } catch (error) {
          await recordDiagnostic({
            category: 'interpretation',
            engine: 'openrouter',
            durationMs: Math.round(performance.now() - started),
            resultKind: 'failure',
            errorCode: error instanceof Error ? error.name : 'remote_error',
          });
          throw error;
        }
      }

      setProposal(nextProposal);
      setDraftId(await saveDraft(text.trim(), nextProposal, source));
      setPhase('idle');
    },
    [discardDraft, engine, interpretLocal],
  );

  const startRecording = useCallback(async () => {
    if (!speech.isReady) throw new Error('Download and load Whisper first.');
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error('Microphone permission is required to record a reminder.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: 30 });
    setNotice(null);
    setPhase('recording');
  }, [recorder, speech.isReady]);

  const stopRecording = useCallback(async () => {
    const started = performance.now();
    let uri: string | null = null;
    let text: string | null = null;
    setPhase('transcribing');
    try {
      await recorder.stop();
      uri = recorder.uri;
      if (!uri) throw new Error('The recording could not be read.');
      const waveform = await decodeRecording(uri);
      if (!hasAudibleSignal(waveform)) {
        throw new Error('No speech was detected. Try recording again in a quieter environment.');
      }
      const result = await speech.transcribe(waveform);
      text = result.text.trim();
      setTranscript(text);
      await recordDiagnostic({
        category: 'transcription',
        engine: 'local',
        modelId: WHISPER_MODEL.modelName,
        durationMs: Math.round(performance.now() - started),
        resultKind: 'success',
      });
    } catch (error) {
      uri ??= recorder.uri;
      await recordDiagnostic({
        category: 'transcription',
        engine: 'local',
        modelId: WHISPER_MODEL.modelName,
        durationMs: Math.round(performance.now() - started),
        resultKind: 'failure',
        errorCode: error instanceof Error ? error.name : 'transcription_error',
      });
      setNotice(errorMessage(error));
      setPhase('idle');
    } finally {
      deleteRecording(uri);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    }
    if (text) {
      try {
        await runInterpretation(text, 'voice');
      } catch (error) {
        setNotice(errorMessage(error));
        setPhase('idle');
      }
    }
  }, [recorder, runInterpretation, speech]);

  const cancelRecording = useCallback(async () => {
    const started = performance.now();
    let uri = recorder.uri;
    try {
      await recorder.stop();
      uri ??= recorder.uri;
    } catch (error) {
      uri ??= recorder.uri;
      setNotice(errorMessage(error));
    } finally {
      deleteRecording(uri);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setPhase('idle');
      await recordDiagnostic({
        category: 'transcription',
        engine: 'local',
        modelId: WHISPER_MODEL.modelName,
        durationMs: Math.round(performance.now() - started),
        resultKind: 'cancelled',
      });
    }
  }, [recorder]);

  const confirm = useCallback(async () => {
    if (!draftId || !proposal) return;
    setPhase('saving');
    setNotice(null);
    try {
      const record = await confirmOneTimeReminder(draftId, proposal);
      setDraftId(null);
      setProposal(null);
      setTranscript('');
      try {
        await scheduleConfirmedReminder(record);
        setNotice('Reminder saved and registered with this device.');
      } catch {
        setNotice('Reminder saved, but notification registration failed. It will be retried on launch.');
      }
      await refresh();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setPhase('idle');
    }
  }, [draftId, proposal, refresh]);

  const remove = useCallback(
    async (row: ReminderRow) => {
      const platformIdentifier = await removeReminder(row.id);
      await cancelNotification(platformIdentifier);
      await refresh();
    },
    [refresh],
  );

  const canConfirm =
    proposal?.result === 'proposal' &&
    proposal.intent === 'reminder' &&
    proposal.schedule?.frequency === 'none';

  const removeOfflineModels = useCallback(async () => {
    setModelsRequested(false);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await ExpoResourceFetcher.deleteResources(...WHISPER_SOURCES, ...LANGUAGE_MODEL_SOURCES);
    setNotice('Offline models unloaded and deleted.');
  }, []);

  const controlDownloads = useCallback(async (action: 'pause' | 'resume' | 'cancel') => {
    const operation = action === 'pause'
      ? ExpoResourceFetcher.pauseFetching.bind(ExpoResourceFetcher)
      : action === 'resume'
        ? ExpoResourceFetcher.resumeFetching.bind(ExpoResourceFetcher)
        : ExpoResourceFetcher.cancelFetching.bind(ExpoResourceFetcher);
    const results = await Promise.allSettled([
      operation(...WHISPER_SOURCES),
      operation(...LANGUAGE_MODEL_SOURCES),
    ]);
    if (results.every((result) => result.status === 'rejected')) {
      throw new Error(`No model download could ${action}.`);
    }
    if (action === 'cancel') {
      setModelsRequested(false);
      setDownloadsPaused(false);
    } else {
      setDownloadsPaused(action === 'pause');
    }
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>DUMB ASSISTANT · SPIKE</Text>
          <Text style={styles.title}>Say it. Check it. Done.</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" style={styles.settingsButton}>
            <Text style={styles.settingsText}>Models</Text>
          </Pressable>
        </Link>
      </View>

      {!modelsRequested ? (
        <View style={styles.modelCard}>
          <Text style={styles.cardTitle}>Offline voice needs two models</Text>
          <Text style={styles.bodyText}>
            Whisper converts audio to text. A compact Qwen model converts that text into a proposal. Downloads are removable.
          </Text>
          <PrimaryButton label="Download offline models" onPress={() => setModelsRequested(true)} />
        </View>
      ) : !modelsReady ? (
        <View style={styles.modelCard}>
          <Text style={styles.cardTitle}>Preparing offline models · {modelProgress}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(modelProgress, 3)}%` }]} />
          </View>
          <Text style={styles.smallText}>
            {speech.error?.message ?? language.error?.message ?? 'Keep the app open while the first download finishes.'}
          </Text>
          <View style={styles.actionRow}>
            <SecondaryButton
              label={downloadsPaused ? 'Resume' : 'Pause'}
              onPress={() => void controlDownloads(downloadsPaused ? 'resume' : 'pause').catch((error) => setNotice(errorMessage(error)))}
            />
            <SecondaryButton
              label="Cancel"
              onPress={() => void controlDownloads('cancel').catch((error) => setNotice(errorMessage(error)))}
            />
          </View>
        </View>
      ) : (
        <View style={styles.readyRow}>
          <View style={styles.readyPill}><Text style={styles.readyText}>● Offline models ready</Text></View>
          <Pressable accessibilityRole="button" onPress={() => void removeOfflineModels()}>
            <Text style={styles.deleteText}>Remove models</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.composer}>
        <View style={styles.engineRow}>
          {(['local', 'openrouter'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setEngine(item)}
              accessibilityRole="radio"
              accessibilityState={{ checked: engine === item }}
              style={[styles.engineButton, engine === item && styles.engineButtonActive]}
            >
              <Text style={[styles.engineText, engine === item && styles.engineTextActive]}>
                {item === 'local' ? 'On device' : 'OpenRouter'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          accessibilityLabel="Reminder request"
          multiline
          value={transcript}
          onChangeText={setTranscript}
          placeholder="Remind me to call Sam tomorrow at 3 PM…"
          placeholderTextColor="#8B918D"
          style={styles.input}
          editable={!busy}
        />

        {engine === 'openrouter' && (
          <Text style={styles.disclosure}>
            OpenRouter sends transcript text—not audio—to the compatible model you authorize. Provider retention and cost depend on your account routing.
          </Text>
        )}

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start recording'}
            disabled={busy && phase !== 'recording'}
            onPress={() => void (phase === 'recording' ? stopRecording() : startRecording().catch((error) => setNotice(errorMessage(error))))}
            style={[styles.micButton, phase === 'recording' && styles.micButtonRecording]}
          >
            <Text style={styles.micIcon}>{phase === 'recording' ? '■' : '●'}</Text>
            <Text style={styles.micText}>
              {phase === 'recording' ? `Stop · ${Math.floor(recorderState.durationMillis / 1000)}s` : 'Record'}
            </Text>
          </Pressable>
          {phase === 'recording' ? (
            <SecondaryButton label="Cancel recording" onPress={() => void cancelRecording()} />
          ) : (
            <PrimaryButton
              label={phase === 'interpreting' ? 'Interpreting…' : 'Preview'}
              disabled={busy || !transcript.trim() || (engine === 'local' && !language.isReady)}
              onPress={() => void runInterpretation(transcript, 'text').catch((error) => {
                setNotice(errorMessage(error));
                setPhase('idle');
              })}
            />
          )}
        </View>
      </View>

      {busy && phase !== 'recording' && (
        <View style={styles.busyRow}><ActivityIndicator color={colors.accent} /><Text style={styles.smallText}>{phase}…</Text></View>
      )}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      {proposal && (
        <View style={styles.previewCard}>
          <Text style={styles.eyebrow}>CHECK BEFORE SAVING</Text>
          {proposal.result === 'proposal' && proposal.schedule ? (
            <>
              <Text style={styles.previewTitle}>{proposal.title}</Text>
              <Text style={styles.previewDate}>
                {proposal.schedule.start_local.replace('T', ' ')} · {proposal.schedule.time_zone}
              </Text>
              {proposal.notes && <Text style={styles.bodyText}>{proposal.notes}</Text>}
              {!canConfirm && (
                <Text style={styles.warning}>This spike only confirms one-time reminders. The proposal was validated but not scheduled.</Text>
              )}
            </>
          ) : proposal.result === 'needs_clarification' ? (
            <>
              <Text style={styles.previewTitle}>One detail needed</Text>
              <Text style={styles.bodyText}>{proposal.clarification?.question}</Text>
            </>
          ) : (
            <>
              <Text style={styles.previewTitle}>Not supported yet</Text>
              <Text style={styles.bodyText}>{proposal.unsupported?.message}</Text>
            </>
          )}
          <View style={styles.actionRow}>
            <SecondaryButton label="Cancel" onPress={() => void discardDraft()} />
            {canConfirm && <PrimaryButton label="Confirm reminder" disabled={busy} onPress={() => void confirm()} />}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Scheduled</Text>
        <Text style={styles.count}>{reminders.length}</Text>
      </View>
      {reminders.length === 0 ? (
        <Text style={styles.empty}>No reminders yet. Your first confirmed reminder will appear here.</Text>
      ) : reminders.map((row) => (
        <View key={row.id} style={styles.reminderRow}>
          <View style={styles.reminderCopy}>
            <Text style={styles.reminderTitle}>{row.title}</Text>
            <Text style={styles.smallText}>{formatDate(row.scheduled_at_utc)} · {row.notification_state}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${row.title}`} onPress={() => void remove(row)}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.accentDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: '800', maxWidth: 290, marginTop: 5 },
  settingsButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  settingsText: { color: colors.ink, fontWeight: '700' },
  modelCard: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 18, gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  bodyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  smallText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  readyPill: { alignSelf: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  readyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readyText: { color: colors.green, fontWeight: '800', fontSize: 13 },
  progressTrack: { height: 8, backgroundColor: '#BED7CC', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 999 },
  composer: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  engineRow: { flexDirection: 'row', backgroundColor: colors.background, padding: 4, borderRadius: 12 },
  engineButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  engineButtonActive: { backgroundColor: colors.ink },
  engineText: { color: colors.muted, fontWeight: '700' },
  engineTextActive: { color: colors.white },
  input: { minHeight: 105, color: colors.ink, fontSize: 18, lineHeight: 26, textAlignVertical: 'top', padding: 2 },
  disclosure: { color: colors.accentDark, backgroundColor: '#FAE7DE', padding: 11, borderRadius: 10, fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  micButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.background },
  micButtonRecording: { backgroundColor: colors.dangerSoft },
  micIcon: { color: colors.accent, fontSize: 16 },
  micText: { color: colors.ink, fontWeight: '800' },
  primaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, flexShrink: 1 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 20 },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  notice: { backgroundColor: colors.greenSoft, color: colors.green, padding: 12, borderRadius: 12, lineHeight: 20 },
  previewCard: { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 2, borderRadius: 24, padding: 18, gap: 12 },
  previewTitle: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  previewDate: { color: colors.green, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  warning: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  count: { color: colors.muted, backgroundColor: colors.surface, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 3, fontWeight: '800' },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 22, paddingBottom: 20 },
  reminderRow: { backgroundColor: colors.surface, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reminderCopy: { flex: 1, gap: 4 },
  reminderTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  deleteText: { color: colors.danger, fontWeight: '800', padding: 8 },
});
