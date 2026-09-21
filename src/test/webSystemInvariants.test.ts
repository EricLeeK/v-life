import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("desktop web system invariants", () => {
  it("uses theme-aware card surfaces instead of fixed white Tailwind surfaces", () => {
    const files = [
      "src/components/AppSidebar.tsx",
      "src/components/civil-service/ExamCountdown.tsx",
      "src/components/civil-service/DailyPlanList.tsx",
      "src/components/civil-service/CheckinCard.tsx",
      "src/pages/Index.tsx",
      "src/pages/Todos.tsx",
      "src/pages/Settings.tsx",
    ];

    for (const file of files) expect(read(file), file).not.toMatch(/\bbg-white\b/);
  });

  it("does not globally collapse every animation and transition to 0.01ms", () => {
    const css = read("src/index.css");
    expect(css).not.toContain("animation-duration: 0.01ms !important");
    expect(css).not.toContain("transition-duration: 0.01ms !important");
  });

  it("keeps the primary sidebar icon asset lightweight", () => {
    expect(statSync(resolve(root, "public/v-life-icon.svg")).size).toBeLessThan(20_000);
  });
});
