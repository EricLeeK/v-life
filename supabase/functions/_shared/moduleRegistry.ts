/**
 * Canonical module registry for V-Life.
 *
 * Single source of truth for every "operation module" the AI assistant can
 * produce. Consumed by three independent surfaces:
 *   1. `supabase/functions/ai-chat`     — builds the LLM system prompt via buildSystemPrompt()
 *   2. `supabase/functions/mcp-server`  — generates JSON-Schema tool definitions
 *   3. `src/components/AIChatPanel.tsx`  — derives table map, labels, query-key invalidation
 *
 * PLATFORM-AGNOSTIC: this file MUST NOT import anything (no Deno globals, no
 * https:// imports, no npm packages). It is pure data + pure functions so that
 * Vite, vitest, and Deno can all import it directly. Keep it that way.
 */

// ───────────────────────────── Types ─────────────────────────────

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date" // rendered as "YYYY-MM-DD" in the prompt
  | "datetime" // rendered as "ISO8601" in the prompt
  | "array";

export interface FieldDef {
  name: string;
  type: FieldType;
  required?: boolean; // required on create
  enum?: string[]; // surfaced as a JSON-Schema `enum` and a prompt union
  description?: string; // optional human hint (zh)
  /** Overrides the rendered type in the prompt (e.g. "string[]", "[{key: string, text: string}]"). */
  promptType?: string;
  /** Update-only field: shown in the update payload but NOT in create input. */
  updateOnly?: boolean;
  /** Non-model-facing DB column computed by the executor/handler (e.g. amount_cny). Excluded from prompt + create schema. */
  internal?: boolean;
  /** Reserved for future executor defaulting; not consumed in v1. */
  default?: unknown;
}

export interface ResolveSpec {
  from: string; // input field emitted by the model (e.g. "project_name")
  toColumn: string; // output DB column (e.g. "project_id")
  targetTable: string; // table to look up (e.g. "projects")
  targetField: string; // field to match on (e.g. "name")
  required?: boolean; // throw if no match found
}

export interface ExecutorHints {
  needsUserId?: boolean; // inject user.id on create
  upsert?: string[]; // conflict columns → use upsert instead of insert
  nameField?: string; // field used for fuzzy-match fallback (delete with empty match)
  resolves?: ResolveSpec; // foreign-key resolution by name
  queryKeys?: string[]; // React Query keys to invalidate after write
  special?: "daily_task"; // bespoke handler hook (not generic CRUD)
  dateField?: string; // column used for date-range filtering in read_data (e.g. "date", "start_time")
}

export interface ModuleDef {
  key: string; // canonical (singular/collective): "todo", "finance", ...
  labelZh: string; // compact label for UI chips
  labelEn: string; // compact English label
  headingZh: string; // descriptive heading used in the prompt (### N. key（heading）)
  table: string; // Supabase table name
  index: number; // display order in the prompt
  actions: { create?: true; update?: true; delete?: true };
  fields: FieldDef[]; // create field definitions (model-facing) + updateOnly/internal fields
  matchFields?: string[]; // match keys for update/delete; default [nameField]
  matchRequired?: string[]; // match keys rendered as required (e.g. daily_task title)
  updateFields?: string[]; // updatable field names; default = all non-internal fields
  notes?: string; // free-text bold legend/constraint rendered at end of the module block
  executor?: ExecutorHints;
}

// ──────────────────────────── Modules ────────────────────────────

