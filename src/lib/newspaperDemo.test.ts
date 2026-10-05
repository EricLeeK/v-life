import { describe, expect, it } from "vitest";
import { createNewspaperDemo, executeNewspaperDemo } from "./newspaperDemo";

describe("newspaper demo workflows", () => {
  it("keeps verbatim supplements and rejects a stale edit", () => {
    const state = createNewspaperDemo(new Date("2026-09-28T12:00:00Z"));
    const date = state.reports[0].date;
    const body = "  原文第一行\n\n第二行，保留空格。  ";
    const added = executeNewspaperDemo(state, "supplement_save", {
      date,
      body,
    });
    const saved = added.state.reports[0].supplements.at(-1)!;
    expect(saved.body).toBe(body);
    expect(() =>
      executeNewspaperDemo(added.state, "supplement_save", {
        date,
        id: saved.id,
        body: "覆盖",
        expected_updated_at: "old",
      })
    ).toThrow();
    expect(added.state.reports[0].supplements.at(-1)!.body).toBe(body);
  });
  it("keeps historical papers unchanged when another day changes", () => {
    const state = createNewspaperDemo(new Date("2026-09-28T12:00:00Z"));
    const historical = JSON.stringify(state.reports[1]);
    const result = executeNewspaperDemo(state, "report_update", {
      date: state.reports[0].date,
      hidden_sections: ["finance"],
    });
    expect(JSON.stringify(result.state.reports[1])).toBe(historical);
    expect(result.state.reports[0].hidden_sections).toEqual(["finance"]);
  });
  it("returns a clearly marked demo image and supports active candidate selection", () => {
    const state = createNewspaperDemo(new Date("2026-09-28T12:00:00Z"));
    const date = state.reports[0].date;
    const result = executeNewspaperDemo(state, "image_generate", {
      date,
      section_id: "main",
    });
    const image = result.state.reports[0].assets[0];
    expect(image.caption).toContain("演示");
    expect(image.active).toBe(true);
    expect(result.state.reports[0].jobs[0].status).toBe("succeeded");
  });
});
