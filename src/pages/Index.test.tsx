import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { LangProvider } from "@/contexts/LanguageContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "@/pages/Index";

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { id: "demo-user" }, loading: false, signOut: vi.fn() }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("Dashboard homepage", () => {
  beforeEach(() => {
    localStorage.setItem("vlife-demo-mode", "true");
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  function renderDashboard() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <LangProvider>
              <DemoModeProvider>
                <AuthProvider>
                  <Index />
                </AuthProvider>
              </DemoModeProvider>
            </LangProvider>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
  }

  it("renders in demo mode without crashing", () => {
    renderDashboard();
    expect(screen.getAllByText("首页概览").length).toBeGreaterThan(0);
  });

  it("leads with the next action and limits the visible metrics to four", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "下一步做什么" })).toBeInTheDocument();
    const metrics = screen.getByRole("region", { name: "今日关键数据" });
    expect(within(metrics).getAllByTestId("dashboard-metric")).toHaveLength(4);
  });

  it("keeps the full module directory behind progressive disclosure", () => {
    renderDashboard();

    expect(screen.getByRole("button", { name: /展开全部模块/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes shortcut links that open the corresponding create flows", () => {
    renderDashboard();

    expect(screen.getByRole("link", { name: "添加日程" })).toHaveAttribute("href", "/schedule?new=1");
    expect(screen.getByRole("link", { name: "新增待办" })).toHaveAttribute("href", "/todos?new=1");
    expect(screen.getByRole("link", { name: "记一笔" })).toHaveAttribute("href", "/finance?new=1");
  });

  it("uses actionable semantics and human language for overdue pantry items", async () => {
    renderDashboard();

    expect((await screen.findAllByText(/已过期 \d+ 天/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^-\d+ 天$/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /打开食材预警/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /打开 AI 助手/ })).toBeInTheDocument();
    expect(screen.queryByText("月目标完成")).not.toBeInTheDocument();
    expect(screen.queryByText("本周目标完成")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开状态洞察" }));
    expect(screen.getByText("本周目标完成")).toBeInTheDocument();
  });
});
