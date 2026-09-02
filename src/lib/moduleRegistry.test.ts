import { describe, expect, it } from "vitest";
import {
  MODULES,
  MODULE_KEYS,
  buildSystemPrompt,
  createFieldsOf,
  getModuleLabels,
  moduleByKey,
  tableOf,
  allQueryKeys,
} from "@modules";

describe("MODULES integrity", () => {
  it("has exactly 22 modules", () => {
    expect(MODULES).toHaveLength(22);
  });

  it("has unique keys", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
  });

  it("has unique tables", () => {
    const tables = MODULES.map((m) => m.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("every module has key/table/labelZh/labelEn/headingZh", () => {
    for (const m of MODULES) {
      expect(m.key).toBeTruthy();
      expect(m.table).toBeTruthy();
      expect(m.labelZh).toBeTruthy();
      expect(m.labelEn).toBeTruthy();
      expect(m.headingZh).toBeTruthy();
    }
  });

  it("module indices are 1..22 contiguous", () => {
    const indices = MODULES.map((m) => m.index).sort((a, b) => a - b);
    expect(indices).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it("no internal field appears in any updateFields list", () => {
    for (const m of MODULES) {
      for (const name of m.updateFields ?? []) {
        const f = m.fields.find((x) => x.name === name);
        expect(f, `${m.key}.${name} listed in updateFields but not defined`).toBeDefined();
        expect(f?.internal, `${m.key}.${name} is internal but listed in updateFields`).toBeFalsy();
      }
    }
  });
});

describe("derived helpers", () => {
  it("tableOf maps all module keys to their table", () => {
    for (const m of MODULES) {
      expect(tableOf(m.key)).toBe(m.table);
    }
    expect(tableOf("does_not_exist")).toBeUndefined();
  });

  it("createFieldsOf excludes internal and updateOnly fields", () => {
    const finance = createFieldsOf("finance").map((f) => f.name);
    expect(finance).not.toContain("amount_cny");
    expect(finance).not.toContain("exchange_rate");
    expect(finance).toEqual(["name", "amount", "currency", "category", "date", "notes"]);

    // todo.is_completed is updateOnly → excluded from create
    const todo = createFieldsOf("todo").map((f) => f.name);
    expect(todo).not.toContain("is_completed");
    expect(todo).toContain("kind");
    expect(todo).toContain("habit_type");
  });

  it("moduleByKey covers all modules", () => {
    for (const key of MODULE_KEYS) {
      expect(moduleByKey[key]).toBeDefined();
    }
  });

  it("getModuleLabels returns a label for every module", () => {
    const labels = getModuleLabels((zh, en) => `${zh}/${en}`);
    expect(Object.keys(labels).sort()).toEqual([...MODULE_KEYS].sort());
    expect(labels.finance).toBe("记账/Finance");
  });

  it("allQueryKeys dedupes and covers the known namespaces", () => {
    const keys = allQueryKeys();
    // the two belongings modules share the "belongings" namespace → deduped to one
    expect(keys).toContain("belongings");
    expect(keys.filter((k) => k === "belongings")).toHaveLength(1);
    // 22 modules, minus 1 because belongings_daily + belongings_durable collapse to one key
    expect(keys).toContain("todo_habit_logs");
    expect(keys).toHaveLength(21);
  });
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt();

  it("renders all 22 module headings", () => {
    for (const m of MODULES) {
      expect(prompt).toContain(`### ${m.index}. ${m.key}（${m.headingZh}）`);
    }
  });

  it("contains the stable scaffolding sections", () => {
    expect(prompt).toContain("## 严格输出规则");
    expect(prompt).toContain("## 输出格式");
    expect(prompt).toContain("## 支持的操作类型（action）");
    expect(prompt).toContain("## 模块定义与字段规范");
    expect(prompt).toContain("## 默认值规则");
    expect(prompt).toContain("## 开放字段与封闭字段");
    expect(prompt).toContain("## 跨模块识别");
    expect(prompt).toContain("## 图片输入");
    expect(prompt).toContain("### 购物小票特别规则");
    expect(prompt).toContain("## 示例");
  });

  it("forbids asking the user to pick habit vs routine", () => {
    expect(prompt).toContain("禁止在 summary 里问「这是习惯还是例行」");
    expect(prompt).toContain("我想每天喝八杯水");
    expect(prompt).toContain("查工作邮箱要经常做");
    expect(prompt).toContain("冥想打卡了");
  });

  it("uses the corrected rule 4 (empty operations, not a phantom chat type)", () => {
    expect(prompt).toContain("如果无法识别用户意图，仍然返回 JSON，使用空 operations 数组并在 summary 中友好回复");
    expect(prompt).not.toContain("使用 chat 类型");
  });

  it("renders enums as unions in create specs", () => {
    expect(prompt).toContain('currency: "CNY"|"JPY"');
    expect(prompt).toContain('meal_type: "breakfast"|"lunch"|"dinner"|"snack"|"exercise"');
    // finance category enum must include the 税费 category
    expect(prompt).toContain('"税费"');
  });

  it("treats todo and daily-belonging categories as open vocab, not a fake closed enum", () => {
    expect(prompt).not.toContain('"工作"|"学习"|"学业"|"生活"|"健康"|"考公"|"未分类"');
    expect(prompt).not.toContain('"洗护"|"清洁"|"厨房"|"文具"|"其他"');
    expect(prompt).toMatch(/### 4\. todo[\s\S]*?category\?: string/);
    expect(prompt).toContain("## 开放字段与封闭字段");
    expect(prompt).toContain("「用户词表」为准");
  });

  it("keeps internal computed columns out of the prompt", () => {
    expect(prompt).not.toContain("amount_cny");
    expect(prompt).not.toContain("exchange_rate");
  });

  it("renders finance with the exact category constraint note", () => {
    expect(prompt).toContain("【严格约束】category 必须且只能是上述枚举值之一");
  });

  it("renders daily_task delete with a required match title", () => {
    expect(prompt).toContain('delete: { module: "daily_task", action: "delete", data: { match: { title: string } } }');
  });

  it("renders civil_wrong options with its complex type", () => {
    expect(prompt).toContain("options?: [{key: string, text: string}]");
  });

  it("preserves all 15 few-shot examples", () => {
    // a representative sample of example anchors
    expect(prompt).toContain("午饭吃了一碗拉面");
    expect(prompt).toContain("买了一瓶洗发水和一管牙膏");
    expect(prompt).toContain("买了个新键盘");
    expect(prompt).toContain("把'写论文初稿'加入今天的待办");
    expect(prompt).toContain("在机器学习课程下记一条笔记");
    expect(prompt).toContain("你好");
  });

  it("emits create only for modules that support it, and omits it otherwise", () => {
    // civil_checkin supports only create
    expect(prompt).toMatch(/### 16\. civil_checkin[\s\S]*?create: \{ module: "civil_checkin"/);
    // it must NOT contain a civil_checkin update/delete line
    expect(prompt).not.toContain('action: "update", data: { match: { date?');
  });
});
