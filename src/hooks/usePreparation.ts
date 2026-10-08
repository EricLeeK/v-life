import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import {
  visibleQuestionIds,
  type PrepExam,
  type PrepQuestion,
  type PrepMaterial,
  type PrepReviewState,
} from "@/lib/preparation/domain";

// Kept behind one adapter until generated database types include the new migration.
export const prepDb = supabase as unknown as SupabaseClient;
const db = prepDb;
export interface PrepBank {
  id: string;
  name: string;
  description_md?: string;
  is_archived?: boolean;
}
export interface PrepPaper {
  id: string;
  exam_id: string | null;
  source: string;
  taken_date: string;
  total_score: number | null;
  duration_minutes: number | null;
  sections: { name: string; total: number; correct: number }[];
  notes?: string;
  is_mock?: boolean;
}
export interface PrepData {
  exams: PrepExam[];
  banks: PrepBank[];
  questions: PrepQuestion[];
  materials: PrepMaterial[];
  states: PrepReviewState[];
  examBanks: { id?: string; exam_id: string; bank_id: string }[];
  bankQuestions: { id?: string; bank_id: string; question_id: string }[];
  exceptions: {
    id?: string;
    exam_id: string;
    question_id: string;
    mode: string;
  }[];
  papers: PrepPaper[];
  attempts: {id:string;question_id:string;correct:boolean|null;yellow:boolean;duration_seconds:number|null;mode:string;reason_tags:string[];content_revision:number;created_at:string}[];
  noteLinks: {id:string;question_id:string;note_id:string}[];
  pitfalls: {id:string;title:string;content_md:string;tags:string[]}[];
  pitfallQuestions: {id:string;question_id:string;pitfall_id:string}[];
  paperQuestions: {id:string;question_id:string;paper_id:string;source_number?:string}[];
  versions: {id:string;entity:string;entity_id:string;revision:number;content:Partial<PrepQuestion>}[];
  assets: {id:string;storage_path?:string;url?:string}[];
}
const relationKeys: Partial<Record<keyof PrepData, string>> = {
  bankQuestions: "user_id,bank_id,question_id",
  examBanks: "user_id,exam_id,bank_id",
  exceptions: "user_id,exam_id,question_id",
  paperQuestions: "user_id,paper_id,question_id",
  noteLinks: "user_id,question_id,note_id",
  pitfallQuestions: "user_id,pitfall_id,question_id",
};
const tables = {
  exams: "prep_exams",
  banks: "prep_banks",
  questions: "prep_questions",
  materials: "prep_materials",
  states: "prep_review_states",
  examBanks: "prep_exam_banks",
  bankQuestions: "prep_bank_questions",
  exceptions: "prep_exam_questions",
  papers: "prep_papers",
  attempts: "prep_attempts",
  noteLinks: "prep_note_links",
  pitfalls: "prep_pitfalls",
  pitfallQuestions: "prep_pitfall_questions",
  paperQuestions: "prep_paper_questions",
  versions: "prep_content_versions",
  assets: "prep_assets",
} as const;
let demo: PrepData | null = null;
function demoData(): PrepData {
  if (demo) return demo;
  const today = new Date().toISOString().slice(0, 10);
  demo = {
    exams: [
      {
        id: "demo-exam",
        name: "秋季模拟考试",
        exam_date: "2026-11-28",
        template: "civil",
        is_primary: true,
        is_archived: false,
      },
    ],
    banks: [{ id: "demo-bank", name: "行测通用" }],
    questions: [
      {
        id: "demo-question",
        stem_md: "某地区本年收入为 120 亿元，同比增长 20%。上年收入是多少？",
        question_type: "single",
        options: [
          { key: "A", content_md: "96 亿元" },
          { key: "B", content_md: "100 亿元" },
          { key: "C", content_md: "104 亿元" },
          { key: "D", content_md: "144 亿元" },
        ],
        correct_answer: ["B"],
        explanation_md:
          "## 核心判断\n已知现期量与增长率，求基期量。\n\n## 解题步骤\n$$120 \\div (1+20\\%)=100$$\n\n## 易错提醒\n不能直接从现期量减去 20%。",
        analysis_md: "容易把增长率的基数误当成现期量。",
        tags: ["资料分析", "基期量"],
        target_seconds: 60,
        material_id: null,
        revision: 1,
        status: "active",
      },
    ],
    materials: [],
    states: [
      {
        question_id: "demo-question",
        due_at: today,
        revision: 1,
        paused: false,
        fsrs: {},
      },
    ],
    examBanks: [{ exam_id: "demo-exam", bank_id: "demo-bank" }],
    bankQuestions: [{ bank_id: "demo-bank", question_id: "demo-question" }],
    exceptions: [],
    papers: [],
    attempts: [],
    noteLinks: [],
    pitfalls: [],
    pitfallQuestions: [],
    paperQuestions: [],
    versions: [],
    assets: [],
  };
  demo.materials.push({
    id: "demo-material",
    revision: 1,
    content_md:
      "某地区两年的收入数据如下（演示数据）：\n\n| 年份 | 收入（亿元） |\n| --- | ---: |\n| 2024 | 100 |\n| 2025 | 120 |\n\n请结合材料回答各子题。",
  });
  demo.questions[0].material_id = "demo-material";
  demo.questions.push({
    id: "demo-graphic",
    stem_md:
      "图中圆点数量依次增加。下一幅图应有几个圆点？\n\n![圆点依次为一个、两个、三个](/preparation-demo/sequence.svg)",
    question_type: "single",
    options: [1, 2, 4, 5].map((n, i) => ({
      key: String.fromCharCode(65 + i),
      content_md: `![选项 ${String.fromCharCode(65 + i)}](/preparation-demo/dots-${n}.svg)`,
    })),
    correct_answer: ["C"],
    explanation_md:
      "## 观察规律\n每次增加一个圆点：1 → 2 → 3 → 4。\n\n## 易错提醒\n先检查数量变化，再考虑位置。",
    analysis_md: "不要忽略最直接的数量规律。",
    tags: ["图形推理"],
    target_seconds: 30,
    material_id: null,
    revision: 1,
    status: "active",
  });
  for (let i = 2; i <= 4; i++)
    demo.questions.push({
      ...demo.questions[0],
      id: `demo-sub-${i}`,
      stem_md: [
        "材料中收入增加了多少亿元？",
        "材料中收入的同比增长率是多少？",
        "简要说明如何区分增长量和增长率。",
      ][i - 2],
      question_type: i === 4 ? "text" : "single",
      correct_answer:
        i === 4 ? "增长量是绝对差值；增长率是增量与基期量的比值。" : ["A"],
      options:
        i === 4
          ? []
          : [
              { key: "A", content_md: i === 2 ? "20 亿元" : "20%" },
              { key: "B", content_md: i === 2 ? "10 亿元" : "10%" },
            ],
    });
  for (const q of demo.questions.slice(1)) {
    demo.states.push({
      question_id: q.id,
      due_at: today,
      revision: 0,
      paused: false,
      fsrs: {},
    });
    demo.bankQuestions.push({ bank_id: "demo-bank", question_id: q.id });
  }
  return demo;
}
export function questionsForExam(data: PrepData, examId?: string) {
  if (!examId) return data.questions;
  const banks = new Set(
    data.examBanks.filter((e) => e.exam_id === examId).map((e) => e.bank_id),
  );
  const ids = new Set(
    visibleQuestionIds(
      data.bankQuestions
        .filter((b) => banks.has(b.bank_id))
        .map((b) => b.question_id),
      data.exceptions.filter((e) => e.exam_id === examId),
    ),
  );
  return data.questions.filter((q) => ids.has(q.id));
}
export function usePreparation() {
  const { isDemo } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["preparation", isDemo ? "demo" : user?.id],
    enabled: isDemo || !!user,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: isDemo ? false : 30000,
    queryFn: async () => {
      if (isDemo) return structuredClone(demoData());
      const entries = await Promise.all(
        Object.entries(tables).map(async ([key, table]) => {
          const rows: unknown[] = [];
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await db
              .from(table)
              .select("*")
              .order("id")
              .range(offset, offset + 499);
            if (error) throw error;
            rows.push(...data);
            if (data.length < 500) break;
          }
          return [key, rows];
        }),
      );
      return Object.fromEntries(entries) as unknown as PrepData;
    },
  });
  const mutation = useMutation({
    mutationFn: async ({
      collection,
      record,
      id,
      remove,
    }: {
      collection: keyof typeof tables;
      record?: Record<string, unknown>;
      id?: string;
      remove?: boolean;
    }) => {
      if (isDemo) {
        const data = demoData();
        const rows = data[collection] as unknown as (Record<string,unknown>&{id:string;revision:number})[];
        if (remove) {
          (data as unknown as Record<string, unknown>)[collection] = rows.filter((r) => r.id !== id);
          return;
        }
        if (id) {
          const row = rows.find(
            (r) =>
              r.id === id || (collection === "states" && r.question_id === id),
          );
          if (!row) throw new Error("记录不存在");
          Object.assign(row, record);
          return row;
        }
        const matchKeys = relationKeys[collection]
          ?.split(",")
          .filter((k) => k !== "user_id");
        const existing = matchKeys
          ? rows.find((r) => matchKeys.every((k) => r[k] === record?.[k]))
          : rows.find((r) => record?.id && r.id === record.id);
        if (existing) {
          Object.assign(existing, record);
          return existing;
        }
        const row = { id: crypto.randomUUID(), revision: 1, ...record };
        rows.push(row);
        if (collection === "questions" && record?.status === "active")
          data.states.push({
            question_id: row.id,
            due_at: new Date().toISOString(),
            revision: 0,
            paused: false,
            fsrs: {},
          });
        return row;
      }
      let result;
      if (remove)
        result = await db.from(tables[collection]).delete().eq("id", id);
      else if (id)
        result = await db
          .from(tables[collection])
          .update(record)
          .eq(collection === "states" ? "question_id" : "id", id)
          .select()
          .single();
      else if (relationKeys[collection])
        result = await db
          .from(tables[collection])
          .upsert(
            { ...record, user_id: user?.id },
            { onConflict: relationKeys[collection] },
          )
          .select()
          .single();
      else
        result = await db
          .from(tables[collection])
          .insert({ ...record, user_id: user?.id })
          .select()
          .single();
      if (result.error?.code === "23505" && record?.id) {
        const existing = await db
          .from(tables[collection])
          .select("*")
          .eq("id", record.id)
          .single();
        if (
          !existing.error &&
          Object.entries(record).every(
            ([key, value]) =>
              JSON.stringify(existing.data[key]) === JSON.stringify(value),
          )
        )
          return existing.data;
      }
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preparation"] }),
  });
  const editQuestion = async (
    question: PrepQuestion,
    patch: Partial<PrepQuestion>,
  ) => {
    if (isDemo)
      return mutation.mutateAsync({
        collection: "questions",
        id: question.id,
        record: { ...patch, revision: question.revision + 1 },
      });
    const { data, error } = await db.rpc("prep_edit_question", {
      p_question_id: question.id,
      p_expected_revision: question.revision,
      p_patch: patch,
    });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["preparation"] });
    return data;
  };
  return {
    ...query,
    isDemo,
    userId: isDemo ? "demo" : user?.id,
    save: mutation.mutateAsync,
    saving: mutation.isPending,
    editQuestion,
    refresh: () => qc.invalidateQueries({ queryKey: ["preparation"] }),
  };
}

export function usePreparationExamSummary(enabled = true) {
  const { isDemo } = useDemoMode();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["preparation-exams", isDemo ? "demo" : user?.id],
    enabled: enabled && (isDemo || !!user),
    queryFn: async () => {
      if (isDemo) return demoData().exams;
      const { data, error } = await db
        .from("prep_exams")
        .select("*")
        .eq("is_archived", false)
        .order("exam_date");
      if (error) throw error;
      return data as PrepExam[];
    },
  });
  return {
    ...query,
    data: query.data?.find((e) => e.is_primary) || query.data?.[0] || null,
  };
}
