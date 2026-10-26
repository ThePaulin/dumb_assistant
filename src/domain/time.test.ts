import { describe, expect, it } from 'vitest';

import { localDateTimeToInstant } from './time';

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
