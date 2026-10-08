export type RelativeTime =
  | { unit: 'now' }
  | { unit: 'minutes'; n: number }
  | { unit: 'hours'; n: number }
  | { unit: 'days'; n: number };

/** Coarse relative time used by the offline banner. `now` is injectable for tests. */
export function relativeTime(timestampMs: number, now: number = Date.now()): RelativeTime {
  const diffMin = Math.max(0, Math.floor((now - timestampMs) / 60_000));
  if (diffMin < 1) return { unit: 'now' };
  if (diffMin < 60) return { unit: 'minutes', n: diffMin };
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return { unit: 'hours', n: hours };
  return { unit: 'days', n: Math.floor(hours / 24) };
}
