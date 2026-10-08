/** Authoritative preparation scheduler. Import only from server Edge Functions.
 * Call with a service-role client AFTER authenticating/authorizing the user.
 * ts-fsrs is pinned; do not replace this with a client-supplied next-state payload.
 */
import {
  createEmptyCard,
  fsrs,
  type Card,
  type Grade,
} from "npm:ts-fsrs@5.4.2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
export type PrepAttemptInput = {
  question_id: string;
  idempotency_key: string;
  content_revision: number;
  answer?: unknown;
  duration_seconds?: number;
  correct?: boolean;
  self_correct?: boolean;
  expected_revision?: number;
  yellow?: boolean;
  reason_tags?: string[];
  mode: "practice" | "review";
  rating?: 1 | 2 | 3 | 4;
  exam_id?: string;
};
const scheduler = fsrs({ enable_fuzz: false });
export function nextPrepReview(
  state: Record<string, unknown> | null,
  rating: 1 | 2 | 3 | 4,
  now = new Date(),
) {
  // Legacy interval metadata is retained in the DB, but is not represented as
  // fictional FSRS review history. Its first real review starts a fresh card.
  const card =
    state && typeof state.state === "number" && typeof state.reps === "number"
      ? ({
          ...state,
          due: new Date(String(state.due)),
          ...(state.last_review
            ? { last_review: new Date(String(state.last_review)) }
            : {}),
        } as Card)
      : createEmptyCard(now);
  const next = scheduler.next(card, now, rating as Grade);
  return {
    fsrs: JSON.parse(JSON.stringify(next.card)) as Record<string, unknown>,
    due_at: next.card.due.toISOString(),
  };
}
/** Order-insensitive selections, exact normalized free text, tri-state when no key exists. */
export function gradePrepAnswer(
  expected: unknown,
  answer: unknown,
): boolean | null {
  if (expected === null || expected === undefined || expected === "")
    return null;
  const normalized = (v: unknown): string =>
    Array.isArray(v)
      ? JSON.stringify(v.map((x) => String(x).trim()).sort())
      : typeof v === "string"
        ? v.trim()
        : JSON.stringify(v);
  // A one-item selected-option array and its scalar answer are equivalent.
  const e =
    Array.isArray(expected) && expected.length === 1 ? expected[0] : expected;
  const a = Array.isArray(answer) && answer.length === 1 ? answer[0] : answer;
  return normalized(e) === normalized(a);
}
export function evaluatePrepAttempt(
  question: {
    correct_answer: unknown;
    question_type: string;
    target_seconds: number | null;
    revision: number;
  },
  input: PrepAttemptInput,
) {
  const correct =
    question.revision !== input.content_revision
      ? null
      : question.question_type === "text"
        ? (input.self_correct ?? null)
        : gradePrepAnswer(question.correct_answer, input.answer);
  const yellow =
    Boolean(input.yellow) ||
    (question.target_seconds !== null &&
      input.duration_seconds !== undefined &&
      input.duration_seconds > question.target_seconds);
  const rating =
    correct !== true
      ? 1
      : yellow
        ? Math.min(input.rating ?? 2, 2)
        : input.rating;
  return { correct, yellow, rating };
}
export async function submitPrepAttempt(
  db: Pick<SupabaseClient, "from" | "rpc">,
  userId: string,
  input: PrepAttemptInput,
) {
  if (
    !input.question_id ||
    !input.idempotency_key ||
    !Number.isInteger(input.content_revision) ||
    input.content_revision < 1
  )
    throw new Error("INVALID_ATTEMPT");
  if (!["practice", "review"].includes(input.mode))
    throw new Error("INVALID_ATTEMPT_MODE");
  if (
    input.duration_seconds !== undefined &&
    (!Number.isInteger(input.duration_seconds) || input.duration_seconds < 0)
  )
    throw new Error("INVALID_DURATION");
  if (
    input.mode === "review" &&
    (!Number.isInteger(input.expected_revision) || input.expected_revision! < 0)
  )
    throw new Error("REVIEW_REVISION_REQUIRED");
  if (
    input.mode === "review" &&
    (input.answer == null || input.duration_seconds === undefined)
  )
    throw new Error("ANSWER_AND_DURATION_REQUIRED");
  if (input.mode === "review" && ![1, 2, 3, 4].includes(input.rating ?? 0))
    throw new Error("REVIEW_RATING_REQUIRED");
  const now = new Date();
  // The presented review revision is retained across races; SQL downgrades stale
  // tabs to practice rather than scheduling a second review.
  for (let retry = 0; retry < 3; retry++) {
    const [{ data: question, error: qe }, { data: state, error: se }] =
      await Promise.all([
        db
          .from("prep_questions")
          .select("id,correct_answer,question_type,target_seconds,revision")
          .eq("user_id", userId)
          .eq("id", input.question_id)
          .maybeSingle(),
        db
          .from("prep_review_states")
          .select("fsrs,revision,paused")
          .eq("user_id", userId)
          .eq("question_id", input.question_id)
          .maybeSingle(),
      ]);
    if (qe || se) throw new Error(qe?.message ?? se?.message);
    if (!question) throw new Error("QUESTION_NOT_FOUND");
    if (
      question.question_type === "text" &&
      typeof input.self_correct !== "boolean"
    )
      throw new Error("SELF_ASSESSMENT_REQUIRED");
    const { correct, yellow, rating } = evaluatePrepAttempt(question, input);
    const next = nextPrepReview(
      state?.fsrs ?? null,
      (rating ?? 1) as 1 | 2 | 3 | 4,
      now,
    );
    const { data, error } = await db.rpc("prep_commit_attempt", {
      p_user_id: userId,
      p_question_id: input.question_id,
      p_idempotency_key: input.idempotency_key,
      p_input: { ...input, correct, yellow, rating },
      p_state_revision: input.expected_revision ?? state?.revision ?? 0,
      p_fsrs: next.fsrs,
      p_due_at: next.due_at,
    });
    if (!error) return data;
    if (error.code !== "40001") throw new Error(error.message);
  }
  throw new Error("REVIEW_CONFLICT_RETRY");
}