export const MODULES: ModuleDef[] = [
  {
    key: "finance",
    labelZh: "记账",
    labelEn: "Finance",
    headingZh: "记账",
    table: "finance_records",
    index: 1,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "name", type: "string", required: true },
      { name: "amount", type: "number", required: true },
      { name: "currency", type: "string", required: true, enum: ["CNY", "JPY"] },
      {
        name: "category",
        type: "string",
        required: true,
        enum: ["餐饮", "日用", "交通", "住房", "通讯/订阅", "医疗", "服饰", "娱乐", "学习", "电子", "大额", "税费", "其他"],
      },
      { name: "date", type: "date", required: true },
      { name: "notes", type: "string" },
      { name: "amount_cny", type: "number", internal: true },
      { name: "exchange_rate", type: "number", internal: true },
    ],
    matchFields: ["name", "date", "amount"],
    updateFields: ["name", "amount", "currency", "category", "notes"],
    notes:
      '【严格约束】category 必须且只能是上述枚举值之一，禁止使用任何同义词、近义词或自创分类（如"购物"、"食品"、"超市"等均不合法）。如果无法确定分类，使用"其他"。税费/消費税/tax 统一归入"税费"。',
    executor: { nameField: "name", queryKeys: ["finance"], dateField: "date" },
  },
  {
    key: "calories",
    labelZh: "热量",
    labelEn: "Calories",
    headingZh: "热量记录",
    table: "calorie_records",
    index: 2,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "food_name", type: "string", required: true },
      { name: "calories", type: "number", required: true },
      { name: "meal_type", type: "string", required: true, enum: ["breakfast", "lunch", "dinner", "snack", "exercise"] },
      { name: "date", type: "date", required: true },
      { name: "notes", type: "string" },
    ],
    matchFields: ["food_name", "date", "meal_type"],
    updateFields: ["food_name", "calories", "meal_type", "notes"],
    notes:
      '运动类（meal_type="exercise"）：当用户提到运动/锻炼时，使用 meal_type="exercise"，calories 填写消耗的热量。food_name 填运动名称（如"跑步30分钟"）。你需要根据运动类型和时长自行估算消耗的大卡数。',
    executor: { nameField: "food_name", queryKeys: ["calories"], dateField: "date" },
  },
  {
    key: "schedule",
    labelZh: "日程",
    labelEn: "Schedule",
    headingZh: "日程",
    table: "schedule_events",
    index: 3,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "title", type: "string", required: true },
      { name: "start_time", type: "datetime", required: true },
      { name: "end_time", type: "datetime", required: true },
      { name: "importance", type: "string", enum: ["紧急", "重要", "普通", "低"] },
      { name: "notes", type: "string" },
      { name: "status", type: "string", updateOnly: true },
    ],
    matchFields: ["title", "date"],
    updateFields: ["title", "start_time", "end_time", "importance", "status", "notes"],
    executor: { nameField: "title", queryKeys: ["schedule"], dateField: "start_time" },
  },
  {
    key: "todo",
    labelZh: "待办",
    labelEn: "To-Do",
    headingZh: "待办事项",
    table: "todos",
    index: 4,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "title", type: "string", required: true },
      { name: "category", type: "string", enum: ["工作", "学习", "学业", "生活", "健康", "考公", "未分类"] },
      { name: "importance", type: "string", enum: ["紧急", "重要", "普通", "低"] },
      { name: "detail", type: "string" },
      { name: "parent_title", type: "string", description: "父待办标题；填了即作为其子条目创建/定位" },
      { name: "is_completed", type: "boolean", updateOnly: true },
    ],
    matchFields: ["title", "parent_title"],
    updateFields: ["is_completed", "title", "importance", "category", "detail"],
    notes: "支持子条目：create 带 parent_title 即在父待办下建子项；update/delete 在 match 里同时给 title+parent_title 可精确定位子项（否则按标题匹配，父子同名时优先父项）。",
    executor: {
      nameField: "title",
      queryKeys: ["todos"],
      resolves: { from: "parent_title", toColumn: "parent_id", targetTable: "todos", targetField: "title" },
    },
  },
  {
    key: "pantry",
    labelZh: "食材",
    labelEn: "Pantry",
    headingZh: "食材管理",
    table: "pantry_items",
    index: 5,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "name", type: "string", required: true },
      {
        name: "category",
        type: "string",
        required: true,
        enum: ["新鲜食材", "冷冻食品", "调料", "饮品", "零食", "主食/干货", "其他"],
      },
      { name: "quantity", type: "string" },
      { name: "expiry_date", type: "date" },
      { name: "notes", type: "string" },
    ],
    matchFields: ["name"],
    updateFields: ["quantity", "expiry_date", "category", "notes"],
    executor: { nameField: "name", queryKeys: ["pantry"], dateField: "expiry_date" },
  },
  {
    key: "thought",
    labelZh: "随想",
    labelEn: "Thought",
    headingZh: "随想笔记",
    table: "thoughts",
    index: 6,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "title", type: "string" },
      { name: "content", type: "string", required: true },
      { name: "tags", type: "array", promptType: "string[]" },
    ],
    matchFields: ["title"],
    updateFields: ["title", "content", "tags"],
    executor: { nameField: "title", queryKeys: ["thoughts"] },
  },
  {
    key: "belongings_daily",
    labelZh: "日用品",
    labelEn: "Daily",
    headingZh: "日用消耗品",
    table: "belongings_daily",
    index: 7,
    actions: { create: true, delete: true },
    fields: [
      { name: "name", type: "string", required: true },
      { name: "category", type: "string", required: true, enum: ["洗护", "清洁", "厨房", "文具", "其他"] },
      { name: "purchase_date", type: "date" },
      { name: "notes", type: "string" },
    ],
    matchFields: ["name"],
    executor: { nameField: "name", queryKeys: ["belongings"] },
  },
  {
    key: "belongings_durable",
    labelZh: "耐用品",
    labelEn: "Durable",
    headingZh: "耐用品",
    table: "belongings_durable",
    index: 8,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "name", type: "string", required: true },
      {
        name: "category",
        type: "string",
        required: true,
        enum: ["电子产品", "家电", "家具", "交通工具", "其他"],
      },
      { name: "purchase_price", type: "number", required: true },
      { name: "purchase_date", type: "date", required: true },
      { name: "expected_lifespan_days", type: "number", required: true },
      { name: "notes", type: "string" },
    ],
    matchFields: ["name"],
    updateFields: ["purchase_price", "expected_lifespan_days", "notes"],
    executor: { nameField: "name", queryKeys: ["belongings"] },
  },
  {
    key: "weight",
    labelZh: "体重",
    labelEn: "Weight",
    headingZh: "体重记录",
    table: "weight_records",
    index: 9,
    actions: { create: true, delete: true },
    fields: [
      { name: "weight", type: "number", required: true },
      { name: "date", type: "date" },
      { name: "notes", type: "string" },
    ],
    matchFields: ["date"],
    executor: { nameField: "date", queryKeys: ["weight_records"], upsert: ["user_id", "date"], dateField: "date" },
  },
  {
    key: "measurement",
    labelZh: "围度",
    labelEn: "Measurement",
    headingZh: "围度记录",
    table: "measurement_records",
    index: 10,
    actions: { create: true, delete: true },
    fields: [
      { name: "waist", type: "number" },
      { name: "hip", type: "number" },
      { name: "chest", type: "number" },
      { name: "arm", type: "number" },
      { name: "thigh", type: "number" },
      { name: "date", type: "date" },
      { name: "notes", type: "string" },
    ],
    matchFields: ["date"],
    executor: { nameField: "date", queryKeys: ["measurement_records"], upsert: ["user_id", "date"], dateField: "date" },
    notes: "围度单位为 cm，体重单位为 kg。同一天重复记录会覆盖（upsert）。",
  },
  {
    key: "goal",
    labelZh: "目标",
    labelEn: "Goal",
    headingZh: "目标管理",
    table: "goals",
    index: 11,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "title", type: "string", required: true },
      { name: "type", type: "string", required: true, enum: ["week", "month", "year"] },
      { name: "period_start", type: "date", required: true },
      { name: "is_completed", type: "boolean", updateOnly: true },
    ],
    matchFields: ["title", "type"],
    updateFields: ["title", "is_completed"],
    executor: { nameField: "title", queryKeys: ["goals"] },
    notes: "目标分为周目标、月目标、年目标。period_start 为该目标周期的起始日期（周目标用周一日期，月目标用当月1号，年目标用当年1月1日）。",
  },
  {
    key: "project",
    labelZh: "项目",
    labelEn: "Project",
    headingZh: "项目管理",
    table: "projects",
    index: 12,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "name", type: "string", required: true },
      { name: "description", type: "string" },
      { name: "status", type: "string", enum: ["planning", "active", "paused", "completed", "archived"] },
      { name: "priority", type: "string", enum: ["high", "medium", "low"] },
      { name: "target_date", type: "date" },
    ],
    matchFields: ["name"],
    updateFields: ["name", "description", "status", "priority", "target_date"],
    executor: { nameField: "name", queryKeys: ["projects"], needsUserId: true },
    notes:
      '项目状态：planning=规划中, active=进行中, paused=暂停中, completed=已完成, archived=已归档。默认 status="planning", priority="medium"。',
  },
  {
    key: "project_task",
    labelZh: "项目任务",
    labelEn: "Task",
    headingZh: "项目子任务/习惯/里程碑",
    table: "project_tasks",
    index: 13,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "project_name", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "type", type: "string", enum: ["task", "habit", "milestone"] },
      { name: "status", type: "string", enum: ["todo", "this_week", "in_progress", "waiting", "done"] },
      { name: "description", type: "string" },
      { name: "due_date", type: "date" },
      { name: "weight", type: "number" },
    ],
    matchFields: ["title", "project_name"],
    updateFields: ["title", "status", "description", "due_date", "weight"],
    notes:
      "project_task 必须通过 project_name 关联到一个已存在的项目。type 可以是 task(任务)、habit(习惯)、milestone(里程碑)，默认 task。status 可以是 todo(待办)、this_week(本周)、in_progress(进行中)、waiting(等待中)、done(已完成)，默认 todo。weight 是权重(影响项目进度计算)，默认 1。",
    executor: {
      nameField: "title",
      queryKeys: ["project_tasks"],
      resolves: { from: "project_name", toColumn: "project_id", targetTable: "projects", targetField: "name", required: true },
    },
  },
  {
    key: "civil_exam",
    labelZh: "考公考试",
    labelEn: "Civil Exam",
    headingZh: "考公考试倒计时",
    table: "civil_exams",
    index: 14,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "name", type: "string", required: true },
      { name: "exam_date", type: "date", required: true },
      { name: "exam_type", type: "string", enum: ["国考", "省考", "事业编", "自定义"] },
      { name: "is_primary", type: "boolean" },
      { name: "notes", type: "string" },
      { name: "is_archived", type: "boolean", updateOnly: true },
    ],
    matchFields: ["name"],
    updateFields: ["name", "exam_date", "exam_type", "is_primary", "is_archived", "notes"],
    executor: { nameField: "name", queryKeys: ["civil_exams"], needsUserId: true },
  },
  {
    key: "civil_plan",
    labelZh: "考公计划",
    labelEn: "Civil Plan",
    headingZh: "考公学习计划",
    table: "civil_plan_items",
    index: 15,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "title", type: "string", required: true },
      { name: "plan_date", type: "date" },
      { name: "subject_group", type: "string", enum: ["xingce", "shenlun", "mianshi", "general"] },
      { name: "subject_tag", type: "string" },
      { name: "detail", type: "string" },
      { name: "start_time", type: "datetime" },
      { name: "end_time", type: "datetime" },
      { name: "source", type: "string", enum: ["plan", "daily_extra"] },
      { name: "is_completed", type: "boolean", updateOnly: true },
    ],
    matchFields: ["title", "plan_date"],
    updateFields: ["title", "is_completed", "plan_date", "subject_group", "subject_tag", "detail", "start_time", "end_time"],
    notes:
      "subject_tag 常用：套卷、言语理解、资料分析、图形推理、定义类比、逻辑推理、数量关系、时政常识、综应、申论、理论学习、素材积累、热点剖析。",
    executor: { nameField: "title", queryKeys: ["civil_plan_items"], needsUserId: true, dateField: "plan_date" },
  },
  {
    key: "civil_checkin",
    labelZh: "考公打卡",
    labelEn: "Civil Check-in",
    headingZh: "考公每日打卡",
    table: "civil_checkins",
    index: 16,
    actions: { create: true },
    fields: [
      { name: "studied_minutes", type: "number", required: true },
      { name: "date", type: "date" },
      { name: "note", type: "string" },
    ],
    notes: "同一天重复打卡会覆盖（upsert）。",
    executor: { nameField: "date", queryKeys: ["civil_checkins"], needsUserId: true, upsert: ["user_id", "date"], dateField: "date" },
  },
  {
    key: "civil_wrong",
    labelZh: "考公错题",
    labelEn: "Civil Wrong",
    headingZh: "考公错题",
    table: "civil_wrong_answers",
    index: 17,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "title", type: "string", required: true },
      { name: "subject_group", type: "string", required: true, enum: ["xingce", "shenlun", "mianshi"] },
      { name: "subject_tag", type: "string" },
      { name: "content", type: "string" },
      { name: "wrong_reason", type: "string" },
      { name: "knowledge_point", type: "string" },
      { name: "source_date", type: "date" },
      { name: "review_status", type: "string", enum: ["pending", "mastered"] },
      { name: "question_type", type: "string", enum: ["choice", "judgement", "text"] },
      { name: "options", type: "array", promptType: "[{key: string, text: string}]" },
      { name: "correct_answer", type: "string" },
      { name: "user_answer", type: "string" },
      { name: "image_required", type: "boolean" },
    ],
    matchFields: ["title"],
    updateFields: [
      "title",
      "review_status",
      "wrong_reason",
      "knowledge_point",
      "subject_tag",
      "question_type",
      "options",
      "correct_answer",
      "user_answer",
      "image_required",
    ],
    notes:
      "识别错题图片时，用 civil_wrong create 返回草稿字段（含 question_type/options/correct_answer/user_answer/image_required）；用户确认后再落库。新建 pending 错题会自动安排复习日期。image_required=true 表示图形推理/带图题等必须看图；纯文字题给 false。",
    executor: { nameField: "title", queryKeys: ["civil_wrong_answers"], needsUserId: true, dateField: "source_date" },
  },
  {
    key: "civil_xingce_paper",
    labelZh: "行测套卷",
    labelEn: "Xingce Paper",
    headingZh: "行测套卷",
    table: "civil_xingce_papers",
    index: 18,
    actions: { create: true, update: true, delete: true },
    fields: [
      { name: "taken_date", type: "date" },
      { name: "source", type: "string", required: true },
      { name: "is_mock", type: "boolean" },
      { name: "verbal_total", type: "number" },
      { name: "verbal_correct", type: "number" },
      { name: "data_total", type: "number" },
      { name: "data_correct", type: "number" },
      { name: "graphic_total", type: "number" },
      { name: "graphic_correct", type: "number" },
      { name: "logic_total", type: "number" },
      { name: "logic_correct", type: "number" },
      { name: "analogy_total", type: "number" },
      { name: "analogy_correct", type: "number" },
      { name: "quantity_total", type: "number" },
      { name: "quantity_correct", type: "number" },
      { name: "common_total", type: "number" },
      { name: "common_correct", type: "number" },
      { name: "duration_minutes", type: "number" },
      { name: "total_score", type: "number" },
      { name: "beat_rate", type: "number" },
      { name: "notes", type: "string" },
    ],
    matchFields: ["source", "taken_date"],
    updateFields: ["source", "total_score", "beat_rate", "notes", "is_mock"],
    notes:
      "言语=verbal，资料=data，图推=graphic，逻辑=logic，定义类比=analogy，数量=quantity，常识=common。*_total 为题量，*_correct 为正确数。",
    executor: { nameField: "source", queryKeys: ["civil_xingce_papers"], needsUserId: true, dateField: "taken_date" },
  },
  {
    key: "daily_task",
    labelZh: "今日待办",
    labelEn: "Today's Todo",
    headingZh: '今日待办 — 加入"今天"的任务表，区别于 todo 待办事项',
    table: "daily_tasks",
    index: 19,
    actions: { create: true, delete: true },
    fields: [
      { name: "todo_id", type: "string", description: "已命中待办的 UUID（优先用，来自 read_data/read_todo 的结果）" },
      { name: "title", type: "string", required: true },
    ],
    matchFields: ["title"],
    matchRequired: ["title"],
    notes:
      '【与 todo 的核心区别】todo 是"待办事项"（长期积压清单）；daily_task 是"今日待办"（今天要做的当天任务，对应"今日待办/Today"页）。当用户说"把 XXX 加入今天的待办 / 今天要做 XXX / 把 XXX 排到今天 / 今天加一项 XXX"时，用 daily_task 而不是 todo。**优先用 todo_id**（你用 read_data 读到待办时拿到的 id）直接加入今天；没有 id 时给 title，系统自动按标题找/建 todo 再加入今天。',
    executor: { nameField: "title", queryKeys: ["daily_tasks"], special: "daily_task", dateField: "task_date" },
  },
  {
    key: "learning_course",
    labelZh: "课程",
    labelEn: "Course",
    headingZh: "学习课程",
    table: "learning_courses",
    index: 20,
    actions: { create: true },
    fields: [
      { name: "name", type: "string", required: true },
      { name: "description", type: "string" },
      { name: "color", type: "string" },
    ],
    executor: { nameField: "name", queryKeys: ["learning_courses"], needsUserId: true },
  },
  {
    key: "learning_note",
    labelZh: "学习笔记",
    labelEn: "Learning Note",
    headingZh: "学习笔记",
    table: "learning_notes",
    index: 21,
    actions: { create: true },
    fields: [
      { name: "title", type: "string", required: true },
      { name: "content", type: "string", required: true },
      { name: "course_name", type: "string" },
      { name: "tags", type: "array", promptType: "string[]" },
      { name: "note_date", type: "date" },
    ],
    notes: "course_name 用课程名称（不要填 id）；系统会自动模糊匹配已存在的课程并关联。不关联课程时省略 course_name，作为独立笔记。",
    executor: {
      nameField: "title",
      queryKeys: ["learning_notes"],
      resolves: { from: "course_name", toColumn: "course_id", targetTable: "learning_courses", targetField: "name" },
      dateField: "note_date",
    },
  },
];

