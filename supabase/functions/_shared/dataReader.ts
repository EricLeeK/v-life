/**
 * Registry-driven READ layer for V-Life data.
 *
 * Single source of truth = `moduleRegistry.ts`. This module turns a module key
 * (+ optional filters) into a parameterized Supabase query. Consumed by:
 *   - `supabase/functions/ai-chat`  → the `read_data` / `get_today_plan` agent tools
 *   - (future) `supabase/functions/mcp-server` `<mod>_list` can migrate here
 *
 * SECURITY: callers MUST pass the USER's JWT client (`userSb`) so RLS scopes
 * every read to the authenticated user. This module never uses the service role.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { moduleByKey, MODULE_KEYS, type ModuleDef } from "./moduleRegistry.ts";

export { MODULE_KEYS };

export interface ReadOpts {
  date_from?: string; // YYYY-MM-DD (compared against the module's dateField)
  date_to?: string;
  filters?: Record<string, unknown>; // field → value (ilike for text, eq for boolean/number)
  limit?: number;
}

const READ_LIMIT_MAX = 200;
const READ_LIMIT_DEFAULT = 50;

/** Non-internal field names of a module = columns the agent may filter on. */
function allowedFilterCols(mod: ModuleDef): Set<string> {
  return new Set(mod.fields.filter((f) => !f.internal).map((f) => f.name));
}

/**
 * Generic registry-driven read.
 * @param sb   the USER's JWT Supabase client (RLS-enforced)
 */
export async function listModuleRecords(
  sb: SupabaseClient,
  moduleKey: string,
  opts: ReadOpts = {},
): Promise<{ data?: Record<string, unknown>[]; error?: string }> {
  const mod = moduleByKey[moduleKey];
  if (!mod) return { error: `unknown module: ${moduleKey}` };

  const dateField = mod.executor?.dateField;
  const limit = Math.max(1, Math.min(opts.limit ?? READ_LIMIT_DEFAULT, READ_LIMIT_MAX));

  let q = sb.from(mod.table).select("*");
  if (dateField && opts.date_from) q = q.gte(dateField, opts.date_from);
  if (dateField && opts.date_to) q = q.lte(dateField, opts.date_to);

  if (opts.filters && typeof opts.filters === "object") {
    const allowed = allowedFilterCols(mod);
    for (const [k, v] of Object.entries(opts.filters)) {
      if (v === null || v === undefined || v === "" || !allowed.has(k)) continue;
      const f = mod.fields.find((x) => x.name === k);
      // boolean / number → exact match; everything else → case-insensitive contains
      if (f?.type === "boolean" || f?.type === "number") q = q.eq(k, v);
      else q = q.ilike(k, `%${String(v)}%`);
    }
  }

  // newest first by the module's date field, fall back to created_at
  const orderField = dateField ?? "created_at";
  const { data, error } = await q.order(orderField, { ascending: false }).limit(limit);
  if (error) return { error: error.message };
  return { data: (data as Record<string, unknown>[]) ?? [] };
}

/**
 * Today's planned tasks, offset-aware (honors `day_start_hour`) and joined with
 * the underlying todo titles so the agent can reason about what's already planned.
 */
export async function getTodayPlan(
  sb: SupabaseClient,
  dayStartHour = 0,
): Promise<{ data?: Record<string, unknown>[]; error?: string }> {
  const shifted = new Date(Date.now() - dayStartHour * 3600000);
  const today = shifted.toISOString().split("T")[0];
  const { data, error } = await sb
    .from("daily_tasks")
    .select("id,todo_id,task_date,is_completed,difficulty,base_points,todos(title,detail)")
    .eq("task_date", today)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  return { data: (data as Record<string, unknown>[]) ?? [] };
}
