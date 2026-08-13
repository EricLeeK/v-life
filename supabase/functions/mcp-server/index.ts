import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODULES, type ModuleDef, type FieldDef } from "../_shared/moduleRegistry.ts";

/**
 * MCP server for V-Life.
 *
 * All tool schemas are derived from the canonical module registry
 * (`_shared/moduleRegistry.ts`) shared with the ai-chat edge function and the
 * web client, so the three surfaces can never drift. Adding a module there
 * automatically registers its CRUD tools here.
 *
 * NOTE: this server authenticates with the Supabase service-role key and has no
 * per-user context. Tools therefore require an explicit `user_id` argument for
 * modules flagged `executor.needsUserId` in the registry.
 */

const app = new Hono();

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const mcpServer = new McpServer({
  name: "vlife-manager",
  version: "1.0.0",
});

// ─── Schema / metadata derivation from the registry ───

type JsonSchemaProp = { type: string; description: string; enum?: string[] };
type JsonSchema = { type: "object"; properties: Record<string, JsonSchemaProp>; required: string[] };

function friendlyDesc(f: FieldDef): string {
  if (f.enum) return f.enum.join("/");
  if (f.description) return f.description;
  switch (f.type) {
    case "date":
      return "日期 YYYY-MM-DD";
    case "datetime":
      return "时间 ISO8601";
    case "number":
      return "数字";
    case "boolean":
      return "是否";
    case "array":
      return "数组";
    default:
      return f.name;
  }
}

function jsonType(f: FieldDef): string {
  if (f.type === "date" || f.type === "datetime") return "string";
  if (f.type === "array") return "array";
  return f.type;
}

/** Build a JSON-Schema object from model-facing fields, surfacing enums. */
function fieldsToJsonSchema(fields: FieldDef[]): JsonSchema {
  const properties: Record<string, JsonSchemaProp> = {};
  const required: string[] = [];
  for (const f of fields) {
    const prop: JsonSchemaProp = { type: jsonType(f), description: friendlyDesc(f) };
    if (f.enum) prop.enum = f.enum;
    properties[f.name] = prop;
    if (f.required) required.push(f.name);
  }
  return { type: "object", properties, required };
}

/** Model-facing create fields (excludes internal computed + updateOnly). */
function createFields(mod: ModuleDef): FieldDef[] {
  return mod.fields.filter((f) => !f.internal && !f.updateOnly);
}

/** Actual DB columns for a module (resolves.from replaced by resolves.toColumn). */
function dbColumns(mod: ModuleDef): string[] {
  const r = mod.executor?.resolves;
  const cols = mod.fields.filter((f) => !f.internal && !(r && f.name === r.from)).map((f) => f.name);
  if (r && !cols.includes(r.toColumn)) cols.push(r.toColumn);
  if (mod.executor?.needsUserId && !cols.includes("user_id")) cols.push("user_id");
  return cols;
}

/** Filterable columns for `<mod>_list`. */
type FilterDef = { name: string; type: string; description: string };
function listFilters(mod: ModuleDef): FilterDef[] {
  const filters: FilterDef[] = [];
  for (const f of mod.fields) {
    if (f.internal || f.updateOnly) continue;
    if (f.enum) filters.push({ name: f.name, type: "string", description: friendlyDesc(f) });
    else if (f.type === "date") filters.push({ name: f.name, type: "string", description: friendlyDesc(f) });
    else if (f.type === "boolean") filters.push({ name: f.name, type: "boolean", description: friendlyDesc(f) });
  }
  // Module-specific range/contains filters that don't map to a single column.
  const extras: Record<string, FilterDef[]> = {
    schedule: [
      { name: "start_date", type: "string", description: "开始日期 YYYY-MM-DD" },
      { name: "end_date", type: "string", description: "结束日期 YYYY-MM-DD" },
    ],
    finance: [{ name: "month", type: "string", description: "月份 YYYY-MM" }],
    thought: [{ name: "tag", type: "string", description: "标签筛选" }],
  };
  return [...filters, ...(extras[mod.key] ?? [])];
}

