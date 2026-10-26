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
