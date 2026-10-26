import proposalJsonSchema from '../../schemas/interpretation-proposal.v1.schema.json';

export type InterpretationContext = {
  now: string;
  timeZone: string;
  locale: string;
};

export const proposalJsonSchemaForRequest = proposalJsonSchema;

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
