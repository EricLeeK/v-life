import { describe, expect, it } from "vitest";
import { buildPaperLayout, packRows } from "./paperLayout";

const entry = (id: string, status: string, body = "", time?: string) => ({
  id,
  source: "todos",
  source_id: id,
  source_url: "/todos",
  title: `事项 ${id}`,
  body,
  status,
  ...(time ? { time } : {}),
});
const report = (sections: any[], extra: any = {}): any => ({
  date: "2026-10-03",
  snapshot: { sections, metrics: [], coverage: [] },
  assets: [],
  hidden_sections: [],
  ...extra,
});

describe("paper layout", () => {
  it("fills every row to exactly twelve columns", () => {
    const rows = packRows([{ span: 8 }, { span: 6 }, { span: 4 }, { span: 4 }]);
    expect(rows.map((r) => r.reduce((n, m) => n + m.span, 0))).toEqual([12, 12]);
    expect(packRows([{ span: 4 }]).flat()[0].span).toBe(12);
  });

  it("lifts one lead story out of its section so nothing prints twice", () => {
    const layout = buildPaperLayout(report([
      {
        id: "chronicle",
        title: "今日纪事",
        items: [entry("a", "completed", "长".repeat(200)), entry("b", "recorded")],
      },
    ]));
    expect(layout.lead?.id).toBe("a");
    const printed = layout.modules.flatMap((m) => m.items.map((e) => e.id));
    expect(printed).toEqual(["b"]);
  });

  it("keeps plans out of finished work and never leads with a plan", () => {
    const layout = buildPaperLayout(report([
      {
        id: "chronicle",
        title: "今日纪事",
        items: [entry("p", "planned", "很长的计划".repeat(80)), entry("d", "completed")],
      },
    ]));
    expect(layout.lead?.id).toBe("d");
    expect(layout.completed).toBe(1);
    expect(layout.planned).toBe(1);
    const pending = layout.modules.find((m) => m.section === "pending");
    expect(pending?.items.map((e) => e.id)).toEqual(["p"]);
    expect(layout.modules.find((m) => m.section === "chronicle")).toBeUndefined();
  });

  it("respects hidden sections and orders the chronicle by time", () => {
    const layout = buildPaperLayout(report([
      {
        id: "chronicle",
        title: "今日纪事",
        items: [
          entry("late", "recorded", "", "2026-10-03T15:00:00Z"),
          entry("early", "recorded", "", "2026-10-03T01:00:00Z"),
          entry("lead", "completed", "正文".repeat(300)),
        ],
      },
      { id: "thoughts", title: "想法与随笔", items: [entry("t", "recorded")] },
    ], { hidden_sections: ["thoughts"] }));
    expect(layout.modules.map((m) => m.section)).toEqual(["chronicle"]);
    expect(layout.modules[0].items.map((e) => e.id)).toEqual(["early", "late"]);
  });
});