// ──────────────────────────── Helpers ────────────────────────────

export const moduleByKey: Record<string, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.key, m]),
);

export const MODULE_KEYS = MODULES.map((m) => m.key);

/** All non-internal fields (model-facing + updateOnly). MCP/prompt exclude internal. */
export function fieldsOf(key: string): FieldDef[] {
  return moduleByKey[key]?.fields ?? [];
}

/** Fields the model may emit on create (excludes updateOnly + internal). */
export function createFieldsOf(key: string): FieldDef[] {
  return fieldsOf(key).filter((f) => !f.updateOnly && !f.internal);
}

export function tableOf(key: string): string | undefined {
  return moduleByKey[key]?.table;
}

/** Compact zh/en label record, matching the previous getModuleLabels shape. */
export function getModuleLabels(t: (zh: string, en: string) => string): Record<string, string> {
  return Object.fromEntries(MODULES.map((m) => [m.key, t(m.labelZh, m.labelEn)]));
}

/** Union of all React Query keys invalidated by writes across modules. */
export function allQueryKeys(): string[] {
  const set = new Set<string>();
  for (const m of MODULES) for (const k of m.executor?.queryKeys ?? [m.table]) set.add(k);
  return [...set];
}

// ─────────────────────── Prompt field rendering ──────────────────

