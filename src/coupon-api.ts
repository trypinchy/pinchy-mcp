import { z } from 'zod';

const couponSchema = z.object({
  code: z.string(),
  description: z.string().nullish(),
  expiresAt: z.string().nullish(),
  successCount: z.number().nullish(),
  lastWorkedAt: z.string().nullish(),
});

const responseSchema = z.object({
  success: z.literal(true),
  store: z
    .object({
      domain: z.string(),
      name: z.string().nullish(),
      coupons: z.array(couponSchema),
      fetchedAt: z.string().nullish(),
    })
    .nullable(),
});

export type Coupon = z.infer<typeof couponSchema>;
export type Store = NonNullable<z.infer<typeof responseSchema>['store']>;

export type LookupResult =
  | { kind: 'found'; store: Store }
  | { kind: 'none' }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'unavailable'; reason: string };

export interface LookupPort {
  fetch: typeof fetch;
  apiUrl: string;
}

export async function lookupCoupons(port: LookupPort, domain: string, clientIp: string): Promise<LookupResult> {
  const url = `${port.apiUrl}/v1/ext/coupons?domain=${encodeURIComponent(domain)}`;
  try {
    // The API limits per caller; without this every agent would share this process's single bucket.
    const response = await port.fetch(url, {
      headers: { 'x-forwarded-for': clientIp },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 429) {
      return { kind: 'rate_limited', retryAfterSeconds: Number(response.headers.get('retry-after')) || 60 };
    }
    if (!response.ok) return { kind: 'unavailable', reason: `upstream ${response.status}` };
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return { kind: 'unavailable', reason: 'unexpected upstream shape' };
    const store = parsed.data.store;
    return store && store.coupons.length ? { kind: 'found', store } : { kind: 'none' };
  } catch (error) {
    return { kind: 'unavailable', reason: error instanceof Error ? error.name : 'fetch failed' };
  }
}
