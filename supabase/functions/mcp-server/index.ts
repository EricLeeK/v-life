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
  listColumns: string[];   // columns to show in list (compact)
  searchColumns: string[]; // columns searchable by name
};

const TABLES: Record<string, TableDef> = {
  pantry: {
    table: "pantry_items", label: "食材",
    listColumns: ["name", "category", "quantity", "expiry_date"],
    searchColumns: ["name", "category", "quantity", "expiry_date", "purchase_date", "notes"],
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
    listColumns: ["name", "category"],
    searchColumns: ["name", "category", "purchase_date", "notes"],
    createFields: [
      { name: "name", type: "string", required: true, description: "名称" },
      { name: "category", type: "string", required: true, description: "分类" },
      { name: "purchase_date", type: "string", description: "购入日期" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  belongings_durable: {
    table: "belongings_durable", label: "耐用品",
    listColumns: ["name", "category", "purchase_price", "purchase_date"],
    searchColumns: ["name", "category", "purchase_price", "purchase_date", "expected_lifespan_days", "notes"],
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
    listColumns: ["title", "start_time", "end_time", "importance", "status"],
    searchColumns: ["title", "start_time", "end_time", "importance", "status", "color", "notes"],
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
    listColumns: ["food_name", "calories", "meal_type", "date"],
    searchColumns: ["food_name", "calories", "meal_type", "date", "notes"],
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
    listColumns: ["name", "amount", "currency", "category", "date"],
    searchColumns: ["name", "amount", "currency", "category", "date", "amount_cny", "exchange_rate", "notes"],
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
    listColumns: ["title", "category", "importance", "is_completed"],
    searchColumns: ["title", "category", "importance", "is_completed", "detail"],
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
    listColumns: ["title", "tags", "icon"],
    searchColumns: ["title", "content", "tags", "icon"],
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
  learning_courses: {
    table: "learning_courses", label: "学习课程",
    listColumns: ["name", "description", "color"],
    searchColumns: ["name", "description", "color"],
    createFields: [
      { name: "name", type: "string", required: true, description: "课程名称" },
      { name: "user_id", type: "string", required: true, description: "用户UUID" },
      { name: "description", type: "string", description: "课程描述" },
      { name: "color", type: "string", description: "标识颜色" },
    ],
  },
  learning_notes: {
    table: "learning_notes", label: "学习笔记",
    listColumns: ["title", "course_id", "note_date", "tags"],
    searchColumns: ["title", "content", "course_id", "note_date", "tags"],
    listFilters: [
      { name: "course_id", type: "string", description: "课程ID" },
      { name: "note_date", type: "string", description: "日期 YYYY-MM-DD" },
    ],
    createFields: [
      { name: "course_id", type: "string", required: true, description: "课程ID" },
      { name: "title", type: "string", required: true, description: "标题" },
      { name: "content", type: "string", required: true, description: "Markdown内容" },
      { name: "tags", type: "string", description: "标签(逗号分隔)" },
      { name: "note_date", type: "string", description: "日期 YYYY-MM-DD" },
    ],
  },
  weight: {
    table: "weight_records", label: "体重",
    listColumns: ["date", "weight"],
    searchColumns: ["date", "weight", "notes"],
    listFilters: [
      { name: "date", type: "string", description: "日期 YYYY-MM-DD" },
    ],
    createFields: [
      { name: "date", type: "string", required: true, description: "日期 YYYY-MM-DD" },
      { name: "weight", type: "number", required: true, description: "体重(kg)" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  measurement: {
    table: "measurement_records", label: "围度",
    listColumns: ["date", "waist", "hip", "chest", "arm", "thigh"],
    searchColumns: ["date", "waist", "hip", "chest", "arm", "thigh", "notes"],
    listFilters: [
      { name: "date", type: "string", description: "日期 YYYY-MM-DD" },
    ],
    createFields: [
      { name: "date", type: "string", required: true, description: "日期 YYYY-MM-DD" },
      { name: "waist", type: "number", description: "腰围(cm)" },
      { name: "hip", type: "number", description: "臀围(cm)" },
      { name: "chest", type: "number", description: "胸围(cm)" },
      { name: "arm", type: "number", description: "臂围(cm)" },
      { name: "thigh", type: "number", description: "大腿围(cm)" },
      { name: "notes", type: "string", description: "备注" },
    ],
  },
  civil_exam: {
    table: "civil_exams", label: "考公考试",
    listColumns: ["name", "exam_date", "exam_type", "is_primary"],
    searchColumns: ["name", "exam_type", "notes"],
    createFields: [
      { name: "name", type: "string", required: true, description: "考试名称" },
      { name: "exam_date", type: "string", required: true, description: "考试日 YYYY-MM-DD" },
      { name: "exam_type", type: "string", description: "国考/省考/事业编/自定义" },
      { name: "is_primary", type: "boolean", description: "是否主目标" },
      { name: "notes", type: "string", description: "备注" },
      { name: "user_id", type: "string", required: true, description: "用户UUID" },
    ],
  },
  civil_plan: {
    table: "civil_plan_items", label: "考公计划",
    listColumns: ["title", "plan_date", "subject_group", "is_completed"],
    searchColumns: ["title", "detail", "subject_tag"],
    listFilters: [
      { name: "plan_date", type: "string", description: "日期 YYYY-MM-DD" },
      { name: "subject_group", type: "string", description: "xingce/shenlun/mianshi/general" },
    ],
    createFields: [
      { name: "title", type: "string", required: true, description: "标题" },
      { name: "plan_date", type: "string", required: true, description: "计划日期" },
      { name: "subject_group", type: "string", description: "xingce/shenlun/mianshi/general" },
      { name: "subject_tag", type: "string", description: "细分标签" },
      { name: "detail", type: "string", description: "备注" },
      { name: "user_id", type: "string", required: true, description: "用户UUID" },
    ],
  },
  civil_checkin: {
    table: "civil_checkins", label: "考公打卡",
    listColumns: ["date", "studied_minutes"],
    searchColumns: ["date", "note"],
    createFields: [
      { name: "date", type: "string", required: true, description: "日期" },
      { name: "studied_minutes", type: "number", required: true, description: "学习分钟" },
      { name: "note", type: "string", description: "备注" },
      { name: "user_id", type: "string", required: true, description: "用户UUID" },
    ],
  },
  civil_wrong: {
    table: "civil_wrong_answers", label: "考公错题",
    listColumns: ["title", "subject_group", "review_status", "source_date", "next_review_date"],
    searchColumns: ["title", "content", "knowledge_point", "wrong_reason"],
    listFilters: [
      { name: "subject_group", type: "string", description: "xingce/shenlun/mianshi" },
      { name: "review_status", type: "string", description: "pending/mastered" },
    ],
    createFields: [
      { name: "title", type: "string", required: true, description: "标题" },
      { name: "subject_group", type: "string", required: true, description: "xingce/shenlun/mianshi" },
      { name: "subject_tag", type: "string", description: "细分" },
      { name: "content", type: "string", description: "题干" },
      { name: "wrong_reason", type: "string", description: "错因" },
      { name: "knowledge_point", type: "string", description: "知识点" },
      { name: "user_id", type: "string", required: true, description: "用户UUID" },
    ],
  },
  civil_xingce_paper: {
    table: "civil_xingce_papers", label: "行测套卷",
    listColumns: ["taken_date", "source", "is_mock", "total_score", "beat_rate"],
    searchColumns: ["source", "notes", "taken_date"],
    listFilters: [
      { name: "is_mock", type: "boolean", description: "是否模考" },
      { name: "taken_date", type: "string", description: "日期 YYYY-MM-DD" },
    ],
    createFields: [
      { name: "taken_date", type: "string", required: true, description: "做题日期" },
      { name: "source", type: "string", required: true, description: "套题来源" },
      { name: "is_mock", type: "boolean", description: "是否正式模考" },
      { name: "verbal_total", type: "number", description: "言语题量" },
      { name: "verbal_correct", type: "number", description: "言语正确" },
      { name: "data_total", type: "number", description: "资料题量" },
      { name: "data_correct", type: "number", description: "资料正确" },
      { name: "graphic_total", type: "number", description: "图推题量" },
      { name: "graphic_correct", type: "number", description: "图推正确" },
      { name: "logic_total", type: "number", description: "逻辑题量" },
      { name: "logic_correct", type: "number", description: "逻辑正确" },
      { name: "analogy_total", type: "number", description: "定义类比题量" },
      { name: "analogy_correct", type: "number", description: "定义类比正确" },
      { name: "quantity_total", type: "number", description: "数量题量" },
      { name: "quantity_correct", type: "number", description: "数量正确" },
      { name: "common_total", type: "number", description: "常识题量" },
      { name: "common_correct", type: "number", description: "常识正确" },
      { name: "duration_minutes", type: "number", description: "用时分钟" },
      { name: "total_score", type: "number", description: "总分" },
      { name: "beat_rate", type: "number", description: "击败率" },
      { name: "notes", type: "string", description: "备注" },
      { name: "user_id", type: "string", required: true, description: "用户UUID" },
    ],
  },
  goals: {
    table: "goals", label: "目标",
    listColumns: ["title", "type", "period_start", "is_completed"],
    searchColumns: ["title", "type", "period_start", "is_completed"],
    listFilters: [
      { name: "type", type: "string", description: "week/month/year" },
      { name: "is_completed", type: "boolean", description: "是否完成" },
    ],
    createFields: [
      { name: "title", type: "string", required: true, description: "目标内容" },
      { name: "type", type: "string", required: true, description: "week/month/year" },
      { name: "period_start", type: "string", required: true, description: "周期起始日期 YYYY-MM-DD" },
    ],
  },
};

// Pick only specified keys from an object
function pick(obj: Record<string, any>, keys: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) result[k] = obj[k];
  }
  return result;
}

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
      if (params.note_date) q = q.eq("note_date", params.note_date);
      if (params.course_id) q = q.eq("course_id", params.course_id);
      if (params.meal_type) q = q.eq("meal_type", params.meal_type);
      if (params.importance) q = q.eq("importance", params.importance);
      if (params.is_completed !== undefined) q = q.eq("is_completed", params.is_completed);
      if (params.tag) q = q.contains("tags", [params.tag]);
      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      const compact = (data || []).map((row: any) => pick(row, def.listColumns));
      return { content: [{ type: "text" as const, text: JSON.stringify(compact, null, 2) }] };
    },
  });

  // SEARCH (by name, max 3 results with full useful fields)
  const nameField = mod === "calories" ? "food_name" : "title" in (def.createFields.find(f => f.name === "title") || {}) ? "title" : "name";
  mcpServer.tool(`${mod}_search`, {
    description: `按名称搜索${def.label}条目，返回完整信息（最多3条）`,
    inputSchema: { type: "object" as const, properties: { keyword: { type: "string", description: "搜索关键词" } }, required: ["keyword"] },
    handler: async (params: any) => {
      const searchField = def.createFields.find(f => f.name === "food_name") ? "food_name" : def.createFields.find(f => f.name === "title") ? "title" : "name";
      const { data, error } = await sb.from(def.table).select("*").ilike(searchField, `%${params.keyword}%`).limit(3);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!data || data.length === 0) return { content: [{ type: "text" as const, text: "未找到匹配条目" }] };
      const detailed = data.map((row: any) => ({ id: row.id, ...pick(row, def.searchColumns) }));
      return { content: [{ type: "text" as const, text: JSON.stringify(detailed, null, 2) }] };
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

const ALL_TABLES = ["pantry_items", "belongings_daily", "belongings_durable", "schedule_events", "calorie_records", "finance_records", "todos", "thoughts", "learning_courses", "learning_notes", "settings", "goals", "weight_records", "measurement_records", "civil_exams", "civil_plan_items", "civil_checkins", "civil_wrong_answers", "civil_xingce_papers"];

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
transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
