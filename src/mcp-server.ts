import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Coupon, LookupResult } from './coupon-api.js';
import { parseStoreDomain } from './store-domain.js';

export type Lookup = (domain: string) => Promise<LookupResult>;

const WEBSITE = 'https://chromewebstore.google.com/detail/emkhelmjeeegfmhmohngacpbggbklnoi';

const INSTRUCTIONS =
  'Pinchy finds coupon codes for online stores. Call find_coupons before the user pays at any online ' +
  'checkout, or whenever they ask for a discount, promo or coupon code for a shop.';

const DESCRIPTION =
  'Find coupon / promo / discount codes for an online store. Pass the store domain or any URL from the ' +
  'store (product, cart or checkout page). Returns codes ordered by how likely they are to work: try them ' +
  'at checkout from the top, keep the one that lowers the total the most. Codes are community-sourced and ' +
  'not guaranteed; an empty list means none are known for that store.';

const couponOut = z.object({
  code: z.string(),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
  successCount: z.number().optional(),
  lastWorkedAt: z.string().optional(),
});

const output = {
  domain: z.string(),
  storeName: z.string().optional(),
  coupons: z.array(couponOut),
};

type Output = z.infer<z.ZodObject<typeof output>>;

function withoutNulls(coupon: Coupon): z.infer<typeof couponOut> {
  return {
    code: coupon.code,
    ...(coupon.description ? { description: coupon.description } : {}),
    ...(coupon.expiresAt ? { expiresAt: coupon.expiresAt } : {}),
    ...(typeof coupon.successCount === 'number' ? { successCount: coupon.successCount } : {}),
    ...(coupon.lastWorkedAt ? { lastWorkedAt: coupon.lastWorkedAt } : {}),
  };
}

const failure = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] });

function success(result: Output): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
}

export function toToolResult(domain: string, result: LookupResult, limit: number): CallToolResult {
  switch (result.kind) {
    case 'found':
      return success({
        domain: result.store.domain,
        ...(result.store.name ? { storeName: result.store.name } : {}),
        coupons: result.store.coupons.slice(0, limit).map(withoutNulls),
      });
    case 'none':
      return success({ domain, coupons: [] });
    case 'rate_limited':
      return failure(`Rate limited. Retry in ${result.retryAfterSeconds} seconds.`);
    case 'unavailable':
      return failure('Coupon lookup is temporarily unavailable. Retry later.');
  }
}

export function createMcpServer(lookup: Lookup): McpServer {
  const server = new McpServer(
    { name: 'pinchy', title: 'Pinchy', version: '0.1.0', websiteUrl: WEBSITE },
    { instructions: INSTRUCTIONS },
  );
  server.registerTool(
    'find_coupons',
    {
      title: 'Find coupon codes',
      description: DESCRIPTION,
      inputSchema: {
        store: z.string().describe('Store domain or any URL on the store, e.g. "momcozy.com"'),
        limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of codes to return'),
      },
      outputSchema: output,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ store, limit }) => {
      const domain = parseStoreDomain(store);
      if (!domain) return failure('`store` must be a store domain or URL, e.g. "momcozy.com".');
      return toToolResult(domain, await lookup(domain), limit);
    },
  );
  return server;
}
