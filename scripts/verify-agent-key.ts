/** Read-only deployed smoke test. Supply VLIFE_AGENT_API_KEY securely via the environment. */
const key = Deno.env.get('VLIFE_AGENT_API_KEY');
const base = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
if (!key || !/^vlife_[a-f0-9]{64}$/.test(key) || !base) throw Error('Set SUPABASE_URL and VLIFE_AGENT_API_KEY; never put the key in command arguments.');
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
async function readResponse(url: string, body?: unknown) {
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw Error(`Connection check failed (HTTP ${res.status}); inspect connection configuration without logging credentials.`);
  const text = await res.text();
  try { return JSON.parse(text.startsWith('data: ') ? text.slice(6).trim() : text); }
  catch { throw Error('Connection returned an invalid protocol response'); }
}
const mcp = `${base}/functions/v1/mcp-server/mcp`;
let id = 0;
const rpc = (method: string, params: unknown) => readResponse(mcp, { jsonrpc: '2.0', id: ++id, method, params });
const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'v-life-key-verification', version: '1.0' } });
if (!init.result?.serverInfo) throw Error('MCP initialization did not return server info');
const tools = await rpc('tools/list', {});
if (!tools.result?.tools?.some((tool: { name: string }) => tool.name === 'agent_help')) throw Error('MCP tool discovery failed');
const help = await rpc('tools/call', { name: 'agent_help', arguments: {} });
if (!help.result?.structuredContent?.ok) throw Error('MCP guide did not complete');
const guide = await readResponse(`${base}/functions/v1/agent-api/api/v1/guide`);
if (!guide.ok || !guide.data?.session) throw Error('HTTP guide did not complete');
if (JSON.stringify(guide.data.session.permissions) !== JSON.stringify(help.result.structuredContent.data.session.permissions)) throw Error('HTTP and MCP permissions differ');
console.log(JSON.stringify({ status: 'passed', mcp: ['initialize', 'tools/list', 'agent_help'], http: 'guide', permissions: guide.data.session.permissions, writes: 0 }));
