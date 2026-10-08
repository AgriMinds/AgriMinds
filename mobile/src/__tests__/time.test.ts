import { relativeTime } from '@/utils/time';

const NOW = 1_700_000_000_000;

describe('relativeTime', () => {
  it('buckets by minutes, hours and days', () => {
    expect(relativeTime(NOW - 10_000, NOW)).toEqual({ unit: 'now' });
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toEqual({ unit: 'minutes', n: 5 });
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toEqual({ unit: 'hours', n: 3 });
    expect(relativeTime(NOW - 49 * 3_600_000, NOW)).toEqual({ unit: 'days', n: 2 });
  });
  it('never goes negative for future timestamps', () => {
    expect(relativeTime(NOW + 60_000, NOW)).toEqual({ unit: 'now' });
  });
});
