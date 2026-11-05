import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider } from "@/contexts/LanguageContext";
import TodayTodoPage from "./TodayTodo";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }));
vi.mock("@/hooks/useProjectToday", () => ({
  useTodayProjectTasks: () => ({ data: [{ id: "task", title: "项目子任务", status: "todo", project_id: "project", projects: { name: "项目折叠验收" } }] }),
  useProjectTodayAction: () => ({ mutate: vi.fn(), isPending: false }),
}));
beforeEach(() => { localStorage.setItem("vlife-demo-mode", "true"); localStorage.setItem("vlife-lang", "zh"); });
function show() { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LangProvider><DemoModeProvider><TodayTodoPage /></DemoModeProvider></LangProvider></MemoryRouter></QueryClientProvider>); }
it("keeps project tasks visible on Today without expanding the project", async () => {
  show();
  const group = await screen.findByRole("region", { name: "来自项目 · 项目折叠验收" });
  expect(within(group).getByRole("button", { name: "项目子任务" })).toBeVisible();
});
