import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const mcpServer = new McpServer({
  name: "vlife-manager",
  version: "1.0.0",
});

// ─── Table definitions ───

type FieldDef = { name: string; type: string; required?: boolean; description: string };
type TableDef = {
  table: string;
  label: string;
  listFilters?: FieldDef[];
  createFields: FieldDef[];
};

const TABLES: Record<string, TableDef> = {
  pantry: {
    table: "pantry_items", label: "食材",
    listFilters: [
      { name: "category", type: "string", description: "分类筛选" },
    ],
    createFields: [
      { name: "name", type: "string", required: true, description: "名称" },
      { name: "category", type: "string", required: true, description: "分类" },
      { name: "quantity", type: "string", description: "数量" },
      { name: "expiry_date", type: "string", description: "过期日期 YYYY-MM-DD" },
      { name: "purchase_date", type: "string", description: "购入日期" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  belongings_daily: {
    table: "belongings_daily", label: "日用品",
    createFields: [
      { name: "name", type: "string", required: true, description: "名称" },
      { name: "category", type: "string", required: true, description: "分类" },
      { name: "purchase_date", type: "string", description: "购入日期" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  belongings_durable: {
    table: "belongings_durable", label: "耐用品",
    createFields: [
      { name: "name", type: "string", required: true, description: "名称" },
      { name: "category", type: "string", required: true, description: "分类" },
      { name: "purchase_price", type: "number", required: true, description: "购入价格(CNY)" },
      { name: "purchase_date", type: "string", required: true, description: "购入日期" },
      { name: "expected_lifespan_days", type: "number", required: true, description: "预期寿命(天)" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  schedule: {
    table: "schedule_events", label: "日程",
    listFilters: [
      { name: "start_date", type: "string", description: "开始日期 YYYY-MM-DD" },
      { name: "end_date", type: "string", description: "结束日期 YYYY-MM-DD" },
    ],
    createFields: [
      { name: "title", type: "string", required: true, description: "标题" },
      { name: "start_time", type: "string", required: true, description: "开始时间 ISO8601" },
      { name: "end_time", type: "string", required: true, description: "结束时间 ISO8601" },
      { name: "importance", type: "string", description: "紧急/重要/普通/低" },
      { name: "status", type: "string", description: "状态" },
      { name: "color", type: "string", description: "颜色" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  calories: {
    table: "calorie_records", label: "热量",
    listFilters: [
      { name: "date", type: "string", description: "日期 YYYY-MM-DD" },
      { name: "meal_type", type: "string", description: "breakfast/lunch/dinner/snack" },
    ],
    createFields: [
      { name: "food_name", type: "string", required: true, description: "食物名称" },
      { name: "calories", type: "number", required: true, description: "热量(kcal)" },
      { name: "meal_type", type: "string", required: true, description: "餐次" },
      { name: "date", type: "string", required: true, description: "日期 YYYY-MM-DD" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  finance: {
    table: "finance_records", label: "记账",
    listFilters: [
      { name: "date", type: "string", description: "日期 YYYY-MM-DD" },
      { name: "category", type: "string", description: "分类" },
      { name: "month", type: "string", description: "月份 YYYY-MM" },
    ],
    createFields: [
      { name: "name", type: "string", required: true, description: "项目名称" },
      { name: "amount", type: "number", required: true, description: "金额" },
      { name: "currency", type: "string", required: true, description: "CNY/JPY" },
      { name: "category", type: "string", required: true, description: "分类" },
      { name: "date", type: "string", required: true, description: "日期 YYYY-MM-DD" },
      { name: "amount_cny", type: "number", required: true, description: "人民币金额" },
      { name: "exchange_rate", type: "number", description: "汇率" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  todos: {
    table: "todos", label: "待办",
    listFilters: [
      { name: "category", type: "string", description: "分类" },
      { name: "importance", type: "string", description: "重要性" },
      { name: "is_completed", type: "boolean", description: "是否完成" },
    ],
    createFields: [
      { name: "title", type: "string", required: true, description: "标题" },
      { name: "category", type: "string", description: "分类" },
      { name: "importance", type: "string", description: "重要性" },
      { name: "detail", type: "string", description: "详情" },
      { name: "is_completed", type: "boolean", description: "是否完成" },
    ],
  },
  thoughts: {
    table: "thoughts", label: "随想",
    listFilters: [
      { name: "tag", type: "string", description: "标签筛选" },
    ],
    createFields: [
      { name: "title", type: "string", description: "标题" },
      { name: "content", type: "string", required: true, description: "Markdown内容" },
      { name: "tags", type: "string", description: "标签(逗号分隔)" },
      { name: "icon", type: "string", description: "装饰emoji" },
    ],
  },
};

function fieldsToJsonSchema(fields: FieldDef[]) {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (const f of fields) {
    properties[f.name] = { type: f.type, description: f.description };
    if (f.required) required.push(f.name);
  }
  return { type: "object" as const, properties, required };
}

// ─── Register CRUD tools ───

for (const [mod, def] of Object.entries(TABLES)) {
  // LIST
  const listProps: Record<string, any> = { limit: { type: "number", description: "最多返回条数" } };
  for (const f of def.listFilters || []) listProps[f.name] = { type: f.type, description: f.description };

  mcpServer.tool(`${mod}_list`, {
    description: `列出${def.label}记录`,
    inputSchema: { type: "object" as const, properties: listProps },
    handler: async (params: any) => {
      let q = sb.from(def.table).select("*").order("created_at", { ascending: false }).limit(params.limit || 50);
      if (mod === "schedule" && params.start_date) q = q.gte("start_time", params.start_date);
      if (mod === "schedule" && params.end_date) q = q.lte("start_time", params.end_date + "T23:59:59");
      if (mod === "finance" && params.month) q = q.gte("date", params.month + "-01").lte("date", params.month + "-31");
      if (params.category) q = q.eq("category", params.category);
      if (params.date) q = q.eq("date", params.date);
      if (params.meal_type) q = q.eq("meal_type", params.meal_type);
      if (params.importance) q = q.eq("importance", params.importance);
      if (params.is_completed !== undefined) q = q.eq("is_completed", params.is_completed);
      if (params.tag) q = q.contains("tags", [params.tag]);
      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  });

  // GET
  mcpServer.tool(`${mod}_get`, {
    description: `获取单条${def.label}详情`,
    inputSchema: { type: "object" as const, properties: { id: { type: "string", description: "记录UUID" } }, required: ["id"] },
    handler: async (params: any) => {
      const { data, error } = await sb.from(def.table).select("*").eq("id", params.id).single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  });

  // CREATE
  const createSchema = fieldsToJsonSchema(def.createFields);
  mcpServer.tool(`${mod}_create`, {
    description: `新增${def.label}记录`,
    inputSchema: createSchema,
    handler: async (params: any) => {
      const row: Record<string, any> = {};
      for (const f of def.createFields) {
        if (params[f.name] !== undefined) {
          if (f.name === "tags" && typeof params[f.name] === "string") {
            row[f.name] = params[f.name].split(",").map((s: string) => s.trim());
          } else {
            row[f.name] = params[f.name];
          }
        }
      }
      const { data, error } = await sb.from(def.table).insert(row).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Created: ${JSON.stringify(data)}` }] };
    },
  });

  // UPDATE
  const updateProps = { id: { type: "string" as const, description: "记录UUID" }, ...fieldsToJsonSchema(def.createFields).properties };
  mcpServer.tool(`${mod}_update`, {
    description: `更新${def.label}记录`,
    inputSchema: { type: "object" as const, properties: updateProps, required: ["id"] },
    handler: async (params: any) => {
      const { id, ...rest } = params;
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) {
          if (k === "tags" && typeof v === "string") updates[k] = (v as string).split(",").map((s) => s.trim());
          else updates[k] = v;
        }
      }
      const { data, error } = await sb.from(def.table).update(updates).eq("id", id).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Updated: ${JSON.stringify(data)}` }] };
    },
  });

  // DELETE
  mcpServer.tool(`${mod}_delete`, {
    description: `删除${def.label}记录`,
    inputSchema: { type: "object" as const, properties: { id: { type: "string", description: "记录UUID" } }, required: ["id"] },
    handler: async (params: any) => {
      const { error } = await sb.from(def.table).delete().eq("id", params.id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Deleted successfully" }] };
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
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    const total = (data || []).reduce((s: number, r: any) => s + Number(r.amount_cny), 0);
    const byCategory: Record<string, number> = {};
    for (const r of data || []) byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount_cny);
    return { content: [{ type: "text" as const, text: JSON.stringify({ month: monthStr, total_cny: total, by_category: byCategory, record_count: (data || []).length }, null, 2) }] };
  },
});

// ─── Data Export / Import ───

const ALL_TABLES = ["pantry_items", "belongings_daily", "belongings_durable", "schedule_events", "calorie_records", "finance_records", "todos", "thoughts", "settings"];

mcpServer.tool("data_export", {
  description: "导出全量数据为JSON",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const result: Record<string, any> = {};
    for (const t of ALL_TABLES) { const { data } = await sb.from(t).select("*"); result[t] = data || []; }
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
});

mcpServer.tool("data_import", {
  description: "导入JSON数据（按表逐条upsert）",
  inputSchema: { type: "object" as const, properties: { data: { type: "string", description: "JSON字符串" } }, required: ["data"] },
  handler: async (params: any) => {
    const parsed = JSON.parse(params.data);
    const results: string[] = [];
    for (const t of ALL_TABLES) {
      if (parsed[t] && Array.isArray(parsed[t])) {
        const { error } = await sb.from(t).upsert(parsed[t], { onConflict: "id" });
        results.push(`${t}: ${error ? error.message : `${parsed[t].length} rows`}`);
      }
    }
    return { content: [{ type: "text" as const, text: results.join("\n") }] };
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
    return JSON.stringify({ today_events: (sRes.data || []).length, next_event: (sRes.data || [])[0]?.title || null, today_calories: totalCal, month_spent_cny: totalSpent, pending_todos: (tRes.data || []).length, urgent_todos: urgent, expiring_pantry: expiring }, null, 2);
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

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
