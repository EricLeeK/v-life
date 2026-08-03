import { describe, expect, it } from "vitest";
import { buildFortuneUserPrompt } from "./aiReading";

describe("buildFortuneUserPrompt", () => {
  it("includes kind and facts", () => {
    const p = buildFortuneUserPrompt({
      kind: "tarot",
      facts: { cards: 3 },
      lang: "zh",
      question: "今日指引",
    });
    expect(p).toContain("kind: tarot");
    expect(p).toContain("今日指引");
    expect(p).toContain('"cards":3');
  });

  it("daily prompt treats facts as reference for free writing", () => {
    const p = buildFortuneUserPrompt({
      kind: "daily",
      facts: { moon: { phase: "亏凸月" }, almanac: { yi: ["祭祀"] } },
      lang: "zh",
    });
    expect(p).toContain("仅供参考");
    expect(p).toContain("自己写");
  });
});
