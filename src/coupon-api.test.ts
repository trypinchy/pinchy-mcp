import { describe, expect, it, vi } from 'vitest';
import { lookupCoupons } from './coupon-api.js';

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);
const portWith = (response: Response | Error) => ({
  apiUrl: 'https://api.test',
  fetch: vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch,
});

describe('lookupCoupons', () => {
  it('asks for the domain on behalf of the calling client', async () => {
    const port = portWith(json({ success: true, store: null }));
    await lookupCoupons(port, 'shop.com', '203.0.113.9');
    const [url, init] = vi.mocked(port.fetch).mock.calls[0]!;
    expect(url).toBe('https://api.test/v1/ext/coupons?domain=shop.com');
    expect((init?.headers as Record<string, string>)['x-forwarded-for']).toBe('203.0.113.9');
  });

  it('sends no caller address when it runs on the caller\'s own machine', async () => {
    const port = portWith(json({ success: true, store: null }));
    await lookupCoupons(port, 'shop.com');
    expect(vi.mocked(port.fetch).mock.calls[0]![1]?.headers).toEqual({});
  });

  it('returns the store when codes exist', async () => {
    const store = { domain: 'shop.com', name: 'Shop', coupons: [{ code: 'SAVE10', successCount: 4 }] };
    const result = await lookupCoupons(portWith(json({ success: true, store })), 'shop.com', 'ip');
    expect(result).toMatchObject({ kind: 'found', store: { domain: 'shop.com' } });
  });

  it.each([
    ['no store', { success: true, store: null }],
    ['a store without codes', { success: true, store: { domain: 'shop.com', coupons: [] } }],
  ])('reads %s as none', async (_label, body) => {
    expect(await lookupCoupons(portWith(json(body)), 'shop.com', 'ip')).toEqual({ kind: 'none' });
  });

  it('passes the upstream retry hint through', async () => {
    const port = portWith(json({}, { status: 429, headers: { 'retry-after': '120' } }));
    expect(await lookupCoupons(port, 'shop.com', 'ip')).toEqual({ kind: 'rate_limited', retryAfterSeconds: 120 });
  });

  it.each([
    ['a 5xx', json({}, { status: 502 })],
    ['a body it does not recognise', json({ success: true, store: { coupons: 'nope' } })],
    ['a network failure', new TypeError('fetch failed')],
  ])('reports %s as unavailable instead of throwing', async (_label, response) => {
    expect((await lookupCoupons(portWith(response), 'shop.com', 'ip')).kind).toBe('unavailable');
  });
});
