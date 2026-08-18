import { describe, expect, it } from "vitest";
import { noteTextFromAiChat } from "./aiNoteResponse";

describe("noteTextFromAiChat", () => {
  it("reads plain-text note mode content", () => {
    expect(noteTextFromAiChat({ content: "# 标题\n正文", mode: "note" })).toBe("# 标题\n正文");
  });

  it("strips markdown fences", () => {
    expect(noteTextFromAiChat({ content: "```markdown\n# Hi\n```" })).toBe("# Hi");
  });

  it("does not treat agent JSON as success text", () => {
    expect(
      noteTextFromAiChat({
        result: { operations: [], summary: "should not be used" },
        raw: "{\"operations\":[]}",
      }),
    ).toBe("");
  });

  it("strips emoji from AI note output", () => {
    expect(noteTextFromAiChat({ content: "## 要点 ✨\n- 结论 🎓" })).toBe("## 要点\n- 结论");
  });
});
