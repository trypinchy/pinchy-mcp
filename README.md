# pinchy-mcp

MCP server that finds coupon codes for any online store. Remote endpoint: `https://mcp.trypinchy.com/mcp`
(Streamable HTTP, no auth).

Shopping in a browser yourself? The same codes, tried for you at checkout:
[Pinchy – Coupon Finder & Auto Apply for Chrome](https://chromewebstore.google.com/detail/emkhelmjeeegfmhmohngacpbggbklnoi).

## Connect

```json
{ "mcpServers": { "pinchy": { "type": "http", "url": "https://mcp.trypinchy.com/mcp" } } }
```

Claude Code: `claude mcp add --transport http pinchy https://mcp.trypinchy.com/mcp`

Clients that only speak stdio can run the npm package instead:

```json
{ "mcpServers": { "pinchy": { "command": "npx", "args": ["-y", "pinchy-mcp"] } } }
```

## Tool

`find_coupons({ store, limit? })` — `store` is a domain or any URL on the store; `limit` defaults to 10 (max 50).
Returns `{ domain, storeName?, coupons: [{ code, description?, expiresAt?, successCount?, lastWorkedAt? }] }`,
ordered by how likely a code is to work. An unknown store returns an empty list.

## Run it yourself

```sh
pnpm install
pnpm dev          # http://127.0.0.1:4020/mcp
pnpm test
```

Config is read from the environment, see `.env.example`. The process binds to `127.0.0.1` and trusts
`CF-Connecting-IP` for rate limiting, so expose it only through a proxy that sets that header.

Privacy: the server receives a store domain and nothing else. https://api.trypinchy.com/v1/ext/privacy
