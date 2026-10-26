import { Temporal } from '@js-temporal/polyfill';

export function localDateTimeToInstant(localDateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(localDateTime)
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' })
    .toInstant()
    .toString({ smallestUnit: 'millisecond' });
}

export function instantToDate(instant: string): Date {
  return new Date(Temporal.Instant.from(instant).epochMilliseconds);
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export type RelativeDateRequest =
  | { kind: 'tomorrow'; time: string }
  | { kind: 'bare_weekday' | 'this_weekday' | 'next_weekday'; isoWeekday: number; time: string };

export function resolveRelativeLocalDateTime(
  request: RelativeDateRequest,
  referenceUtc: string,
  timeZone: string,
): string | null {
  const reference = Temporal.Instant.from(referenceUtc);
  const localNow = reference.toZonedDateTimeISO(timeZone);
  const time = Temporal.PlainTime.from(request.time);
  if (request.kind === 'tomorrow') {
    return localNow.toPlainDate().add({ days: 1 }).toPlainDateTime(time).toString({ smallestUnit: 'second' });
  }
  if (!Number.isInteger(request.isoWeekday) || request.isoWeekday < 1 || request.isoWeekday > 7) {
    throw new Error('ISO weekday must be between 1 and 7.');
  }
  const weekStart = localNow.toPlainDate().subtract({ days: localNow.dayOfWeek - 1 });
  const thisWeek = weekStart.add({ days: request.isoWeekday - 1 }).toPlainDateTime(time);
  if (request.kind === 'next_weekday') return thisWeek.add({ weeks: 1 }).toString({ smallestUnit: 'second' });
  if (request.kind === 'this_weekday') {
    const instant = thisWeek.toZonedDateTime(timeZone, { disambiguation: 'compatible' }).toInstant();
    return Temporal.Instant.compare(instant, reference) > 0 ? thisWeek.toString({ smallestUnit: 'second' }) : null;
  }
  const dayDelta = (request.isoWeekday - localNow.dayOfWeek + 7) % 7 || 7;
  return localNow.toPlainDate().add({ days: dayDelta }).toPlainDateTime(time).toString({ smallestUnit: 'second' });
}
