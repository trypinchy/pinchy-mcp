export interface Verdict {
  blocked: boolean;
  retryAfterSeconds: number;
}

const MAX_KEYS = 50_000;

/** Fixed window per key. Coarse on purpose: the API behind this keeps the precise, per-caller limits. */
export class RateLimit {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly clock: () => number = Date.now,
  ) {}

  hit(key: string): Verdict {
    const now = this.clock();
    const current = this.hits.get(key);
    if (!current || current.resetAt <= now) {
      if (this.hits.size >= MAX_KEYS) this.sweep(now);
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { blocked: false, retryAfterSeconds: 0 };
    }
    current.count += 1;
    const blocked = current.count > this.limit;
    return { blocked, retryAfterSeconds: blocked ? Math.ceil((current.resetAt - now) / 1000) : 0 };
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    // Still full after a sweep means a flood of fresh keys; forgetting them all beats growing without bound.
    if (this.hits.size >= MAX_KEYS) this.hits.clear();
  }
}