function displayType(f: FieldDef): string {
  if (f.promptType) return f.promptType;
  if (f.enum) return f.enum.map((v) => `"${v}"`).join("|");
  switch (f.type) {
    case "date":
      return '"YYYY-MM-DD"';
    case "datetime":
      return '"ISO8601"';
    case "array":
      return "string[]";
    default:
      return f.type;
  }
}

function updateType(f: FieldDef): string {
  // In the update payload enums/dates collapse to plain string,
  // but boolean / number / array-of-object types are preserved.
  if (f.type === "boolean") return "boolean";
  if (f.type === "number") return "number";
  if (f.type === "array") return f.promptType ?? "string[]";
  return "string";
}

function baseType(f: FieldDef): string {
  if (f.type === "number") return "number";
  if (f.type === "boolean") return "boolean";
  return "string";
}

function renderCreate(mod: ModuleDef): string {
  return createFieldsOf(mod.key)
    .map((f) => `${f.name}${f.required ? "" : "?"}: ${displayType(f)}`)
    .join(", ");
}

function renderUpdate(mod: ModuleDef): string {
  const names =
    mod.updateFields ?? mod.fields.filter((f) => !f.internal).map((f) => f.name);
  return names
    .map((name) => {
      const f = mod.fields.find((x) => x.name === name);
      return `${name}?: ${f ? updateType(f) : "string"}`;
    })
    .join(", ");
}

