import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer, type Lookup } from './mcp-server.js';
import type { RateLimit } from './rate-limit.js';

export interface HttpDeps {
  lookupFor: (clientIp: string) => Lookup;
  rateLimit: RateLimit;
}

const MAX_BODY_BYTES = 64 * 1024;

export function clientIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  return req.socket.remoteAddress ?? 'unknown';
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers }).end(JSON.stringify(body));
}

const rpcError = (message: string) => ({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });

async function readJson(req: IncomingMessage): Promise<unknown | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

async function handleMcp(deps: HttpDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Stateless: no sessions to resume, so there is no server-initiated stream to open or close.
  if (req.method !== 'POST') return sendJson(res, 405, rpcError('Method not allowed'), { allow: 'POST' });
  const ip = clientIp(req);
  const verdict = deps.rateLimit.hit(ip);
  if (verdict.blocked) {
    return sendJson(res, 429, rpcError('Too many requests'), { 'retry-after': String(verdict.retryAfterSeconds) });
  }
  const body = await readJson(req);
  if (body === undefined) return sendJson(res, 400, rpcError('Invalid JSON body'));

  const server = createMcpServer(deps.lookupFor(ip));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.once('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

export function createHttpServer(deps: HttpDeps): Server {
  return createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/healthz') return sendJson(res, 200, { ok: true });
    if (path !== '/mcp') return sendJson(res, 404, { error: 'Not found. The MCP endpoint is POST /mcp.' });
    handleMcp(deps, req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, rpcError('Internal server error'));
      else res.end();
    });
  });
}
