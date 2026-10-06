import { describe, expect, it } from "vitest";
import { buildPaperLayout } from "./paperLayout";
import type { NewspaperEntry, NewspaperReport, NewspaperSection } from "../../../supabase/functions/_shared/newspaperTypes";

const entry = (id: string, status: NewspaperEntry["status"], body = "", time?: string) => ({
  id,
  source: "todos",
  source_id: id,
  source_url: "/todos",
  title: `事项 ${id}`,
  body,
  status,
  ...(time ? { time } : {}),
});
const report = (sections: NewspaperSection[], extra: Partial<NewspaperReport> = {}): NewspaperReport => ({
  id: "layout-report", date: "2026-10-03", status: "archived",
  timezone: "Asia/Shanghai", day_start_hour: 4, revision: 1,
  snapshot: {
    date: "2026-10-03", timezone: "Asia/Shanghai", day_start_hour: 4,
    captured_at: "2026-10-03T00:00:00Z", source_fingerprint: "layout",
    sections, metrics: [], coverage: [],
  },
  supplements: [], review: null, jobs: [], source_changed: false, review_stale: false,
  created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z",
  assets: [],
  hidden_sections: [],
  ...extra,
});

describe("paper layout", () => {
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