function renderMatch(mod: ModuleDef): string {
  const names = mod.matchFields ?? [mod.executor?.nameField ?? "name"];
  const required = new Set(mod.matchRequired ?? []);
  return names
    .map((name) => {
      const f = mod.fields.find((x) => x.name === name);
      return `${name}${required.has(name) ? "" : "?"}: ${f ? baseType(f) : "string"}`;
    })
    .join(", ");
}

function renderModule(mod: ModuleDef): string {
  const lines: string[] = [`### ${mod.index}. ${mod.key}（${mod.headingZh}）`];
  if (mod.actions.create) {
    lines.push(`create: { module: "${mod.key}", action: "create", data: { ${renderCreate(mod)} } }`);
  }
  if (mod.actions.update) {
    lines.push(
      `update: { module: "${mod.key}", action: "update", data: { match: { ${renderMatch(mod)} }, update: { ${renderUpdate(mod)} } } }`,
    );
  }
  if (mod.actions.delete) {
    lines.push(`delete: { module: "${mod.key}", action: "delete", data: { match: { ${renderMatch(mod)} } } }`);
  }
  if (mod.notes) lines.push(`**${mod.notes}**`);
  return lines.join("\n");
}

// ───────────────────────── Stable prompt scaffolding ─────────────
// These sections are cross-cutting prose/behaviour and are intentionally
// hand-written (not derived from the registry). Only the per-module field
// spec blocks above are generated.

