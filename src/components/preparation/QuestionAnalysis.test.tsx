import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuestionAnalysis } from "./QuestionAnalysis";
import type { PrepQuestion } from "@/lib/preparation/domain";

const question: PrepQuestion = { id: "q", revision: 3, stem_md: "题干", explanation_md: "旧解析", analysis_md: "旧错因", question_type: "single", options: [], correct_answer: ["B"], tags: [], target_seconds: 60, material_id: null, status: "active" };
afterEach(cleanup);

it("独立保存解析与错因，预览 Markdown 并使用最新版本继续编辑", async () => {
  const save = vi.fn(async (base: PrepQuestion, patch: Partial<PrepQuestion>) => ({ ...base, ...patch, revision: base.revision + 1 }));
  function Harness() {
    const [q, setQ] = useState(question);
    return <QuestionAnalysis question={q} onSave={save} onSaved={setQ} />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "编辑解析" }));
  fireEvent.change(screen.getByLabelText("解析内容 · Markdown"), { target: { value: "## 核心方法\n先求基期量" } });
  fireEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(screen.getByRole("heading", { name: "核心方法" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保存解析" }));
  await screen.findByRole("button", { name: "编辑解析" });
  expect(save).toHaveBeenLastCalledWith(question, { explanation_md: "## 核心方法\n先求基期量" });
  fireEvent.click(screen.getByRole("button", { name: "编辑错因" }));
  fireEvent.change(screen.getByLabelText("错因内容 · Markdown"), { target: { value: "看漏单位" } });
  fireEvent.click(screen.getByRole("button", { name: "保存错因" }));
  await screen.findByText("看漏单位");
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 4 }), { analysis_md: "看漏单位" });
  fireEvent.click(screen.getByRole("button", { name: "编辑错因" }));
  expect(screen.getByLabelText("错因内容 · Markdown")).toHaveValue("看漏单位");
});

it("保存失败保留草稿，版本冲突需核对最新内容后才能重试", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("content revision conflict")).mockResolvedValue({ ...question, analysis_md: "保留的草稿", revision: 5 });
  const props = { onSave: save, onSaved: vi.fn() };
  const view = render(<QuestionAnalysis question={question} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "编辑错因" }));
  fireEvent.change(screen.getByLabelText("错因内容 · Markdown"), { target: { value: "保留的草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "保存错因" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("错因内容 · Markdown")).toHaveValue("保留的草稿");
  view.rerender(<QuestionAnalysis question={{ ...question, revision: 4, analysis_md: "另一端的错因" }} {...props} />);
  expect(screen.getByRole("button", { name: "保存错因" })).toBeDisabled();
  fireEvent.click(screen.getByText("查看最新内容"));
  expect(screen.getByText("另一端的错因")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保留草稿，使用最新版本" }));
  fireEvent.click(screen.getByRole("button", { name: "保存错因" }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 4 }), { analysis_md: "保留的草稿" });
});
