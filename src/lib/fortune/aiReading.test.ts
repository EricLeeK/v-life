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
});
