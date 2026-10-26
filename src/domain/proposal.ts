import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';

import proposalJsonSchema from '../../schemas/interpretation-proposal.v1.schema.json';

export type ProposalResult = 'proposal' | 'needs_clarification' | 'unsupported';
export type Intent = 'reminder' | 'event' | null;

export type Schedule = {
  start_local: string;
  time_zone: string;
  time_zone_policy: 'follow_device' | 'fixed';
  frequency: 'none' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  interval: number | null;
  weekdays: number[];
  times_of_day: string[];
  active_window: { start_time: string; end_time: string } | null;
  recurrence_anchor: 'fixed' | 'completion';
  stop: {
    kind: 'never' | 'on_date' | 'after_occurrences';
    on_date: string | null;
    after_occurrences: number | null;
  };
};

export type InterpretationProposal = {
  schema_version: '1.0.0';
  result: ProposalResult;
  intent: Intent;
  title: string | null;
  notes: string | null;
  schedule: Schedule | null;
  event: {
    end_local: string | null;
    duration_minutes: number | null;
    location: string | null;
    alert_offsets_minutes: number[];
  } | null;
  clarification: { field: string; question: string } | null;
  unsupported: { reason_code: string; message: string } | null;
  warnings: string[];
  field_confidences: Array<{
    field: string;
    confidence: 'high' | 'medium' | 'low';
    source_text: string | null;
  }>;
};

export type ValidationResult =
  | { ok: true; value: InterpretationProposal }
  | { ok: false; errors: string[] };

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile<InterpretationProposal>(proposalJsonSchema);
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/;
const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d:00$/;

function schemaError(error: ErrorObject): string {
  const location = error.instancePath || '/';
  return `${location} ${error.message ?? 'is invalid'}`;
}

function semanticErrors(value: InterpretationProposal): string[] {
  const errors: string[] = [];

  if (value.result === 'proposal') {
    if (!value.intent) errors.push('A proposal must have an intent.');
    if (!value.title?.trim()) errors.push('A proposal must have a non-empty title.');
    if (!value.schedule) errors.push('A proposal must have a schedule.');
    if (value.clarification || value.unsupported) {
      errors.push('A proposal cannot also be a clarification or unsupported result.');
    }
  } else if (value.result === 'needs_clarification') {
    if (!value.clarification) errors.push('A clarification result must ask one question.');
    if (value.unsupported) errors.push('A clarification result cannot be unsupported.');
  } else if (!value.unsupported) {
    errors.push('An unsupported result must include a reason.');
  }

  if (value.intent === 'event') {
    if (!value.event?.duration_minutes) errors.push('An event requires a duration.');
  } else if (value.event) {
    errors.push('Only an event may contain event details.');
  }

  const schedule = value.schedule;
  if (!schedule) return errors;

  if (!localDateTimePattern.test(schedule.start_local)) {
    errors.push('start_local must use YYYY-MM-DDTHH:mm:00.');
  }
  if (!schedule.times_of_day.every((time) => localTimePattern.test(time))) {
    errors.push('Every time of day must use HH:mm:00.');
  }
  if (schedule.frequency === 'none') {
    if (schedule.interval !== null) errors.push('A one-time schedule cannot have an interval.');
    if (
      schedule.weekdays.length > 0 ||
      schedule.times_of_day.length > 0 ||
      schedule.active_window ||
      schedule.stop.kind !== 'never'
    ) {
      errors.push('A one-time schedule cannot contain recurrence fields.');
    }
  } else if (schedule.interval === null) {
    errors.push('A recurring schedule requires an interval.');
  }
  if (schedule.frequency === 'week' && schedule.weekdays.length === 0) {
    errors.push('A weekly schedule requires at least one weekday.');
  }
  if (
    schedule.recurrence_anchor === 'completion' &&
    (value.intent !== 'reminder' || schedule.weekdays.length > 0 || schedule.times_of_day.length > 1)
  ) {
    errors.push('Completion-relative recurrence must be a reminder without calendar weekdays or multiple times.');
  }
  if (schedule.active_window) {
    if (schedule.frequency !== 'minute' && schedule.frequency !== 'hour') {
      errors.push('Active windows apply only to minute or hour intervals.');
    }
    if (schedule.active_window.start_time > schedule.active_window.end_time) {
      errors.push('Overnight active windows are unsupported.');
    }
  }
  if (schedule.stop.kind === 'never' && (schedule.stop.on_date || schedule.stop.after_occurrences)) {
    errors.push('A never-ending schedule cannot contain a stop value.');
  }
  if (schedule.stop.kind === 'on_date' && !schedule.stop.on_date) {
    errors.push('An on-date stop requires a date.');
  }
  if (schedule.stop.kind === 'after_occurrences' && !schedule.stop.after_occurrences) {
    errors.push('An occurrence-count stop requires a count.');
  }

  return errors;
}

export function validateProposal(input: unknown): ValidationResult {
  if (!validateSchema(input)) {
    return {
      ok: false,
      errors: (validateSchema.errors ?? []).map(schemaError),
    };
  }

  const errors = semanticErrors(input);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input };
}

export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  if (!candidate || !candidate.trim().startsWith('{')) {
    throw new Error('The interpreter did not return a JSON object.');
  }
  return JSON.parse(candidate);
}
