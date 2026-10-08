export function visibleQuestionIds(
  bankIds: string[],
  exceptions: { question_id: string; mode: string }[],
) {
  const ids = new Set([
    ...bankIds,
    ...exceptions.filter((e) => e.mode === "include").map((e) => e.question_id),
  ]);
  exceptions
    .filter((e) => e.mode === "exclude")
    .forEach((e) => ids.delete(e.question_id));
  return [...ids];
}
export function normalizeAnswer(answer: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(answer) ? answer : answer == null ? [] : [answer])
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].sort();
}
export function gradeAttempt(
  answer: unknown,
  expected: unknown,
  seconds: number,
  target: number | null,
) {
  const a = normalizeAnswer(answer),
    b = normalizeAnswer(expected);
  const correct =
    a.length > 0 && b.length > 0 && JSON.stringify(a) === JSON.stringify(b);
  const yellow = correct && target != null && target > 0 && seconds > target;
  return { correct, yellow, rating: !correct ? 1 : yellow ? 2 : 3 };
}
export function selectExamPreview<
  T extends { exam_date: string; is_primary?: boolean; is_archived?: boolean },
>(exams: T[], today: string, limit = 6): T[] {
  return exams
    .filter((e) => !e.is_archived)
    .sort(
      (a, b) =>
        Number(!!b.is_primary) - Number(!!a.is_primary) ||
        Number(a.exam_date < today) - Number(b.exam_date < today) ||
        (a.exam_date < today
          ? b.exam_date.localeCompare(a.exam_date)
          : a.exam_date.localeCompare(b.exam_date)),
    )
    .slice(0, limit);
}
export const REASON_TAGS = [
  "知识不会",
  "方法不熟",
  "审题疏漏",
  "计算失误",
  "概念混淆",
  "陷阱误判",
  "速度不足",
];
export const CIVIL_SECTIONS = [
  "政治理论",
  "常识判断",
  "言语理解",
  "数量关系",
  "图形推理",
  "逻辑判断",
  "定义判断与类比推理",
  "资料分析",
];
export interface PrepExam {
  id: string;
  name: string;
  exam_date: string;
  template: "civil" | null;
  is_primary: boolean;
  is_archived: boolean;
}
export interface PrepQuestion {
  id: string;
  stem_md: string;
  question_type: "single" | "multiple" | "judgement" | "text";
  options: { key: string; content_md: string }[];
  correct_answer: unknown;
  explanation_md: string;
  analysis_md: string;
  tags: string[];
  target_seconds: number | null;
  material_id: string | null;
  revision: number;
  status: "draft" | "active" | "archived";
}
export interface PrepMaterial {
  id: string;
  content_md: string;
  revision: number;
}
export interface PrepReviewState {
  question_id: string;
  due_at: string | null;
  revision: number;
  paused: boolean;
  fsrs: Record<string, unknown>;
}
