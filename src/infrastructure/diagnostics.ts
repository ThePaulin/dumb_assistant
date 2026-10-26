import { getDatabase } from './database';
import { uuidv7 } from '@/lib/ids';

export type DiagnosticEvent = {
  category: 'transcription' | 'interpretation' | 'notification' | 'oauth' | 'model';
  engine?: 'local' | 'openrouter' | 'platform';
  durationMs?: number;
  resultKind: 'success' | 'failure' | 'cancelled';
  errorCode?: string;
  modelId?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
};

export async function recordDiagnostic(event: DiagnosticEvent): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO diagnostic_events
     (id, category, engine, duration_ms, result_kind, error_code, model_id,
      prompt_tokens, completion_tokens, estimated_cost_usd, created_at_utc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuidv7(),
    event.category,
    event.engine ?? null,
    event.durationMs ?? null,
    event.resultKind,
    event.errorCode ?? null,
    event.modelId ?? null,
    event.promptTokens ?? null,
    event.completionTokens ?? null,
    event.estimatedCostUsd ?? null,
    new Date().toISOString(),
  );
}

export async function timedDiagnostic<T>(
  base: Omit<DiagnosticEvent, 'durationMs' | 'resultKind'>,
  operation: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    const value = await operation();
    await recordDiagnostic({
      ...base,
      durationMs: Math.round(performance.now() - started),
      resultKind: 'success',
    });
    return value;
  } catch (error) {
    await recordDiagnostic({
      ...base,
      durationMs: Math.round(performance.now() - started),
      resultKind: 'failure',
      errorCode: error instanceof Error ? error.name : 'unknown_error',
    });
    throw error;
  }
}
