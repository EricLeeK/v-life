import { addDays, format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export type CivilXingcePaper = Tables<"civil_xingce_papers">;

export type SubjectScoreKey =
  | "verbal"
  | "data"
  | "graphic"
  | "logic"
  | "analogy"
  | "quantity"
  | "common";

export const XINGCE_SUBJECT_FIELDS: Array<{
  key: SubjectScoreKey;
  labelZh: string;
  labelEn: string;
  total: keyof CivilXingcePaper;
  correct: keyof CivilXingcePaper;
}> = [
  { key: "verbal", labelZh: "言语理解", labelEn: "Verbal", total: "verbal_total", correct: "verbal_correct" },
  { key: "data", labelZh: "资料分析", labelEn: "Data", total: "data_total", correct: "data_correct" },
  { key: "graphic", labelZh: "图形推理", labelEn: "Graphic", total: "graphic_total", correct: "graphic_correct" },
  { key: "logic", labelZh: "逻辑推理", labelEn: "Logic", total: "logic_total", correct: "logic_correct" },
  { key: "analogy", labelZh: "定义类比", labelEn: "Analogy", total: "analogy_total", correct: "analogy_correct" },
  { key: "quantity", labelZh: "数量关系", labelEn: "Quantity", total: "quantity_total", correct: "quantity_correct" },
  { key: "common", labelZh: "时政常识", labelEn: "Common", total: "common_total", correct: "common_correct" },
];

export function rate(correct: number, total: number): number | null {
  if (!total || total <= 0) return null;
  return Math.round((correct / total) * 1000) / 10;
}

export function paperTotals(paper: Pick<
  CivilXingcePaper,
  | "verbal_total" | "verbal_correct"
  | "data_total" | "data_correct"
  | "graphic_total" | "graphic_correct"
  | "logic_total" | "logic_correct"
  | "analogy_total" | "analogy_correct"
  | "quantity_total" | "quantity_correct"
  | "common_total" | "common_correct"
>) {
  const total =
    paper.verbal_total + paper.data_total + paper.graphic_total + paper.logic_total +
    paper.analogy_total + paper.quantity_total + paper.common_total;
  const correct =
    paper.verbal_correct + paper.data_correct + paper.graphic_correct + paper.logic_correct +
    paper.analogy_correct + paper.quantity_correct + paper.common_correct;
  const judgmentTotal = paper.graphic_total + paper.logic_total + paper.analogy_total;
  const judgmentCorrect = paper.graphic_correct + paper.logic_correct + paper.analogy_correct;
  return {
    total,
    correct,
    overallRate: rate(correct, total),
    judgmentTotal,
    judgmentCorrect,
    judgmentRate: rate(judgmentCorrect, judgmentTotal),
    verbalRate: rate(paper.verbal_correct, paper.verbal_total),
    dataRate: rate(paper.data_correct, paper.data_total),
    quantityRate: rate(paper.quantity_correct, paper.quantity_total),
    commonRate: rate(paper.common_correct, paper.common_total),
  };
}

/** Spaced repetition intervals: 1 → 3 → 7 → 15 → 30 */
export const REVIEW_INTERVALS = [1, 3, 7, 15, 30] as const;

export function nextIntervalDays(current: number): number {
  const idx = REVIEW_INTERVALS.indexOf(current as (typeof REVIEW_INTERVALS)[number]);
  if (idx < 0) return REVIEW_INTERVALS[0];
  if (idx >= REVIEW_INTERVALS.length - 1) return REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
  return REVIEW_INTERVALS[idx + 1];
}

export function initialReviewFields(sourceDate: string) {
  const base = parseISO(sourceDate);
  return {
    review_interval_days: 1,
    next_review_date: format(addDays(base, 1), "yyyy-MM-dd"),
    last_reviewed_at: null as string | null,
  };
}

export function advanceReviewFields(intervalDays: number, fromDate = new Date()) {
  const next = nextIntervalDays(intervalDays || 1);
  return {
    review_interval_days: next,
    next_review_date: format(addDays(fromDate, next), "yyyy-MM-dd"),
    last_reviewed_at: new Date().toISOString(),
    review_status: "pending" as const,
  };
}

export function masteredReviewFields() {
  return {
    review_status: "mastered" as const,
    next_review_date: null as string | null,
  };
}

export function resetPendingReviewFields(sourceDate: string) {
  return {
    review_status: "pending" as const,
    ...initialReviewFields(sourceDate),
  };
}
