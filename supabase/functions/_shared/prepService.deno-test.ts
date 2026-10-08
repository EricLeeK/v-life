import {
  gradePrepAnswer,
  nextPrepReview,
  evaluatePrepAttempt,
} from "./prepService.ts";
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
Deno.test("grades selection sets and scalar legacy answers", () => {
  assert(gradePrepAnswer(["A", "C"], ["C", "A"]) === true, "set order");
  assert(gradePrepAnswer("A", ["A"]) === true, "scalar migration");
  assert(gradePrepAnswer(["A"], ["B"]) === false, "wrong selection");
  assert(gradePrepAnswer(null, "A") === null, "ungraded");
});
Deno.test("FSRS serialized state advances; legacy state starts fresh", () => {
  const now = new Date("2026-10-08T00:00:00Z");
  const first = nextPrepReview({ legacy_interval_days: 7 }, 3, now);
  assert(first.fsrs.reps === 1, "first real review");
  const second = nextPrepReview(first.fsrs, 3, new Date(first.due_at));
  assert(second.fsrs.reps === 2, "restores serialized state");
  assert(new Date(second.due_at) > new Date(first.due_at), "advances due");
  const again = nextPrepReview(null, 1, now),
    easy = nextPrepReview(null, 4, now);
  assert(
    new Date(again.due_at) < new Date(easy.due_at),
    "rating discriminates",
  );
});

Deno.test(
  "server computes yellow and grades text by explicit self report",
  () => {
    const question = {
      correct_answer: ["A"],
      question_type: "single",
      target_seconds: 30,
      revision: 1,
    };
    const input = {
      question_id: "q",
      idempotency_key: "i",
      content_revision: 1,
      expected_revision: 0,
      answer: ["A"],
      duration_seconds: 31,
      mode: "review" as const,
      rating: 4 as const,
    };
    const slow = evaluatePrepAttempt(question, input);
    assert(
      slow.correct === true && slow.yellow && slow.rating === 2,
      "slow correct capped to hard",
    );
    const wrong = evaluatePrepAttempt(question, { ...input, answer: ["B"] });
    assert(wrong.correct === false && wrong.rating === 1, "wrong forced again");
    const subjective = evaluatePrepAttempt(
      { ...question, question_type: "text" },
      { ...input, answer: "free response", self_correct: true },
    );
    assert(subjective.correct === true, "subjective explicit self grade");
    const stale = evaluatePrepAttempt({ ...question, revision: 2 }, input);
    assert(
      stale.correct === null,
      "cannot grade old answer against revised key",
    );
  },
);
