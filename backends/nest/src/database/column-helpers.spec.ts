import { describe, expect, it } from '@jest/globals';
import { formatSqliteTimestamp } from './column-helpers';

describe('formatSqliteTimestamp', () => {
  it('matches seed format and preserves lexical time order', () => {
    const seed = '2026-07-13T01:00:00+00:00';
    const appLater = formatSqliteTimestamp(new Date('2026-07-13T23:00:00Z'));
    expect(appLater).toBe('2026-07-13T23:00:00+00:00');
    expect(seed < appLater).toBe(true);
  });

  it('trims trailing fractional zeros', () => {
    expect(formatSqliteTimestamp(new Date('2026-07-13T10:00:00.120Z'))).toBe(
      '2026-07-13T10:00:00.12+00:00',
    );
  });
});
