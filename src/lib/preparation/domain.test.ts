import { describe, expect, it } from "vitest";
import {
  visibleQuestionIds,
  gradeAttempt,
  selectExamPreview,
  normalizeAnswer,
} from "./domain";
describe("preparation shared questions", () => {
  it("deduplicates banks and gives exclusions priority", () => {
    expect(
      visibleQuestionIds(
        ["a", "a", "b"],
        [
          { question_id: "b", mode: "exclude" },
          { question_id: "c", mode: "include" },
        ],
      ),
    ).toEqual(["a", "c"]);
  });
  it("keeps an accurate but slow answer yellow", () => {
    expect(gradeAttempt(["B"], ["B"], 91, 90)).toEqual({
      correct: true,
      yellow: true,
      rating: 2,
    });
    expect(gradeAttempt(["B"], ["B"], 90, 90)).toEqual({
      correct: true,
      yellow: false,
      rating: 3,
    });
  });
  it("does not invent a speed threshold and normalizes multi-select", () => {
    expect(gradeAttempt(["B", "A"], ["A", "B"], 900, null).yellow).toBe(false);
    expect(normalizeAnswer(["B", "A", "A"])).toEqual(["A", "B"]);
    expect(gradeAttempt([], ["A"], 1, null).rating).toBe(1);
  });
  it("caps the homepage and orders upcoming exams before past ones", () => {
    const exams = [
      { id: "past", exam_date: "2026-01-01" },
      { id: "later", exam_date: "2026-12-01" },
      { id: "soon", exam_date: "2026-10-09" },
    ];
    expect(selectExamPreview(exams, "2026-10-08", 2).map((e) => e.id)).toEqual([
      "soon",
      "later",
    ]);
  });
});
