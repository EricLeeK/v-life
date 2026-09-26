/**
 * Compact per-user vocabulary for the ai-chat system prompt.
 *
 * Open fields (todo.category, daily belonging category, thought tags, plus
 * project/course names) are user-defined. Injecting DISTINCT values is much
 * cheaper than dumping records, and unlike a tool call it is visible even
 * when the model would otherwise trust a stale closed enum.
 *
 * PLATFORM-AGNOSTIC: no Deno/npm imports. The fetch helper takes a duck-typed
 * Supabase client so Vite tests and the edge function can share it.
 */

export const VOCAB_CAP = 40;
const RECENT_ROW_CAP = 200;

const SKIP = new Set(["", "未分类", "Uncategorized"]);

export type UserVocabSnapshot = {
  todoCategories: string[];
  dailyBelongingCategories: string[];
  subscriptionCategories?: string[];
  thoughtTags: string[];
  projectNames: string[];
  courseNames: string[];
};

export type VocabClient = {
  from: (table: string) => any;
};

export function normalizeVocabList(values: unknown[], cap = VOCAB_CAP): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s || SKIP.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

export function collectThoughtTags(rows: { tags?: unknown }[], extra?: unknown): string[] {
  const values: unknown[] = [];
  for (const r of rows) {
    if (Array.isArray(r.tags)) values.push(...r.tags);
  }
  if (Array.isArray(extra)) values.push(...extra);
  return normalizeVocabList(values);
}

export function emptyUserVocab(): UserVocabSnapshot {
  return {
    todoCategories: [],
    dailyBelongingCategories: [],
    subscriptionCategories: [],
    thoughtTags: [],
    projectNames: [],
    courseNames: [],
  };
}

export function formatUserVocabBlock(snap: UserVocabSnapshot): string {
  const lines = ["## 用户词表（以实际数据为准，覆盖默认枚举）"];
  const rows: Array<[string, string[]]> = [
    ["todo.category", snap.todoCategories],
    ["belongings_daily.category", snap.dailyBelongingCategories],
    ["subscription.category", snap.subscriptionCategories ?? []],
    ["thought.tags", snap.thoughtTags],
    ["project", snap.projectNames],
    ["course", snap.courseNames],
  ];
  let any = false;
  for (const [key, vals] of rows) {
    if (vals.length === 0) continue;
    any = true;
    lines.push(`${key}: ${vals.join("、")}`);
  }
  if (!any) {
    lines.push("（暂无自定义分类/标签/项目/课程。开放字段可按用户原词新建。）");
  } else {
    lines.push(
      "开放字段必须优先原样使用上列值；没有的可以新建。封闭枚举（记账分类、餐型、币种等）仍只用模块定义里的值。定位具体条目请 read_data，词表不是完整清单。",
    );
  }
  return lines.join("\n");
}

async function columnValues(
  sb: VocabClient,
  table: string,
  column: string,
): Promise<unknown[]> {
  try {
    const { data, error } = await sb.from(table).select(column).order("updated_at", { ascending: false }).limit(RECENT_ROW_CAP);
    if (error || !data) return [];
    return data.map((row: any) => row?.[column]);
  } catch {
    return [];
  }
}

async function nameValues(sb: VocabClient, table: string): Promise<string[]> {
  try {
    const { data, error } = await sb.from(table).select("name").order("updated_at", { ascending: false }).limit(VOCAB_CAP);
    if (error || !data) return [];
    return normalizeVocabList(data.map((row: any) => row?.name));
  } catch {
    return [];
  }
}

export async function fetchUserVocab(
  sb: VocabClient,
  settings?: { custom_thought_tags?: unknown } | null,
): Promise<UserVocabSnapshot> {
  const [todoRows, dailyRows, thoughtRows, projectNames, courseNames, subscriptionRows] = await Promise.all([
    columnValues(sb, "todos", "category"),
    columnValues(sb, "belongings_daily", "category"),
    (async () => {
      try {
        const { data, error } = await sb.from("thoughts").select("tags").order("updated_at", { ascending: false }).limit(RECENT_ROW_CAP);
        if (error || !data) return [];
        return data as { tags?: unknown }[];
      } catch {
        return [];
      }
    })(),
    nameValues(sb, "projects"),
    nameValues(sb, "learning_courses"),
    columnValues(sb, "subscriptions", "category"),
  ]);

  return {
    todoCategories: normalizeVocabList(todoRows),
    dailyBelongingCategories: normalizeVocabList(dailyRows),
    subscriptionCategories: normalizeVocabList(subscriptionRows),
    thoughtTags: collectThoughtTags(thoughtRows, settings?.custom_thought_tags),
    projectNames,
    courseNames,
  };
}
