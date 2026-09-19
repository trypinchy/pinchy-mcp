#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readConfig } from './config.js';
import { lookupCoupons } from './coupon-api.js';
import { createMcpServer } from './mcp-server.js';

const port = { fetch, apiUrl: readConfig(process.env).apiUrl };
const server = createMcpServer((domain) => lookupCoupons(port, domain));
await server.connect(new StdioServerTransport());
