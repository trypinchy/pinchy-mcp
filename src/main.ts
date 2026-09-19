import { readConfig } from './config.js';
import { lookupCoupons } from './coupon-api.js';
import { createHttpServer } from './http-server.js';
import { RateLimit } from './rate-limit.js';

const config = readConfig(process.env);
const port = { fetch, apiUrl: config.apiUrl };

const server = createHttpServer({
  lookupFor: (clientIp) => (domain) => lookupCoupons(port, domain, clientIp),
  rateLimit: new RateLimit(config.rateLimitPerMinute),
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(JSON.stringify({ msg: 'pinchy-mcp listening', port: config.port, apiUrl: config.apiUrl }));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
