import proposalJsonSchema from '../../schemas/interpretation-proposal.v1.schema.json';

export type InterpretationContext = {
  now: string;
  timeZone: string;
  locale: string;
};

export const proposalJsonSchemaForRequest = proposalJsonSchema;

/**
 * Compact line protocol for the on-device 0.6B model. The full provider-neutral
 * JSON schema consumes most of this model's context window, and even compact
 * JSON proved prone to punctuation errors. The fixed fields below are expanded
 * and validated before anything can reach persistence.
 */
export function localInterpretationMessages(transcript: string, context: InterpretationContext) {
  return [
    {
      role: 'system' as const,
      content:
        'Extract a schedule. Reply with one pipe-separated record and no other text. ' +
        'P has: P|intent|title|local datetime|frequency|interval|weekdays|times|duration. ' +
        'Use 0 for no interval/duration, blank for empty lists, Monday=1, and seconds 00. ' +
        'If date or time is missing reply C|start_date or start_time|question. ' +
        'If it is not a schedule reply U|non_scheduling_request|reason. Never invent a missing date or time.',
    },
    {
      role: 'user' as const,
      content: [
        `Reference: ${context.now} in ${context.timeZone}; locale ${context.locale}.`,
        'Example reference: 2030-05-01T12:00:00 in America/Toronto.',
        'Example request: Remind me to verify the build tomorrow at 9 AM',
        'Example answer: P|reminder|Verify the build|2030-05-02T09:00:00|none|0|||0',
        'Example request: Remind me tomorrow to call Sam',
        'Example answer: C|start_time|What time should I remind you?',
        'Example request: Tell me a joke',
        'Example answer: U|non_scheduling_request|This is not a scheduling request.',
        `Request: ${transcript} /no_think`,
        'Answer:',
      ].join('\n'),
    },
  ];
}

export function interpretationMessages(transcript: string, context: InterpretationContext) {
  return [
    {
      role: 'system' as const,
      content:
        'Convert one scheduling request to the supplied JSON contract. Output JSON only. Never invent a missing date or time. Use needs_clarification for one missing critical field and unsupported for schedules outside the schema. Seconds must be 00. Use ISO weekday numbers where Monday is 1. Do not include private text in warnings.',
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        reference_context: {
          now: context.now,
          time_zone: context.timeZone,
          locale: context.locale,
        },
        transcript,
        output_schema: proposalJsonSchema,
      }),
    },
  ];
}