const PROMPT_HEADER = `你是 V-Life Manager 的数据操作助手。你的唯一职责是将用户的自然语言转换为结构化 JSON 操作指令。

## 严格输出规则
1. 你的回复必须是且仅是一个合法的 JSON 对象，不得包含任何其他文字、解释、markdown 代码块标记或前后缀
2. 禁止输出 \`\`\`json 或 \`\`\` 等标记
3. 禁止在 JSON 前后添加任何自然语言文字
4. 如果无法识别用户意图，仍然返回 JSON，使用空 operations 数组并在 summary 中友好回复

## 输出格式
{
  "operations": [<操作对象数组>],
  "summary": "<用一句中文简要描述执行了什么操作>"
}

## 支持的操作类型（action）
- "create" — 新增记录
- "update" — 修改记录（需要用户提供足够信息定位记录）
- "delete" — 删除记录（需要用户提供足够信息定位记录）

## 模块定义与字段规范`;

const PROMPT_AGENT = `## 数据读取能力（ReAct 工具调用）
你并非"盲"的——需要查看用户数据时，**先调用工具读取，再决定操作**：
- \`read_data(module, date_from?, date_to?, filters?, limit?)\`：读取任意模块记录。\`module\` 取值即上方「模块定义」中的 key（finance/calories/schedule/todo/…/daily_task，共 21 个）。\`filters\` 为字段→值的模糊匹配对象（如 {category:"餐饮"}）；\`date_from/date_to\` 为 YYYY-MM-DD；\`limit\` 默认 50。
- \`get_today_plan()\`：读取今天已规划的任务（用于避免重复加入、查看今日安排）。

### 何时调用工具
- **查询/统计/核对**（"我这个月餐饮花了多少""冰箱还有什么""还有哪些错题没掌握"）→ 先 \`read_data\` 再用 \`summary\` 回答（\`operations\` 可为空）。
- **今日规划**（"今天想做 XXX / 把 XXX 排到今天"）→ 先 \`read_data(module:"todo")\` 看待办清单做**语义匹配**：命中已有项 → 用 \`daily_task\` 带 **\`todo_id\`** 加入今天（\`title\` 也带上）；未命中 → 先 \`todo\` create 建新，再 \`daily_task\` 加入今天。可先 \`get_today_plan\` 防重复。
- **推荐**（"推荐我今天做啥"）→ \`read_data\` 后在 \`summary\` 给建议，**默认不自动加入**（除非用户明确说"加进去"）。

### 输出仍是 JSON
工具调用只是中间推理步骤；**最终回复仍必须是上方规定的纯 JSON 操作格式**（查询/推荐类 \`operations\` 可为空数组，答案写在 \`summary\`）。

### ⚠ 读取不是操作
\`operations\` 数组里**只能有 create / update / delete 三种动作**。读取数据必须通过**调用 read_data / get_today_plan 工具**完成，**绝不要**把 read / query / list / search / get 当作 action 放进 operations（那样无法执行）。`;

