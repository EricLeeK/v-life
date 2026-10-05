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

  it("shows real weekly arrangements and keeps secondary metrics compact", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "这一周的安排" })).toBeInTheDocument();
    const agenda = screen.getByRole("region", { name: "本周日程预览" });
    expect(within(agenda).getByRole("link", { name: /^高等数学 II，/ })).toHaveAttribute("href", expect.stringMatching(/^\/schedule\?date=\d{4}-\d{2}-\d{2}$/));
    expect(screen.queryByRole("heading", { name: "下一步做什么" })).not.toBeInTheDocument();
    expect(screen.queryByText("建议先做")).not.toBeInTheDocument();
    expect(screen.queryByText("翻开今天的生活日报")).not.toBeInTheDocument();
    const metrics = screen.getByRole("region", { name: "今日关键数据" });
    expect(within(metrics).getAllByTestId("dashboard-metric")).toHaveLength(3);
  });

  it("keeps the full module directory behind progressive disclosure", () => {
    renderDashboard();

    expect(screen.getByRole("button", { name: /展开全部模块/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("shows today's to-dos and five other to-dos ordered by urgency", () => {
    renderDashboard();

    const today = screen.getByRole("region", { name: "今日待办" });
    expect(within(today).getByRole("link", { name: "查看全部今日待办" })).toHaveAttribute("href", "/today");
    const todayTitles = within(today).getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/today" && link.getAttribute("aria-label") !== "查看全部今日待办")
      .map((link) => link.textContent ?? "");
    expect(todayTitles.length).toBeLessThanOrEqual(5);
    expect(todayTitles[0]).toContain("提交论文初稿");
    expect(todayTitles[0]).toContain("紧急");
    expect(todayTitles[1]).toContain("复习概率论考试");
    expect(todayTitles[2]).toContain("回复导师邮件");
    expect(todayTitles[2]).toContain("重要");
    expect(todayTitles[3]).toContain("给彤彤寄包裹");
    expect(todayTitles.join("\n")).not.toContain("买日用品");
    expect(todayTitles.join("\n")).not.toContain("Multi-agent PDE solving system - LEAP");

    const others = screen.getByRole("region", { name: "其他待办" });
    const titles = within(others).getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/todos" && link.getAttribute("aria-label") !== "查看全部待办")
      .map((link) => link.textContent ?? "");
    expect(titles).toHaveLength(5);
    expect(titles[0]).toContain("Multi-agent PDE solving system - LEAP");
    expect(titles[0]).toContain("紧急");
    expect(titles[1]).toContain("秋招 agent 或者自动化开发");
    expect(titles[2]).toContain("粗读 UniNDM");
    expect(titles[3]).toContain("ARIS 面试HTML");
    expect(titles[4]).toContain("学习Hello Agent");
    expect(titles.join("\n")).not.toContain("LLM - MC wiki");
    expect(titles.join("\n")).not.toContain("提交论文初稿");
    expect(titles.join("\n")).not.toContain("晨间冥想");
    expect(screen.queryByText("今天还没有安排")).not.toBeInTheDocument();
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
