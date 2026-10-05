import { assert, assertEquals } from 'jsr:@std/assert@1';
import { generateKeyPair, exportJWK, jwtVerify } from 'npm:jose@6';

Deno.env.set('SUPABASE_URL', 'https://agent-test.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
const pair = await generateKeyPair('ES256', { extractable: true });
Deno.env.set('AGENT_JWT_SIGNING_JWK', JSON.stringify({ ...await exportJWK(pair.privateKey), kid: 'test', alg: 'ES256' }));
const { handleRequest: mcp } = await import('./index.ts');
const { handleRequest: api } = await import('../agent-api/index.ts');
const apiKey = `vlife_${'b'.repeat(64)}`;
const identity = { user_id: 'ac000000-0000-4000-8000-000000000001', client_id: 'key_test', read_enabled: true, write_enabled: true, delete_enabled: false, expires_at: null, revoked_at: null };
const realFetch = globalThis.fetch;

async function fixture(run: (state: { grant: typeof identity | null; unavailable: boolean; calls: string[] }) => Promise<void>) {
  const state = { grant: identity as typeof identity | null, unavailable: false, calls: [] as string[] };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname;
    state.calls.push(path);
    if (path === '/rest/v1/rpc/agent_resolve_api_key') {
      assertEquals(req.headers.get('Authorization'), 'Bearer test-service-key');
      const body = await req.json();
      assert(/^[a-f0-9]{64}$/.test(body.p_key_hash));
      assert(!JSON.stringify(body).includes(apiKey));
      return state.unavailable ? Response.json({ message: 'database offline' }, { status: 503 }) : Response.json(state.grant);
    }
    const token = req.headers.get('Authorization')?.slice(7) ?? '';
    assert(token !== apiKey && token !== 'test-service-key');
    const { payload } = await jwtVerify(token, pair.publicKey, { issuer: 'https://agent-test.supabase.co/auth/v1', audience: 'authenticated' });
    assertEquals(payload.sub, identity.user_id); assertEquals(payload.client_id, 'key_test');
    assertEquals(payload.role, 'authenticated'); assertEquals(payload.agent_key_id, 'key_test');
    if (path === '/rest/v1/todos') return Response.json([{ id: 'bc000000-0000-4000-8000-000000000001', title: 'Test task', kind: 'once' }]);
    if (path === '/rest/v1/rpc/agent_mutate') return Response.json({ data: { id: 'bc000000-0000-4000-8000-000000000001', title: 'New task' } });
    if (path === '/rest/v1/rpc/agent_log_operation') return Response.json(null);
    if (path === '/rest/v1/rpc/task_business_date') return Response.json('2026-10-05');
    throw Error(`Unexpected request path ${path}`);
  };
  try { await run(state); } finally { globalThis.fetch = realFetch; }
}
function request(path: string, method = 'GET', body?: unknown, key = apiKey) {
  return new Request(`https://agent-test.supabase.co/functions/v1/${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
Deno.test('API Key authenticates HTTP read/write using user-scoped internal tokens', () => fixture(async state => {
  const read = await api(request('agent-api/api/v1/todo'));
  assertEquals(read.status, 200); assertEquals((await read.json()).data[0].title, 'Test task');
  const write = await api(request('agent-api/api/v1/todo', 'POST', { title: 'New task' }));
  assertEquals(write.status, 200); assertEquals((await write.json()).data.title, 'New task');
  state.grant = { ...identity, write_enabled: false };
  const blocked = await api(request('agent-api/api/v1/todo', 'POST', { title: 'Denied' }));
  assertEquals(blocked.status, 403); assertEquals((await blocked.json()).error.code, 'PERMISSION_DENIED');
}));
Deno.test('API Key completes MCP initialization, discovery, and a real tool handler without OAuth', () => fixture(async () => {
  for (const [method, params] of [
    ['initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'key-client', version: '1' } }],
    ['tools/list', {}], ['tools/call', { name: 'todo_list', arguments: {} }],
  ] as const) {
    const res = await mcp(request('mcp-server/mcp', 'POST', { jsonrpc: '2.0', id: 1, method, params }));
    assertEquals(res.status, 200);
    const raw = await res.text();
    const envelope = JSON.parse(raw.startsWith('data: ') ? raw.slice(6).trim() : raw);
    assert(envelope.result); assert(!raw.includes(apiKey));
    if (method === 'tools/call') assertEquals(envelope.result.structuredContent.ok, true);
  }
}));
Deno.test('both transports reject revoked keys, reject malformed keys, and report outages separately', () => fixture(async state => {
  for (const [handle, path, method] of [[api, 'agent-api/api/v1/todo', 'GET'], [mcp, 'mcp-server/mcp', 'POST']] as const) {
    state.grant = null;
    let res = await handle(request(path, method));
    assertEquals(res.status, 401); assertEquals((await res.json()).error.code, 'API_KEY_INVALID');
    assertEquals(res.headers.get('Cache-Control'), 'no-store');
    res = await handle(request(path, method, undefined, 'vlife_short'));
    assertEquals(res.status, 401);
    state.grant = identity; state.unavailable = true;
    res = await handle(request(path, method));
    assertEquals(res.status, 503); assertEquals((await res.json()).error.code, 'AUTH_SERVICE_UNAVAILABLE');
    state.unavailable = false;
  }
}));
Deno.test('unauthenticated OAuth discovery still works and origin checks also cover API keys', async () => {
  const res = await mcp(new Request('https://agent-test.supabase.co/functions/v1/mcp-server/mcp', { method: 'POST' }));
  assertEquals(res.status, 401); assert(res.headers.get('www-authenticate')?.includes('resource_metadata'));
  const blocked = request('agent-api/api/v1/todo'); blocked.headers.set('Origin', 'https://untrusted.test');
  assertEquals((await api(blocked)).status, 403);
});
