/** User-scoped domain data operations shared by MCP and future HTTP adapters. */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { agentMetaOf, moduleByKey, type ModuleDef } from "./moduleRegistry.ts";

export interface AgentContext {
  db: SupabaseClient;
  userId: string;
  clientId?: string;
  permissions: { read: boolean; write: boolean; delete: boolean };
}

export type AgentDataResult<T = Record<string, unknown>> = { data: T; count?: number };

export class AgentDataError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "AgentDataError";
  }
}

const fail = (code: string, message: string, details?: unknown): never => {
  throw new AgentDataError(code, message, details);
};

function moduleOrFail(key: string): ModuleDef {
  const mod = moduleByKey[key];
  if (!mod || !agentMetaOf(mod).agentVisible) fail("MODULE_NOT_FOUND", `Unknown or unavailable module: ${key}`);
  return mod;
}

function projection(mod: ModuleDef, includeId = true): string {
  const meta = agentMetaOf(mod);
  const fields = meta.readFields.filter((f) => !meta.sensitiveFields.includes(f));
  if (includeId && !fields.includes("id")) fields.unshift("id");
  return fields.join(",") || "id";
}

function redact(mod: ModuleDef, row: Record<string, unknown>): Record<string, unknown> {
  const meta = agentMetaOf(mod);
  const allowed = new Set(["id", ...meta.readFields]);
  for (const field of meta.sensitiveFields) allowed.delete(field);
  return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
}

function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT", "Data must be an object");
  return value as Record<string, unknown>;
}

function sanitizeInput(mod: ModuleDef, value: unknown, operation: "create" | "update"): Record<string, unknown> {
  const input = assertObject(value);
  if (Object.prototype.hasOwnProperty.call(input, "user_id")) fail("USER_ID_FORBIDDEN", "user_id is assigned from the authenticated context");
  const meta = agentMetaOf(mod);
  const fields = new Set(operation === "create" ? meta.createFields : meta.updateFields);
  const unknown = Object.keys(input).filter((key) => !fields.has(key));
  if (unknown.length) fail("FIELD_NOT_ALLOWED", `Fields are not writable: ${unknown.join(", ")}`, { fields: unknown });
  const defs = new Map(mod.fields.map(f => [f.name, f]));
  for (const [key, value] of Object.entries(input)) { const def = defs.get(key); if (def && value !== undefined && def.type !== "array" && ((def.type === "number" && typeof value !== "number") || (def.type === "boolean" && typeof value !== "boolean") || ((def.type === "string" || def.type === "date" || def.type === "datetime") && typeof value !== "string"))) fail("INVALID_INPUT", `Invalid type for ${key}`); }
  if (operation === "create") for (const f of mod.fields) if (f.required && !f.internal && !f.updateOnly && (input[f.name] === undefined || input[f.name] === null || input[f.name] === "")) fail("INVALID_INPUT", `Missing required field: ${f.name}`);
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
}

async function resolveRelation(ctx: AgentContext, mod: ModuleDef, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const relation = mod.executor?.resolves;
  if (!relation || payload[relation.from] === undefined || payload[relation.from] === null || payload[relation.from] === "") return payload;
  const target = moduleByKey[Object.keys(moduleByKey).find(k => moduleByKey[k].table === relation.targetTable) ?? ""];
  const query = ctx.db.from(relation.targetTable).select("id").eq(relation.targetField, payload[relation.from]);
  const scoped = target?.executor?.needsUserId ? query.eq("user_id", ctx.userId) : query;
  const { data, error } = await scoped;
  if (error) fail("RELATION_LOOKUP_FAILED", error.message);
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length === 0) fail("RELATION_NOT_FOUND", `No ${relation.targetTable} matched ${relation.from}`);
  if (rows.length > 1) fail("RELATION_AMBIGUOUS", `Multiple ${relation.targetTable} records matched ${relation.from}`);
  const next = { ...payload, [relation.toColumn]: rows[0].id };
  delete next[relation.from];
  return next;
}

function scopedQuery(ctx: AgentContext, mod: ModuleDef): any {
  return ctx.db.from(mod.table);
}

function applyScope(query: any, ctx: AgentContext, mod: ModuleDef): any {
  return query.eq("user_id", ctx.userId);
}

