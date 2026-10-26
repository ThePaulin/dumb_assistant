import {
  extractJsonObject,
  validateProposal,
  type InterpretationProposal,
  type Intent,
  type ProposalResult,
  type Schedule,
} from '../domain/proposal';
import { localDateTimeToInstant } from '../domain/time';
import type { InterpretationContext } from './prompt';

type JsonRecord = Record<string, unknown>;

const results = new Set<ProposalResult>(['proposal', 'needs_clarification', 'unsupported']);
const intents = new Set<Exclude<Intent, null>>(['reminder', 'event']);
const frequencies = new Set<Schedule['frequency']>(['none', 'minute', 'hour', 'day', 'week', 'month']);

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The local interpreter did not return a JSON object.');
  }
  return value as JsonRecord;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`The local interpreter omitted ${field}.`);
  }
  return value.trim();
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`The local interpreter returned an invalid ${field}.`);
  }
  return value as number;
}

function integerArray(value: unknown, field: string): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => Number.isInteger(item))) {
    throw new Error(`The local interpreter returned an invalid ${field}.`);
  }
  return value as number[];
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`The local interpreter returned an invalid ${field}.`);
  }
  return value as string[];
}

function pipeRecord(raw: string): JsonRecord | null {
  const line = raw
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => /^(P|C|U)\|/.test(candidate));
  if (!line) return null;

  const fields = line.split('|').map((field) => field.trim());
  if (fields[0] === 'C') {
    return { result: 'needs_clarification', field: fields[1], question: fields.slice(2).join(' ') };
  }
  if (fields[0] === 'U') {
    return { result: 'unsupported', reason_code: fields[1], message: fields.slice(2).join(' ') };
  }
  if (fields.length < 9) throw new Error('The local interpreter returned an incomplete proposal.');

  const numberOrNull = (input: string | undefined) => {
    if (!input || input === '0' || input === 'null' || input === 'none') return null;
    const parsed = Number(input);
    return Number.isInteger(parsed) ? parsed : input;
  };
  const commaNumbers = (input: string | undefined) => input && !['0', 'none', 'null'].includes(input)
    ? input.split(',').map((item) => Number(item.trim()))
    : [];
  const commaStrings = (input: string | undefined) => input && !['0', 'none', 'null'].includes(input)
    ? input.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    result: 'proposal',
    intent: fields[1],
    title: fields[2],
    start_local: fields[3],
    frequency: fields[4],
    interval: numberOrNull(fields[5]),
    weekdays: commaNumbers(fields[6]),
    times_of_day: commaStrings(fields[7]),
    duration_minutes: numberOrNull(fields[8]),
  };
}

function proposalFromCompact(value: JsonRecord, context: InterpretationContext): InterpretationProposal {
  const result = requiredString(value.result, 'result');
  if (!results.has(result as ProposalResult)) {
    throw new Error('The local interpreter returned an unknown result type.');
  }

  if (result === 'needs_clarification') {
    return {
      schema_version: '1.0.0',
      result,
      intent: null,
      title: null,
      notes: null,
      schedule: null,
      event: null,
      clarification: {
        field: requiredString(value.field, 'clarification field'),
        question: requiredString(value.question, 'clarification question'),
      },
      unsupported: null,
      warnings: [],
      field_confidences: [],
    } as InterpretationProposal;
  }

  if (result === 'unsupported') {
    return {
      schema_version: '1.0.0',
      result,
      intent: null,
      title: null,
      notes: null,
      schedule: null,
      event: null,
      clarification: null,
      unsupported: {
        reason_code: requiredString(value.reason_code, 'unsupported reason'),
        message: requiredString(value.message, 'unsupported message'),
      },
      warnings: [],
      field_confidences: [],
    } as InterpretationProposal;
  }

  const intent = requiredString(value.intent, 'intent');
  if (!intents.has(intent as Exclude<Intent, null>)) {
    throw new Error('The local interpreter returned an invalid intent.');
  }
  const frequency = requiredString(value.frequency, 'frequency');
  if (!frequencies.has(frequency as Schedule['frequency'])) {
    throw new Error('The local interpreter returned an invalid frequency.');
  }
  const durationMinutes = optionalInteger(value.duration_minutes, 'event duration');

  return {
    schema_version: '1.0.0',
    result: 'proposal',
    intent: intent as Exclude<Intent, null>,
    title: requiredString(value.title, 'title'),
    notes: null,
    schedule: {
      start_local: requiredString(value.start_local, 'start time'),
      time_zone: context.timeZone,
      time_zone_policy: 'follow_device',
      frequency: frequency as Schedule['frequency'],
      interval: optionalInteger(value.interval, 'recurrence interval'),
      weekdays: integerArray(value.weekdays, 'weekdays'),
      times_of_day: stringArray(value.times_of_day, 'times of day'),
      active_window: null,
      recurrence_anchor: 'fixed',
      stop: { kind: 'never', on_date: null, after_occurrences: null },
    },
    event: intent === 'event'
      ? { end_local: null, duration_minutes: durationMinutes, location: null, alert_offsets_minutes: [] }
      : null,
    clarification: null,
    unsupported: null,
    warnings: [],
    field_confidences: [],
  };
}

export function parseLocalInterpretation(raw: string, context: InterpretationContext): InterpretationProposal {
  const compact = pipeRecord(raw) ?? record(extractJsonObject(raw));
  const expanded = proposalFromCompact(compact, context);
  const validated = validateProposal(expanded);
  if (!validated.ok) {
    throw new Error(`Local model returned an invalid proposal: ${validated.errors.join(' ')}`);
  }
  if (validated.value.result === 'proposal' && validated.value.schedule) {
    const scheduledAt = localDateTimeToInstant(
      validated.value.schedule.start_local,
      validated.value.schedule.time_zone,
    );
    if (new Date(scheduledAt).getTime() <= new Date(context.now).getTime()) {
      throw new Error('The local model proposed a time that is not in the future. Please review the date and try again.');
    }
  }
  return validated.value;
}