function pick(obj: Record<string, any>, keys: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) result[k] = obj[k];
  }
  return result;
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

async function getJpyRate(): Promise<number> {
  const { data } = await sb.from("settings").select("exchange_rate_jpy_to_cny").limit(1).maybeSingle();
  const r = Number(data?.exchange_rate_jpy_to_cny);
  return r > 0 ? r : 0.048;
}

// ─── Register CRUD tools for every module ───

const SKIP_MCP = new Set<string>(); // modules intentionally not exposed as generic CRUD
// daily_task has bespoke find-or-create-todo + gamification semantics (see AIChatPanel),
// which don't fit a generic CRUD tool. Exposed only via the chat assistant.
SKIP_MCP.add("daily_task");

for (const mod of MODULES) {
  if (SKIP_MCP.has(mod.key)) continue;
  const table = mod.table;
  const label = mod.labelZh;
  const nameField = mod.executor?.nameField ?? "name";
  const cols = dbColumns(mod);
  const listCols = [nameField, ...cols.filter((c) => c !== nameField)].slice(0, 4);
  const filters = listFilters(mod);

  // LIST
  const listProps: Record<string, JsonSchemaProp> = { limit: { type: "number", description: "最多返回条数" } };
  for (const f of filters) listProps[f.name] = { type: f.type, description: f.description };

  mcpServer.tool(`${mod.key}_list`, {
    description: `列出${label}记录`,
    inputSchema: { type: "object" as const, properties: listProps },
    handler: async (params: any) => {
      let q = sb.from(table).select("*").order("created_at", { ascending: false }).limit(params.limit || 50);
      if (mod.key === "schedule" && params.start_date) q = q.gte("start_time", params.start_date);
      if (mod.key === "schedule" && params.end_date) q = q.lte("start_time", params.end_date + "T23:59:59");
      if (mod.key === "finance" && params.month) q = q.gte("date", params.month + "-01").lte("date", params.month + "-31");
      if (params.tag) q = q.contains("tags", [params.tag]);
      for (const f of filters) {
        if (["start_date", "end_date", "month", "tag", "limit"].includes(f.name)) continue;
        if (params[f.name] !== undefined) q = q.eq(f.name, params[f.name]);
      }
      const { data, error } = await q;
      if (error) return text(`Error: ${error.message}`);
      return text(JSON.stringify((data || []).map((row: any) => pick(row, listCols)), null, 2));
    },
  });

  // SEARCH
  mcpServer.tool(`${mod.key}_search`, {
    description: `按名称搜索${label}条目，返回完整信息（最多3条）`,
    inputSchema: {
      type: "object" as const,
      properties: { keyword: { type: "string", description: "搜索关键词" } },
      required: ["keyword"],
    },
    handler: async (params: any) => {
      const { data, error } = await sb.from(table).select("*").ilike(nameField, `%${params.keyword}%`).limit(3);
      if (error) return text(`Error: ${error.message}`);
      if (!data || data.length === 0) return text("未找到匹配条目");
      return text(JSON.stringify(data.map((row: any) => ({ id: row.id, ...pick(row, cols) })), null, 2));
    },
  });

  // GET
  mcpServer.tool(`${mod.key}_get`, {
    description: `获取单条${label}详情`,
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "记录UUID" } },
      required: ["id"],
    },
    handler: async (params: any) => {
      const { data, error } = await sb.from(table).select("*").eq("id", params.id).maybeSingle();
      if (error) return text(`Error: ${error.message}`);
      return text(JSON.stringify(data, null, 2));
    },
  });

  // CREATE
  const createSchema = fieldsToJsonSchema(createFields(mod));
  if (mod.executor?.needsUserId) {
    createSchema.properties.user_id = { type: "string", description: "用户UUID（必填）" };
    createSchema.required.push("user_id");
  }

  mcpServer.tool(`${mod.key}_create`, {
    description: `新增${label}记录`,
    inputSchema: createSchema,
    handler: async (params: any) => {
      const row: Record<string, any> = {};
      for (const f of createFields(mod)) {
        if (params[f.name] !== undefined) {
          row[f.name] = f.name === "tags" && typeof params[f.name] === "string"
            ? params[f.name].split(",").map((s: string) => s.trim())
            : params[f.name];
        }
      }
      if (mod.executor?.needsUserId) row.user_id = params.user_id;

      // Foreign-key-by-name resolution (project_name → project_id, course_name → course_id).
      const r = mod.executor?.resolves;
      if (r) {
        if (params[r.from] != null) {
          const { data } = await sb.from(r.targetTable).select("id").ilike(r.targetField, `%${params[r.from]}%`).limit(1).maybeSingle();
          if (data) row[r.toColumn] = data.id;
          else if (r.required) return text(`未找到「${params[r.from]}」`);
          delete row[r.from];
        } else if (r.required) {
          return text(`缺少${r.from}`);
        }
      }

      // finance: compute CNY-converted amount server-side (callers no longer pass amount_cny).
      if (mod.key === "finance") {
        const rate = row.currency === "JPY" ? await getJpyRate() : 1;
        row.amount_cny = Number(row.amount) * rate;
        row.exchange_rate = rate;
      }

      const conflict = mod.executor?.upsert;
      const op = conflict
        ? sb.from(table).upsert(row, { onConflict: conflict.join(",") })
        : sb.from(table).insert(row);
      const { data, error } = await op.select().maybeSingle();
      if (error) return text(`Error: ${error.message}`);
      return text(`Created: ${JSON.stringify(data)}`);
    },
  });

  // UPDATE
  const updateProps: Record<string, JsonSchemaProp> = {
    id: { type: "string", description: "记录UUID" },
    ...fieldsToJsonSchema(createFields(mod)).properties,
  };
  mcpServer.tool(`${mod.key}_update`, {
    description: `更新${label}记录`,
    inputSchema: { type: "object" as const, properties: updateProps, required: ["id"] },
    handler: async (params: any) => {
      const { id, ...rest } = params;
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined) continue;
        updates[k] = k === "tags" && typeof v === "string" ? v.split(",").map((s: string) => s.trim()) : v;
      }
      const { data, error } = await sb.from(table).update(updates).eq("id", id).select().maybeSingle();
      if (error) return text(`Error: ${error.message}`);
      return text(`Updated: ${JSON.stringify(data)}`);
    },
  });

  // DELETE
  mcpServer.tool(`${mod.key}_delete`, {
    description: `删除${label}记录`,
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "记录UUID" } },
      required: ["id"],
    },
    handler: async (params: any) => {
      const { error } = await sb.from(table).delete().eq("id", params.id);
      if (error) return text(`Error: ${error.message}`);
      return text("Deleted successfully");
    },
  });
}

