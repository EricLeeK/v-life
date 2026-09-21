import { describe, expect, it } from "vitest";
import {
  VOCAB_CAP,
  collectThoughtTags,
  fetchUserVocab,
  formatUserVocabBlock,
  normalizeVocabList,
} from "./userVocab";

describe("normalizeVocabList", () => {
  it("trims, drops blanks and 未分类, and de-dupes in first-seen order", () => {
    expect(
      normalizeVocabList([" 设计 ", "工作", "未分类", "设计", "", "Uncategorized", "AI学习"]),
    ).toEqual(["设计", "工作", "AI学习"]);
  });

  it("caps the list", () => {
    const values = Array.from({ length: VOCAB_CAP + 10 }, (_, i) => `c${i}`);
    expect(normalizeVocabList(values)).toHaveLength(VOCAB_CAP);
  });
});

describe("collectThoughtTags", () => {
  it("merges row tags with settings custom tags", () => {
    expect(
      collectThoughtTags([{ tags: ["灵感", "技术"] }, { tags: ["灵感", "生活"] }], ["自定义"]),
    ).toEqual(["灵感", "技术", "生活", "自定义"]);
  });
});

describe("formatUserVocabBlock", () => {
  it("renders a compact block the model can copy verbatim", () => {
    const block = formatUserVocabBlock({
      todoCategories: ["工作", "设计"],
      dailyBelongingCategories: ["清洁用品"],
      thoughtTags: ["灵感"],
      projectNames: ["毕业论文"],
      courseNames: ["机器学习"],
    });
    expect(block).toContain("## 用户词表");
    expect(block).toContain("todo.category: 工作、设计");
    expect(block).toContain("belongings_daily.category: 清洁用品");
    expect(block).toContain("thought.tags: 灵感");
    expect(block).toContain("project: 毕业论文");
    expect(block).toContain("course: 机器学习");
    expect(block).toContain("原样使用");
    expect(block).not.toMatch(/\{\s*"operations"/);
  });

  it("still tells the model open fields can be created when the user has no vocab yet", () => {
    const block = formatUserVocabBlock({
      todoCategories: [],
      dailyBelongingCategories: [],
      thoughtTags: [],
      projectNames: [],
      courseNames: [],
    });
    expect(block).toContain("## 用户词表");
    expect(block).toContain("可按用户原词新建");
    expect(block).not.toContain("todo.category:");
  });
});

describe("fetchUserVocab", () => {
  it("reads distinct values from a supabase-like client", async () => {
    const tables: Record<string, unknown[]> = {
      todos: [{ category: "工作" }, { category: "设计" }, { category: "工作" }],
      belongings_daily: [{ category: "清洁用品" }],
      thoughts: [{ tags: ["灵感"] }],
      projects: [{ name: "毕业论文" }],
      learning_courses: [{ name: "机器学习" }],
    };
    const sb = {
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            limit: async () => ({ data: tables[table] || [], error: null }),
          }),
        }),
      }),
    };
    const snap = await fetchUserVocab(sb, { custom_thought_tags: ["自定义"] });
    expect(snap.todoCategories).toEqual(["工作", "设计"]);
    expect(snap.dailyBelongingCategories).toEqual(["清洁用品"]);
    expect(snap.thoughtTags).toEqual(["灵感", "自定义"]);
    expect(snap.projectNames).toEqual(["毕业论文"]);
    expect(snap.courseNames).toEqual(["机器学习"]);
  });
});
