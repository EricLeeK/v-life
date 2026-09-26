import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { StreamableHttpTransport } from 'mcp-lite';
import { serverFor } from './index.ts';
import type { AgentContext } from '../_shared/agentDataService.ts';

function fixture(rows: Record<string, unknown>[] = [], read = true) {
  const calls: unknown[][] = [];
  const q: any = {};
  let start = 0, end = 200;
  for (const method of ['select', 'eq', 'gte', 'lte', 'order']) {
    q[method] = (...args: unknown[]) => { calls.push([method, ...args]); return q; };
  }
  q.range = (a: number, b: number) => { start = a; end = b; return q; };
  q.then = (resolve: any) => Promise.resolve({data: rows.slice(start, end + 1), error: null}).then(resolve);
  const db: any = {from: () => q, rpc: async () => ({error: null})};
  const ctx: AgentContext = {db, userId: 'test-user', requestId: 'test-request', permissions: {read, write: false, delete: false}};
  const handle = new StreamableHttpTransport().bind(serverFor(ctx, null));
  async function call(args?: unknown, method = 'tools/call') {
    const response = await handle(new Request('http://localhost/mcp', {
      method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params: method === 'tools/call' ? {name: 'finance_summary', ...(args === undefined ? {} : {arguments: args})} : {}}),
    }));
    const text = await response.text();
    const envelope = JSON.parse(text.startsWith('data: ') ? text.slice(6).trim() : text);
    return envelope.result;
  }
  return {call, calls};
}

Deno.test('finance_summary accepts no arguments and returns zero for an empty month', async () => {
  const {call, calls} = fixture();
  const result = await call({});
  assertEquals(result.structuredContent.ok, true);
  assertEquals(result.structuredContent.data, {count: 0, total_cny: 0, by_category: {}});
  assert(calls.some(c => c[0] === 'gte' && c[1] === 'date'));
});
Deno.test('finance_summary accepts an explicit date range', async () => {
  const {call, calls} = fixture();
  const result = await call({date_from: '2026-09-01', date_to: '2026-09-24'});
  assertEquals(result.structuredContent.ok, true);
  assert(calls.some(c => JSON.stringify(c) === JSON.stringify(['gte', 'date', '2026-09-01'])));
  assert(calls.some(c => JSON.stringify(c) === JSON.stringify(['lte', 'date', '2026-09-24'])));
});
Deno.test('finance_summary preserves year/month and leap-year boundaries', async () => {
  const {call, calls} = fixture();
  assertEquals((await call({year: 2024, month: 2})).structuredContent.ok, true);
  assert(calls.some(c => JSON.stringify(c) === JSON.stringify(['lte', 'date', '2024-02-29'])));
});
Deno.test('finance_summary sums stored CNY amounts across currencies and all pages', async () => {
  const rows = Array.from({length: 205}, (_, i) => ({id: String(i), currency: i % 2 ? 'JPY' : 'CNY', amount: 100, amount_cny: i % 2 ? 5 : 100, category: '餐饮'}));
  const {call, calls} = fixture(rows);
  const result = await call({year: 2026, month: 9});
  assertEquals(result.structuredContent.data, {count: 205, total_cny: 10810, by_category: {'餐饮': 10810}});
  assert(calls.some(c => JSON.stringify(c) === JSON.stringify(['eq', 'user_id', 'test-user'])));
});
Deno.test('finance_summary invalid arguments return INVALID_INPUT before querying', async () => {
  for (const args of [{year: 2026}, {month: 9}, {year: 2026, month: 13}, {year: '2026', month: 9}, {date_from: '2026-02-30'}, {date_from: '2026-09-24', date_to: '2026-09-01'}, {year: 2026, month: 9, date_from: '2026-09-01'}, {unexpected: true}]) {
    const {call, calls} = fixture();
    const result = await call(args);
    assertEquals(result.structuredContent.error.code, 'INVALID_INPUT', JSON.stringify(args));
    assertEquals(calls.length, 0);
  }
});
Deno.test('finance_summary respects denied read permission', async () => {
  const {call} = fixture([], false);
  assertEquals((await call({year: 2026, month: 9})).structuredContent.error.code, 'PERMISSION_DENIED');
});
Deno.test('finance_summary advertises optional month and date range inputs', async () => {
  const {call} = fixture();
  const result = await call({}, 'tools/list');
  const schema = result.tools.find((t: any) => t.name === 'finance_summary').inputSchema;
  assertEquals(schema.required ?? [], []);
  assert('date_from' in schema.properties && 'date_to' in schema.properties);
});

Deno.test('finance_summary accepts omitted MCP arguments', async () => {
  const {call} = fixture();
  const result = await call();
  assert(result, 'Expected a tool result, not a JSON-RPC internal error');
  assertEquals(result.structuredContent.ok, true);
});
