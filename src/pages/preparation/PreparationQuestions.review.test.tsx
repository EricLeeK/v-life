import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import PreparationQuestions from "./PreparationQuestions";
import type { PrepQuestion } from "@/lib/preparation/domain";
const mocks = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue({}), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/preparation/QuestionLinks", () => ({ QuestionLinks: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/usePreparation", () => ({
  questionsForExam: (data: { questions: PrepQuestion[] }) => data.questions,
  usePreparation: () => {
    const [question, setQuestion] = useState<PrepQuestion>({ id: "q", revision: 3, stem_md: "请选择答案", explanation_md: "原解析", analysis_md: "原错因", question_type: "single", options: [{ key: "A", content_md: "选项一" }], correct_answer: ["A"], tags: [], target_seconds: 60, material_id: null, status: "active" });
    return { userId: "demo", isDemo: true, data: { questions: [question], states: [{ question_id: "q", revision: 1, due_at: null }], materials: [] }, save: mocks.save, refresh: mocks.refresh,
      editQuestion: async (base: PrepQuestion, patch: Partial<PrepQuestion>) => { const next = { ...base, ...patch, revision: base.revision + 1 }; setQuestion(next); return next; },
    };
  },
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
it("复习中编辑解析后保留答案，并用新内容版本记录草稿和提交复习", async () => {
  render(<MemoryRouter><PreparationQuestions review /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /A 选项一/ }));
  fireEvent.click(screen.getByRole("button", { name: "提交答案并查看解析" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑解析" }));
  expect(screen.getByRole("button", { name: "正常" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("解析内容 · Markdown"), { target: { value: "人工补充解析" } });
  fireEvent.click(screen.getByRole("button", { name: "保存解析" }));
  await screen.findByText("人工补充解析");
  await waitFor(() => expect(JSON.parse(localStorage.getItem("prep-draft:demo:q:review")!)).toMatchObject({ contentRevision: 4, answer: ["A"], revealed: true }));
  fireEvent.click(screen.getByRole("button", { name: "正常" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ collection: "attempts", record: expect.objectContaining({ content_revision: 4, answer: ["A"], mode: "review" }) })));
});