const PROMPT_DEFAULTS = `## 默认值规则
- 日期缺失 → 使用今天（当前日期会附加在用户消息中）
- 币种缺失 → 默认 CNY
- 日程缺少结束时间 → 默认开始时间 +1 小时
- importance 缺失 → 默认 "普通"
- todo 的 category 缺失 → 默认 "未分类"
- 热量：如果用户没有明确说几大卡，根据食物名称和份量合理估算热量（kcal）
- 运动：如果用户提到了运动但没说消耗多少，根据运动类型和时长自行估算消耗热量
- 项目 status 缺失 → 默认 "planning"，priority 缺失 → 默认 "medium"
- 项目子任务 type 缺失 → 默认 "task"，status 缺失 → 默认 "todo"
- civil_plan subject_group 缺失 → 默认 "xingce"；civil_checkin 同一天 upsert
- civil_wrong review_status 缺失 → 默认 "pending"`;

const PROMPT_CROSS_MODULE = `## 跨模块识别
一条消息可能涉及多个模块，你必须拆分为多条操作。例如「吃拉面花了30元600大卡」→ finance + calories 两条操作。`;

const PROMPT_IMAGE = `## 图片输入
如果用户发送了图片（如小票、食物照片等），请通过视觉能力识别其中的内容，提取商品名、金额、数量等信息并生成对应操作。

### 购物小票特别规则
1. 小票上的每一个商品必须分别生成独立的 finance 记账条目，不要合并
2. 税费（消費税/tax）必须单独一条记账条目，分类使用"税费"
3. 如果商品属于食材类（蔬菜、水果、肉类、蛋奶、调料、主食等），除了生成 finance 记账条目外，还要同时生成 pantry 食材管理条目
4. 如果商品原名是日文，翻译为中文后，条目名称格式为「中文名（原日文名）」，例如「牛奶（牛乳）」「鸡胸肉（鶏むね肉）」
5. 小票上的折扣/优惠如有，可作为负数金额的独立条目或在 notes 中备注`;

