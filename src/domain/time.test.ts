import { describe, expect, it } from 'vitest';

import { localDateTimeToInstant, resolveRelativeLocalDateTime } from './time';

describe('localDateTimeToInstant', () => {
  it('converts a Toronto wall time to UTC', () => {
    expect(localDateTimeToInstant('2026-10-27T15:00:00', 'America/Toronto')).toBe(
      '2026-10-27T19:00:00.000Z',
    );
  });

  it('uses compatible DST disambiguation for a skipped time', () => {
    expect(localDateTimeToInstant('2026-03-08T02:30:00', 'America/Toronto')).toBe(
      '2026-03-08T07:30:00.000Z',
    );
  });

  it('rejects an invalid IANA time zone', () => {
    expect(() => localDateTimeToInstant('2026-10-27T15:00:00', 'Mars/Olympus')).toThrow();
  });
});

describe('resolveRelativeLocalDateTime', () => {
  const reference = '2026-10-26T17:00:00Z'; // Monday, 1 PM in Toronto

  it('resolves tomorrow as the next local calendar day', () => {
    expect(resolveRelativeLocalDateTime({ kind: 'tomorrow', time: '09:00:00' }, reference, 'America/Toronto')).toBe('2026-10-27T09:00:00');
  });

  it('resolves a bare weekday to its next future occurrence, never today', () => {
    expect(resolveRelativeLocalDateTime({ kind: 'bare_weekday', isoWeekday: 1, time: '15:00:00' }, reference, 'America/Toronto')).toBe('2026-11-02T15:00:00');
  });

  it('resolves this weekday only when its local instant is still future', () => {
    expect(resolveRelativeLocalDateTime({ kind: 'this_weekday', isoWeekday: 5, time: '09:00:00' }, reference, 'America/Toronto')).toBe('2026-10-30T09:00:00');
    expect(resolveRelativeLocalDateTime({ kind: 'this_weekday', isoWeekday: 1, time: '09:00:00' }, reference, 'America/Toronto')).toBeNull();
  });

  it('resolves next weekday in the following ISO week', () => {
    expect(resolveRelativeLocalDateTime({ kind: 'next_weekday', isoWeekday: 5, time: '09:00:00' }, reference, 'America/Toronto')).toBe('2026-11-06T09:00:00');
  });
});
