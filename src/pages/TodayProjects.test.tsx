import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider } from "@/contexts/LanguageContext";
import TodayTodoPage from "./TodayTodo";

const projectState = vi.hoisted(() => ({ status: "todo", estimated_minutes: 90 as number | null, isLoading: false, error: null as Error | null }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }));
vi.mock("@/hooks/useProjectToday", () => ({
  useTodayProjectTasks: () => ({ data: [{ id: "task", title: "项目子任务", estimated_minutes: projectState.estimated_minutes, status: projectState.status, project_id: "project", projects: { name: "项目折叠验收" } }], isLoading: projectState.isLoading, error: projectState.error }),
  useProjectTodayAction: () => ({ mutate: vi.fn(), isPending: false }),
}));
beforeEach(() => {
  localStorage.setItem("vlife-demo-mode", "true");
  localStorage.setItem("vlife-lang", "zh");
  Object.assign(projectState, { status: "todo", estimated_minutes: 90, isLoading: false, error: null });
});
function show() { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LangProvider><DemoModeProvider><TodayTodoPage /></DemoModeProvider></LangProvider></MemoryRouter></QueryClientProvider>); }
it("keeps project tasks visible on Today without expanding the project", async () => {
  show();
  const group = await screen.findByRole("region", { name: "来自项目 · 项目折叠验收" });
  expect(within(group).getByRole("button", { name: "项目子任务" })).toBeVisible();
});

it("shows project estimates and marks the unestimated remaining tasks in the overview", async () => {
  show();
  const group = await screen.findByRole("region", { name: "来自项目 · 项目折叠验收" });
  expect(within(group).getByText("1 小时 30 分钟")).toBeVisible();
  const overview = screen.getByRole("region", { name: "今日概览" });
  expect(overview).toHaveTextContent("剩余预计用时");
  expect(overview).toHaveTextContent("至少 1 小时 30 分钟");
  expect(overview).toHaveTextContent("4 项未设置用时");
});

it("updates the row and remaining total after editing and completing a daily task", async () => {
  show();
  fireEvent.click(await screen.findByRole("button", { name: "提交论文初稿" }));
  fireEvent.keyDown(await screen.findByRole("slider", { name: "预计时长" }), { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  const overview = screen.getByRole("region", { name: "今日概览" });
  await waitFor(() => expect(overview).toHaveTextContent("至少 2 小时 15 分钟"));
  expect(screen.getByText("45 分钟")).toBeVisible();
  expect(overview).toHaveTextContent("3 项未设置用时");

  fireEvent.click(screen.getByRole("checkbox", { name: "提交论文初稿" }));
  await waitFor(() => expect(overview).toHaveTextContent("至少 1 小时 30 分钟"));
  expect(overview).toHaveTextContent("还剩 4 项");
  expect(screen.getByText("45 分钟")).toBeVisible();
});

it("shows an unknown total when every remaining task has no estimate", async () => {
  projectState.estimated_minutes = null;
  show();
  const overview = await screen.findByRole("region", { name: "今日概览" });
  expect(overview).toHaveTextContent("—");
  expect(overview).toHaveTextContent("均未设置用时");
  expect(overview).not.toHaveTextContent("0 分钟");
});

it.each(["loading", "error"])("does not present a partial total while the project source is %s", async (state) => {
  projectState.isLoading = state === "loading";
  projectState.error = state === "error" ? new Error("offline") : null;
  show();
  const overview = await screen.findByRole("region", { name: "今日概览" });
  expect(within(overview).getByRole("status")).toHaveTextContent("—");
  expect(overview).not.toHaveTextContent("1 小时 30 分钟");
});

it("shows zero remaining minutes once all tasks are completed", async () => {
  projectState.status = "done";
  show();
  for (const title of ["提交论文初稿", "复习概率论考试", "回复导师邮件", "给彤彤寄包裹"]) {
    fireEvent.click(await screen.findByRole("checkbox", { name: title }));
  }
  const overview = screen.getByRole("region", { name: "今日概览" });
  await waitFor(() => expect(overview).toHaveTextContent("今日任务已完成"));
  expect(overview).toHaveTextContent("0 分钟");
  expect(overview).not.toHaveTextContent("未设置用时");
});