// ─── Finance Summary ───

mcpServer.tool("finance_summary", {
  description: "获取月度财务汇总（总额、分类占比）",
  inputSchema: {
    type: "object" as const,
    properties: { year: { type: "number", description: "年" }, month: { type: "number", description: "月" } },
    required: ["year", "month"],
  },
  handler: async (params: any) => {
    const monthStr = `${params.year}-${String(params.month).padStart(2, "0")}`;
    const { data, error } = await sb.from("finance_records").select("*").gte("date", monthStr + "-01").lte("date", monthStr + "-31");
    if (error) return text(`Error: ${error.message}`);
    const total = (data || []).reduce((s: number, r: any) => s + Number(r.amount_cny), 0);
    const byCategory: Record<string, number> = {};
    for (const r of data || []) byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount_cny);
    return text(JSON.stringify({ month: monthStr, total_cny: total, by_category: byCategory, record_count: (data || []).length }, null, 2));
  },
});

// ─── Data Export / Import ───

// Derived from the registry so new modules are exported automatically. `settings`
// is included for full backup/restore even though it is not a CRUD module.
const ALL_TABLES = [...new Set([...MODULES.map((m) => m.table), "settings"])];

mcpServer.tool("data_export", {
  description: "导出全量数据为JSON",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const result: Record<string, any> = {};
    for (const t of ALL_TABLES) {
      const { data } = await sb.from(t).select("*");
      result[t] = data || [];
    }
    return text(JSON.stringify(result));
  },
});

