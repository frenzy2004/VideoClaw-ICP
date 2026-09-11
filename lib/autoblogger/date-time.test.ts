import { describe, expect, it } from 'vitest';

import { isStrictIsoDateTime, isoDateTimeToDateOnly } from './date-time';

describe('strict ISO date-time handling', () => {
  it.each([
    '2026-09-05',
    'September 5, 2026',
    '2026-02-30T10:00:00Z',
    '2026-09-05T25:00:00Z',
    '2026-09-05T10:00Z',
  ])('rejects loose or impossible value %s', (value) => {
    expect(isStrictIsoDateTime(value)).toBe(false);
  });

  it('normalizes an offset timestamp to its UTC date', () => {
    expect(isoDateTimeToDateOnly('2026-09-04T23:30:00-05:00')).toBe('2026-09-05');
  });
});
