import { describe, expect, it } from 'vitest';
import { RateLimit } from './rate-limit.js';

describe('RateLimit', () => {
  it('blocks past the limit and tells the caller when to retry', () => {
    let now = 0;
    const limit = new RateLimit(2, 60_000, () => now);
    expect(limit.hit('a').blocked).toBe(false);
    expect(limit.hit('a').blocked).toBe(false);
    now = 15_000;
    expect(limit.hit('a')).toEqual({ blocked: true, retryAfterSeconds: 45 });
  });

  it('keeps callers apart and opens again after the window', () => {
    let now = 0;
    const limit = new RateLimit(1, 60_000, () => now);
    limit.hit('a');
    expect(limit.hit('a').blocked).toBe(true);
    expect(limit.hit('b').blocked).toBe(false);
    now = 60_000;
    expect(limit.hit('a').blocked).toBe(false);
  });
});
