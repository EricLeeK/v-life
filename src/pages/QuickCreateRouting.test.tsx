import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider } from "@/contexts/LanguageContext";
import FinancePage from "@/pages/Finance";
import SchedulePage from "@/pages/Schedule";
import TodosPage from "@/pages/Todos";

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { id: "demo-user" }, loading: false, signOut: vi.fn() }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderAt(route: string, page: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LangProvider>
            <DemoModeProvider>
              <AuthProvider>{page}</AuthProvider>
            </DemoModeProvider>
          </LangProvider>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("dashboard quick-create routes", () => {
  beforeEach(() => {
    localStorage.setItem("vlife-demo-mode", "true");
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  it("opens the schedule create dialog from ?new=1", async () => {
    renderAt("/schedule?new=1", <SchedulePage />);
    const dialog = await screen.findByRole("dialog", { name: "新建事件" });
    expect(dialog).toHaveAccessibleDescription("填写标题与时间，安排新的日程事件。");
  });

  it("opens the finance create dialog from ?new=1", async () => {
    renderAt("/finance?new=1", <FinancePage />);
    const dialog = await screen.findByRole("dialog", { name: "新增 记录" });
    expect(dialog).toHaveAccessibleDescription("记录名称、金额、分类和日期。");
  });

  it("opens the to-do create dialog from ?new=1", async () => {
    renderAt("/todos?new=1", <TodosPage />);
    const dialog = await screen.findByRole("dialog", { name: "添加待办主任务" });
    expect(dialog).toHaveAccessibleDescription("填写任务内容与优先级，创建新的待办事项。");
    expect(screen.getByPlaceholderText("例如：预约下周体检")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("例如：周末, 家里")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("例如：下班路上顺便处理")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("例如：生活")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ARIS|Agent 相关|AI学习/)).not.toBeInTheDocument();
  });
});
