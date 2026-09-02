import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider } from "@/contexts/LanguageContext";
import TodosPage from "@/pages/Todos";
import TodayTodoPage from "@/pages/TodayTodo";

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { id: "demo-user" }, loading: false, signOut: vi.fn() }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderPage(route: string, page: React.ReactNode) {
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

describe("todo habits and routines", () => {
  beforeEach(() => {
    localStorage.setItem("vlife-demo-mode", "true");
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  it("pins habits without a complete checkbox and marks routines", async () => {
    renderPage("/todos", <TodosPage />);

    const habitTitle = await screen.findByRole("button", { name: "晨间冥想" });
    const habitCard = habitTitle.closest(".bg-card");
    expect(habitCard).toBeTruthy();
    expect(within(habitCard as HTMLElement).queryByRole("button", { name: "标记为已完成" })).not.toBeInTheDocument();

    expect(screen.getByText("例行")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查工作邮箱" })).toBeInTheDocument();

    const groups = screen.getAllByRole("button", { name: /收起分类:/ });
    expect(groups[0]).toHaveAccessibleName(/习惯/);
  });

  it("shows a habit control stack on today and keeps habits out of the picker", async () => {
    renderPage("/today", <TodayTodoPage />);

    expect(await screen.findByRole("region", { name: "今日习惯" })).toBeInTheDocument();
    expect(screen.getByText("晨间冥想")).toBeInTheDocument();
    expect(screen.getByText("喝水")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /今日打卡|已打卡/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "增加" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "继续坚持" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加任务" }));
    const dialog = await screen.findByRole("dialog", { name: "选择今日任务" });
    expect(within(dialog).getByText("查工作邮箱")).toBeInTheDocument();
    expect(within(dialog).queryByText("晨间冥想")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("喝水")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("阅读")).not.toBeInTheDocument();

    const pickerTitles = within(dialog)
      .getAllByRole("checkbox")
      .map((box) => box.closest("label")?.textContent || "");
    expect(pickerTitles[0]).toContain("查工作邮箱");
  });
});
