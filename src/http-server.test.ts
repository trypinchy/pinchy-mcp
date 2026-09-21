import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { LookupResult } from './coupon-api.js';
import { createHttpServer } from './http-server.js';
import { RateLimit } from './rate-limit.js';

const closers: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function start(result: LookupResult, perMinute = 100) {
  const asked: string[] = [];
  const server = createHttpServer({
    lookupFor: () => async (domain) => {
      asked.push(domain);
      return result;
    },
    rateLimit: new RateLimit(perMinute),
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise((resolve) => server.close(resolve)));
  const url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
  return { url, asked };
}

async function connect(url: URL) {
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  closers.push(() => client.close());
  return client;
}

const found: LookupResult = {
  kind: 'found',
  store: {
    domain: 'shop.com',
    name: 'Shop',
    coupons: [
      { code: 'A', description: 'ten off', successCount: 9, expiresAt: null, lastWorkedAt: null },
      { code: 'B' },
      { code: 'C' },
    ],
  },
};

describe('MCP over HTTP', () => {
  it('advertises find_coupons as a read-only tool', async () => {
    const client = await connect((await start(found)).url);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['find_coupons']);
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
  });

  it('returns codes in upstream order, capped by limit, without null fields', async () => {
    const { url, asked } = await start(found);
    const client = await connect(url);
    const result = await client.callTool({
      name: 'find_coupons',
      arguments: { store: 'https://www.shop.com/cart', limit: 2 },
    });
    expect(asked).toEqual(['shop.com']);
    expect(result.structuredContent).toEqual({
      domain: 'shop.com',
      storeName: 'Shop',
      coupons: [{ code: 'A', description: 'ten off', successCount: 9 }, { code: 'B' }],
    });
  });

  it('answers an unknown store with an empty list, not an error', async () => {
    const client = await connect((await start({ kind: 'none' })).url);
    const result = await client.callTool({ name: 'find_coupons', arguments: { store: 'shop.com' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ domain: 'shop.com', coupons: [] });
  });

  it.each([
    ['input that is not a store', found, 'not a store'],
    ['an upstream outage', { kind: 'unavailable', reason: 'upstream 502' } as LookupResult, 'shop.com'],
  ])('flags %s as a tool error', async (_label, upstream, store) => {
    const client = await connect((await start(upstream)).url);
    const result = await client.callTool({ name: 'find_coupons', arguments: { store } });
    expect(result.isError).toBe(true);
  });

  it('does not leak the upstream failure reason to the agent', async () => {
    const client = await connect((await start({ kind: 'unavailable', reason: 'upstream 502' })).url);
    const result = await client.callTool({ name: 'find_coupons', arguments: { store: 'shop.com' } });
    expect(JSON.stringify(result.content)).not.toContain('502');
  });

  it('rejects callers past the per-minute limit with Retry-After', async () => {
    const { url } = await start(found, 1);
    const post = () => fetch(url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    await post();
    const second = await post();
    expect(second.status).toBe(429);
    expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('serves a health check and refuses non-POST on /mcp', async () => {
    const { url } = await start(found);
    expect((await fetch(new URL('/healthz', url))).status).toBe(200);
    expect((await fetch(url)).status).toBe(405);
  });

  it('serves the Glama ownership document', async () => {
    const { url } = await start(found);
    const response = await fetch(new URL('/.well-known/glama.json', url));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      $schema: 'https://glama.ai/mcp/schemas/connector.json',
      claim: 'glama_claim_OfFvXFi1S2ogIVmwRh25632EPPqKIBmr',
    });
  });
});
