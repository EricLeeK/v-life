import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODULES, agentMetaOf } from "../_shared/moduleRegistry.ts";
import { createAgentDataService, AgentDataError, type AgentContext } from "../_shared/agentDataService.ts";
import { buildCapabilities, MCP_VERSION, oauthChallenge } from "./mcpAdapter.ts";

const app = new Hono();
const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const authServer = `${url}/auth/v1`;

const json = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  structuredContent: value,
  isError,
});
function errorResult(error: unknown) {
  const e = error instanceof AgentDataError ? error : new AgentDataError("INTERNAL_ERROR", String(error));
  return json({ ok: false, error: { code: e.code, message: e.message, details: e.details } }, true);
}
function tokenPayload(token: string): Record<string, unknown> {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; }
}

async function authenticate(req: Request): Promise<{ context: AgentContext } | { response: Response }> {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return { response: oauthChallenge(`${url}/functions/v1/mcp-server/mcp`) };
  const token = authorization.slice(7).trim();
  const db = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return { response: oauthChallenge(`${url}/functions/v1/mcp-server/mcp`) };
  const claims = tokenPayload(token);
  const clientId = typeof claims.client_id === "string" ? claims.client_id : typeof claims.clientId === "string" ? claims.clientId : undefined;
  if (!clientId) return { response: new Response(JSON.stringify({ error: { code: "CLIENT_ID_REQUIRED", message: "OAuth client_id claim is required" } }), { status: 403, headers: { "content-type": "application/json" } }) };
  const { data: policy, error: policyError } = await db.from("agent_client_access").select("read_enabled, write_enabled, delete_enabled, revoked_at").eq("user_id", user.id).eq("client_id", clientId).maybeSingle();
  if (policyError || !policy || policy.revoked_at) return { response: new Response(JSON.stringify({ error: { code: "AGENT_REVOKED", message: "Agent access is not approved or has been revoked" } }), { status: 403, headers: { "content-type": "application/json" } }) };
  return { context: { db, userId: user.id, clientId, permissions: { read: policy.read_enabled !== false, write: policy.write_enabled === true, delete: policy.delete_enabled === true } } };
}

function schema(fields: string[], required: string[] = []) {
  return { type: "object" as const, properties: Object.fromEntries(fields.map((f) => [f, { type: "string", description: f }])), required };
}
function registerServer(context: AgentContext) {
  const server = new McpServer({ name: "vlife-manager", version: MCP_VERSION });
  const service = createAgentDataService(context);
  for (const mod of MODULES.filter((m) => agentMetaOf(m).agentVisible && m.key !== "daily_task")) {
    const meta = agentMetaOf(mod);
    server.tool(`${mod.key}_list`, { description: `列出${mod.labelZh}记录`, inputSchema: { type: "object", properties: { limit: { type: "number" }, ...Object.fromEntries(meta.readFields.map((f) => [f, { type: "string" }])) } } , handler: async (p: any) => { try { return json({ ok: true, data: (await service.list(mod.key, { limit: p.limit, filters: Object.fromEntries(Object.entries(p).filter(([k, v]) => k !== "limit" && v !== undefined && meta.readFields.includes(k))) })).data }); } catch (e) { return errorResult(e); } }});
    server.tool(`${mod.key}_search`, { description: `搜索${mod.labelZh}`, inputSchema: schema(["keyword"], ["keyword"]) , handler: async (p: any) => { try { return json({ ok: true, data: (await service.list(mod.key, { limit: 50 })).data.filter((row: any) => String(row[mod.executor?.nameField ?? "name"] ?? "").toLowerCase().includes(String(p.keyword).toLowerCase())).slice(0, 3) }); } catch (e) { return errorResult(e); } }});
    server.tool(`${mod.key}_get`, { description: `获取${mod.labelZh}`, inputSchema: schema(["id"], ["id"]) , handler: async (p: any) => { try { return json({ ok: true, ...(await service.get(mod.key, p.id)) }); } catch (e) { return errorResult(e); } }});
    server.tool(`${mod.key}_create`, { description: `新增${mod.labelZh}`, inputSchema: { type: "object", properties: Object.fromEntries(meta.writeFields.map((f) => [f, { type: "string" }])) } , handler: async (p: any) => { try { return json({ ok: true, ...(await service.create(mod.key, p)) }); } catch (e) { return errorResult(e); } }});
    server.tool(`${mod.key}_update`, { description: `更新${mod.labelZh}`, inputSchema: { type: "object", properties: { id: { type: "string" }, ...Object.fromEntries(meta.writeFields.map((f) => [f, { type: "string" }])) }, required: ["id"] } , handler: async ({ id, ...p }: any) => { try { return json({ ok: true, ...(await service.update(mod.key, id, p)) }); } catch (e) { return errorResult(e); } }});
    server.tool(`${mod.key}_delete`, { description: `删除${mod.labelZh}`, inputSchema: schema(["id"], ["id"]) , handler: async (p: any) => { try { return json({ ok: true, ...(await service.delete(mod.key, p.id)) }); } catch (e) { return errorResult(e); } }});
  }
  server.resource("vlife://capabilities", { description: "V-Life Agent 数据能力与字段白名单", mimeType: "application/json" }, async () => ({ contents: [{ type: "text", uri: "vlife://capabilities", mimeType: "application/json", text: JSON.stringify(buildCapabilities()) }] }));
  server.tool("data_export", { description: "导出经过字段白名单和脱敏的数据", inputSchema: { type: "object", properties: { modules: { type: "array" } } } , handler: async (p: any) => { try { if (!context.permissions.read) throw new AgentDataError("PERMISSION_DENIED", "read permission is required"); const keys = Array.isArray(p.modules) ? p.modules : MODULES.map((m) => m.key); const data: Record<string, unknown> = {}; for (const key of keys) { const mod = MODULES.find((m) => m.key === key); if (!mod || !agentMetaOf(mod).exportable) continue; data[key] = (await service.list(key)).data; } return json({ ok: true, data }); } catch (e) { return errorResult(e); } }});
  return server;
}

app.get("/.well-known/oauth-protected-resource", (c) => c.json({ resource: `${url}/functions/v1/mcp-server/mcp`, authorization_servers: [authServer], bearer_methods_supported: ["header"] }));
app.all("/mcp", async (c) => { const auth = await authenticate(c.req.raw); if ("response" in auth) return auth.response; const server = registerServer(auth.context); const transport = new StreamableHttpTransport({ allowedOrigins: [new URL(c.req.url).origin], allowedHosts: [new URL(c.req.url).host] }); const handler = transport.bind(server); return await handler(c.req.raw); });
app.all("/", async (c) => c.redirect("/mcp", 308));
app.all("/*", async (c) => c.redirect("/mcp", 308));
Deno.serve(app.fetch);