mcpServer.tool("data_import", {
  description: "导入JSON数据（按表逐条upsert）",
  inputSchema: {
    type: "object" as const,
    properties: { data: { type: "string", description: "JSON字符串" } },
    required: ["data"],
  },
  handler: async (params: any) => {
    const parsed = JSON.parse(params.data);
    const results: string[] = [];
    for (const t of ALL_TABLES) {
      if (parsed[t] && Array.isArray(parsed[t])) {
        const { error } = await sb.from(t).upsert(parsed[t], { onConflict: "id" });
        results.push(`${t}: ${error ? error.message : `${parsed[t].length} rows`}`);
      }
    }
    return text(results.join("\n"));
  },
});

// ─── Resources ───

mcpServer.resource("dashboard://summary", {
  name: "Dashboard Summary",
  description: "首页概览数据",
  mimeType: "application/json",
  handler: async () => {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = today.slice(0, 7) + "-01";
    const [sRes, cRes, fRes, tRes, pRes] = await Promise.all([
      sb.from("schedule_events").select("*").gte("start_time", today).lte("start_time", today + "T23:59:59").order("start_time"),
      sb.from("calorie_records").select("*").eq("date", today),
      sb.from("finance_records").select("*").gte("date", monthStart).lte("date", today),
      sb.from("todos").select("*").eq("is_completed", false),
      sb.from("pantry_items").select("*"),
    ]);
    const totalCal = (cRes.data || []).reduce((s: number, r: any) => s + r.calories, 0);
    const totalSpent = (fRes.data || []).reduce((s: number, r: any) => s + Number(r.amount_cny), 0);
    const urgent = (tRes.data || []).filter((t: any) => t.importance === "紧急").length;
    const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
    const expiring = (pRes.data || []).filter((p: any) => p.expiry_date && p.expiry_date <= threeDays).length;
    return JSON.stringify(
      {
        today_events: (sRes.data || []).length,
        next_event: (sRes.data || [])[0]?.title || null,
        today_calories: totalCal,
        month_spent_cny: totalSpent,
        pending_todos: (tRes.data || []).length,
        urgent_todos: urgent,
        expiring_pantry: expiring,
      },
      null,
      2,
    );
  },
});

mcpServer.resource("finance://monthly/{year}/{month}", {
  name: "Monthly Finance",
  description: "指定月份财务汇总",
  mimeType: "application/json",
  handler: async (uri: URL) => {
    const parts = uri.pathname.split("/");
    const year = parts[parts.length - 2];
    const month = parts[parts.length - 1];
    const monthStr = `${year}-${month.padStart(2, "0")}`;
    const { data } = await sb.from("finance_records").select("*").gte("date", monthStr + "-01").lte("date", monthStr + "-31");
    const total = (data || []).reduce((s: number, r: any) => s + Number(r.amount_cny), 0);
    const byCategory: Record<string, number> = {};
    for (const r of data || []) byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount_cny);
    return JSON.stringify({ month: monthStr, total_cny: total, by_category: byCategory, records: data }, null, 2);
  },
});

mcpServer.resource("calories://daily/{date}", {
  name: "Daily Calories",
  description: "指定日期热量汇总",
  mimeType: "application/json",
  handler: async (uri: URL) => {
    const date = uri.pathname.split("/").pop();
    const { data } = await sb.from("calorie_records").select("*").eq("date", date);
    const total = (data || []).reduce((s: number, r: any) => s + r.calories, 0);
    const byMeal: Record<string, number> = {};
    for (const r of data || []) byMeal[r.meal_type] = (byMeal[r.meal_type] || 0) + r.calories;
    return JSON.stringify({ date, total_calories: total, by_meal: byMeal, records: data }, null, 2);
  },
});

// ─── Transport ───

const transport = new StreamableHttpTransport();
transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
