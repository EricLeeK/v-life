/** Access grants and idempotent mutation adapter for agent-facing functions. */

export type AgentOperation = "read" | "write" | "delete";
export type AgentGrant = { read_enabled: boolean; write_enabled: boolean; delete_enabled: boolean; revoked_at?: string | null };
export type AgentDb = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };

export function assertBrowserMayManageAccess(clientId: string | null | undefined): void {
  if (clientId) throw new Error("BROWSER_SESSION_REQUIRED");
}

export function assertAgentOperationAllowed(grant: AgentGrant | null | undefined, operation: AgentOperation): void {
  const field = `${operation}_enabled` as keyof AgentGrant;
  if (!grant || grant.revoked_at || grant[field] !== true) throw new Error("AGENT_ACCESS_DENIED");
}

/** Stable JSON used by the database RPC to bind an idempotency key to payload. */
export function canonicalizePayload(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizePayload).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalizePayload(obj[k])}`).join(",")}}`;
}

export async function hashIdempotencyPayload(payload: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalizePayload(payload)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface AgentMutation {
  module: string; operation: "create" | "update" | "delete"; id?: string | null;
  payload: unknown; key: string | null; requestId: string; toolName: string;
}

/** Identity, hashing, replay detection and auditing belong to the atomic SQL RPC. */
export async function mutateIdempotently(db: AgentDb, input: AgentMutation): Promise<unknown> {
  const { data, error } = await db.rpc("agent_mutate", {
    p_module: input.module, p_operation: input.operation, p_record_id: input.id ?? null,
    p_payload: input.payload, p_idempotency_key: input.key, p_request_id: input.requestId,
    p_tool_name: input.toolName,
  });
  if (error) throw Object.assign(new Error(error.message), { code: error.code ?? "AGENT_MUTATION_FAILED" });
  return data;
}