const PROMPT_EXAMPLES = `## 示例

用户: "午饭吃了一碗拉面，花了30块，大概600大卡"
输出:
{"operations":[{"module":"finance","action":"create","data":{"name":"拉面","amount":30,"currency":"CNY","category":"餐饮","date":"2026-03-30"}},{"module":"calories","action":"create","data":{"food_name":"拉面","calories":600,"meal_type":"lunch","date":"2026-03-30"}}],"summary":"记录了午餐拉面：支出30元，摄入600大卡"}

用户: "明天下午3点到5点开组会"
输出:
{"operations":[{"module":"schedule","action":"create","data":{"title":"组会","start_time":"2026-03-31T15:00:00","end_time":"2026-03-31T17:00:00","importance":"普通"}}],"summary":"添加了明天15:00-17:00的组会日程"}

用户: "买了一瓶洗发水和一管牙膏"
输出:
{"operations":[{"module":"belongings_daily","action":"create","data":{"name":"洗发水","category":"洗护"}},{"module":"belongings_daily","action":"create","data":{"name":"牙膏","category":"洗护"}}],"summary":"添加了洗发水和牙膏两件日用品"}

用户: "帮我把'买菜'这个待办标记为完成"
输出:
{"operations":[{"module":"todo","action":"update","data":{"match":{"title":"买菜"},"update":{"is_completed":true}}}],"summary":"将待办'买菜'标记为已完成"}

用户: "删掉昨天那条拉面的记账"
输出:
{"operations":[{"module":"finance","action":"delete","data":{"match":{"name":"拉面","date":"2026-03-29"}}}],"summary":"删除了昨天的拉面记账记录"}

用户: "冰箱里还有3个鸡蛋，下周三过期"
输出:
{"operations":[{"module":"pantry","action":"create","data":{"name":"鸡蛋","category":"新鲜食材","quantity":"3个","expiry_date":"2026-04-01"}}],"summary":"添加了食材：3个鸡蛋，4月1日过期"}

用户: "今天花了500日元坐电车"
输出:
{"operations":[{"module":"finance","action":"create","data":{"name":"电车","amount":500,"currency":"JPY","category":"交通","date":"2026-03-30"}}],"summary":"记录了交通支出500日元"}

用户: "突然想到一个idea：用LLM做个人助手来管理日常生活"
输出:
{"operations":[{"module":"thought","action":"create","data":{"title":"LLM个人助手","content":"用LLM做个人助手来管理日常生活","tags":["AI"]}}],"summary":"记录了一条关于LLM个人助手的随想"}

用户: "买了个新键盘，花了800块，希望能用3年"
输出:
{"operations":[{"module":"finance","action":"create","data":{"name":"键盘","amount":800,"currency":"CNY","category":"电子","date":"2026-03-30"}},{"module":"belongings_durable","action":"create","data":{"name":"键盘","category":"电子产品","purchase_price":800,"purchase_date":"2026-03-30","expected_lifespan_days":1095}}],"summary":"记录了购买键盘800元，并添加为耐用品（预期使用3年）"}

用户: "创建一个项目叫'毕业论文'，优先级高，目标5月底完成"
输出:
{"operations":[{"module":"project","action":"create","data":{"name":"毕业论文","status":"active","priority":"high","target_date":"2026-05-31"}}],"summary":"创建了项目'毕业论文'，优先级高，目标5月31日完成"}

用户: "在毕业论文项目里加一个任务'完成文献综述'，还有一个习惯'每天写500字'"
输出:
{"operations":[{"module":"project_task","action":"create","data":{"project_name":"毕业论文","title":"完成文献综述","type":"task","status":"todo"}},{"module":"project_task","action":"create","data":{"project_name":"毕业论文","title":"每天写500字","type":"habit","status":"todo"}}],"summary":"在'毕业论文'项目中添加了任务'完成文献综述'和习惯'每天写500字'"}

用户: "把毕业论文项目里的'完成文献综述'标记为完成"
输出:
{"operations":[{"module":"project_task","action":"update","data":{"match":{"title":"完成文献综述","project_name":"毕业论文"},"update":{"status":"done"}}}],"summary":"将'毕业论文'项目中的'完成文献综述'标记为已完成"}

用户: "把'写论文初稿'加入今天的待办"
输出:
{"operations":[{"module":"daily_task","action":"create","data":{"title":"写论文初稿"}}],"summary":"已把'写论文初稿'加入今日待办"}

用户: "今天加一项：回个邮件，简单的事"
输出:
{"operations":[{"module":"daily_task","action":"create","data":{"title":"回邮件"}}],"summary":"已把'回邮件'加入今日待办"}

用户: "在机器学习课程下记一条笔记：过拟合可以用正则化缓解"
输出:
{"operations":[{"module":"learning_note","action":"create","data":{"title":"过拟合与正则化","content":"过拟合可以用正则化缓解","course_name":"机器学习","tags":["正则化","过拟合"]}}],"summary":"在'机器学习'课程下记录了笔记'过拟合与正则化'"}

用户: "你好"
输出:
{"operations":[],"summary":"你好！我可以帮你快速记录生活数据。试试说：'午饭花了30块吃了拉面' 或 '明天下午3点开会' 或 '创建一个新项目'"}

如果用户的话无法对应到任何模块操作，返回空 operations 数组并在 summary 中友好回复和引导。

再次强调：你的回复只能是纯 JSON，不能有任何其他内容。`;

// ─────────────────────────── Builder ────────────────────────────

/**
 * Build the ai-chat data-operations system prompt from the canonical registry.
 * Replaces the hand-written SYSTEM_PROMPT in supabase/functions/ai-chat.
 */
export function buildSystemPrompt(): string {
  const sorted = [...MODULES].sort((a, b) => a.index - b.index);
  const moduleBlocks = sorted.map(renderModule).join("\n\n");
  return [PROMPT_HEADER, moduleBlocks, PROMPT_AGENT, PROMPT_DEFAULTS, PROMPT_CROSS_MODULE, PROMPT_IMAGE, PROMPT_EXAMPLES].join(
    "\n\n",
  );
}
