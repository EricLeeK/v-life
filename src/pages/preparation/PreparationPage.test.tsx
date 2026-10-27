import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PreparationPage from "./PreparationPage";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/preparation/PaperTrends", () => ({ PaperTrends: () => null }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (s: string) => s }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/usePreparation", () => ({
  questionsForExam: () => [],
  usePreparation: () => ({ save: mocks.save, data: { exams: [{ id: "exam", name: "模拟考试", exam_date: "2026-11-28", template: null }], questions: [], states: [], banks: [], examBanks: [], papers: [], paperQuestions: [] } }),
}));
beforeEach(() => { mocks.save.mockReset().mockResolvedValue({}); const original = window.matchMedia; vi.spyOn(window, "matchMedia").mockImplementation(q => ({ ...original(q), matches: q.includes("prefers-reduced-motion") })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function show(path = "/preparation") { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/preparation" element={<PreparationPage />} /><Route path="/preparation/exams/:examId" element={<PreparationPage />} /></Routes></MemoryRouter>); }
async function pickToday(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}:`) }));
  fireEvent.click(screen.getByRole("button", { name: "今天" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(`^${label}:`) })).toHaveAttribute("aria-expanded", "false"));
}
it("创建考试使用统一日期组件并提交所选日期", async () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "添加考试" }));
  fireEvent.change(screen.getByLabelText("考试名称"), { target: { value: "新考试" } });
  await pickToday("考试日期");
  fireEvent.click(screen.getByRole("button", { name: "保存考试" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ record: expect.objectContaining({ name: "新考试", exam_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }) })));
});
it("考试设置与套卷日期均通过统一日期组件保存", async () => {
  show("/preparation/exams/exam");
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  await pickToday("考试日期");
  fireEvent.click(screen.getByRole("button", { name: "保存考试" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ id: "exam", record: expect.objectContaining({ exam_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }) })));
  fireEvent.click(screen.getByRole("button", { name: "套卷" }));
  fireEvent.click(screen.getByRole("button", { name: /录入套卷/ }));
  await pickToday("作答日期");
  fireEvent.change(screen.getByLabelText("套卷名称"), { target: { value: "模拟卷" } });
  fireEvent.click(screen.getByRole("button", { name: "保存套卷" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ collection: "papers", record: expect.objectContaining({ taken_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }) })));
});