export function createAgentDataService(ctx: AgentContext) {
  const requirePermission = (permission: "read" | "write" | "delete") => {
    if (!ctx.permissions[permission]) fail("PERMISSION_DENIED", `${permission} permission is required`);
  };

  return {
    async list(key: string, options: { limit?: number; filters?: Record<string, unknown> } = {}): Promise<AgentDataResult<Record<string, unknown>[]>> {
      requirePermission("read");
      const mod = moduleOrFail(key);
      let q = applyScope(scopedQuery(ctx, mod).select(projection(mod)), ctx, mod);
      const allowed = new Set(agentMetaOf(mod).readFields);
      for (const [field, value] of Object.entries(options.filters ?? {})) {
        if (!allowed.has(field)) fail("FIELD_NOT_ALLOWED", `Field is not readable: ${field}`);
        if (value !== undefined && value !== null) q = q.eq(field, value);
      }
      const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
      const { data, error } = await q.limit(limit);
      if (error) fail("DATABASE_ERROR", error.message);
      return { data: ((data ?? []) as Record<string, unknown>[]).map((row) => redact(mod, row)) };
    },

    async get(key: string, id: string): Promise<AgentDataResult> {
      requirePermission("read");
      const mod = moduleOrFail(key);
      const { data, error } = await applyScope(scopedQuery(ctx, mod).select(projection(mod)), ctx, mod).eq("id", id).maybeSingle();
      if (error) fail("DATABASE_ERROR", error.message);
      if (!data) fail("NOT_FOUND", `Record not found: ${id}`);
      return { data: redact(mod, data as unknown as Record<string, unknown>) };
    },

    async create(key: string, input: unknown): Promise<AgentDataResult> {
      requirePermission("write");
      const mod = moduleOrFail(key);
      if (!mod.actions.create) fail("ACTION_NOT_ALLOWED", `Create is not allowed for ${key}`);
      let payload = sanitizeInput(mod, input, "create");
      payload = await resolveRelation(ctx, mod, payload);
      if (mod.key === "finance" && payload.currency === "JPY") {
        const settings = await ctx.db.from("settings").select("exchange_rate_jpy_to_cny").eq("user_id", ctx.userId).limit(1).maybeSingle();
        if (settings.error) fail("DATABASE_ERROR", settings.error.message);
        const rate = Number(settings.data?.exchange_rate_jpy_to_cny) || 0.048;
        payload.exchange_rate = rate;
        payload.amount_cny = Number((Number(payload.amount) * rate).toFixed(2));
      } else if (mod.key === "finance" && payload.currency === "CNY") { payload.exchange_rate = 1; payload.amount_cny = Number(payload.amount); }
      if (mod.executor?.needsUserId) payload.user_id = ctx.userId;
      let mutation: any = ctx.db.from(mod.table).insert(payload);
      if (mod.key === "habit_log") mutation = ctx.db.from(mod.table).upsert(payload, { onConflict: "todo_id,log_date" });
      const { data, error } = await mutation.select(projection(mod)).single();
      if (error) fail("DATABASE_ERROR", error.message);
      return { data: redact(mod, data as unknown as Record<string, unknown>) };
    },

    async update(key: string, id: string, input: unknown): Promise<AgentDataResult> {
      requirePermission("write");
      const mod = moduleOrFail(key);
      if (!mod.actions.update) fail("ACTION_NOT_ALLOWED", `Update is not allowed for ${key}`);
      let payload = sanitizeInput(mod, input, "update");
      payload = await resolveRelation(ctx, mod, payload);
      const { data, error } = await applyScope(scopedQuery(ctx, mod).update(payload), ctx, mod).eq("id", id).select(projection(mod)).maybeSingle();
      if (error) fail("DATABASE_ERROR", error.message);
      if (!data) fail("NOT_FOUND", `Record not found: ${id}`);
      return { data: redact(mod, data as Record<string, unknown>) };
    },

    async summary(key: string, options: { filters?: Record<string, unknown> } = {}): Promise<AgentDataResult<Record<string, unknown>>> {
      const result = await this.list(key, { ...options, limit: 200 });
      return { data: { module: key, count: result.data.length, records: result.data } };
    },
    async search(key: string, query: string, options: { limit?: number } = {}): Promise<AgentDataResult<Record<string, unknown>[]>> {
      const mod = moduleOrFail(key); requirePermission("read"); const field = mod.executor?.nameField ?? mod.fields.find(f => f.type === "string")?.name;
      if (!field) fail("INVALID_INPUT", `Module ${key} has no searchable text field`);
      let q = applyScope(scopedQuery(ctx, mod).select(projection(mod)), ctx, mod).ilike(field, `%${query}%`).limit(Math.min(options.limit ?? 50, 200));
      const { data, error } = await q; if (error) fail("DATABASE_ERROR", error.message);
      return { data: ((data ?? []) as Record<string, unknown>[]).map(row => redact(mod, row)) };
    },
    async export(key: string, options: { filters?: Record<string, unknown>; limit?: number } = {}): Promise<AgentDataResult<Record<string, unknown>[]>> {
      const mod = moduleOrFail(key); if (!agentMetaOf(mod).exportable) fail("EXPORT_NOT_ALLOWED", `Export is not allowed for ${key}`);
      const requested = options.limit ?? 200; if (requested > 200) fail("EXPORT_REQUIRES_PAGING", "Export must be paged with limit <= 200");
      return this.list(key, { filters: options.filters, limit: requested });
    },

    async delete(key: string, id: string): Promise<AgentDataResult<{ id: string }>> {
      requirePermission("delete");
      const mod = moduleOrFail(key);
      if (!mod.actions.delete) fail("ACTION_NOT_ALLOWED", `Delete is not allowed for ${key}`);
      const { data, error } = await applyScope(scopedQuery(ctx, mod).delete(), ctx, mod).eq("id", id).select("id").maybeSingle();
      if (error) fail("DATABASE_ERROR", error.message);
      if (!data) fail("NOT_FOUND", `Record not found: ${id}`);
      return { data: data as { id: string } };
    },
  };
}

export const projectAgentFields = (key: string, row: Record<string, unknown>) => redact(moduleOrFail(key), row);
