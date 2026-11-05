import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LangProvider } from "@/contexts/LanguageContext";
import { DemoModeProvider, useDemoMode } from "@/contexts/DemoModeContext";
import SchedulePage from "./Schedule";
import { createDemoDataStore } from "@/data/demoSeed";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }));
beforeEach(() => { localStorage.setItem("vlife-demo-mode", "true"); });
function LinkedTimeBlocks() {
  const { demoData } = useDemoMode();
  return <><output aria-label="保存的任务关联">{demoData.schedule_events.filter(event => event.todo_id || event.project_task_id)
    .map(event => event.project_task_id ?? event.todo_id).join(",")}</output><output aria-label="保存的日程">{JSON.stringify(demoData.schedule_events)}</output></>;
}

function show(route = "/schedule") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[route]}><LangProvider><DemoModeProvider><SchedulePage /><LinkedTimeBlocks /></DemoModeProvider></LangProvider></MemoryRouter></QueryClientProvider>);
}

describe("Arc schedule controls", () => {
  it("uses one date range and binds each clock to its matching endpoint", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    try {
      show("/schedule?new=1");
      fireEvent.change(await screen.findByLabelText(/标题/), { target: { value: "跨日时间绑定验收" } });
      expect(screen.queryByRole("button", { name: /^开始日期:/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^结束日期:/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^日期区间:/ }));
      const calendar = screen.getByRole("dialog", { name: "日期区间" });
      fireEvent.click(within(calendar).getByRole("button", { name: /^2026年11月10日/ }));
      fireEvent.click(within(calendar).getByRole("button", { name: /^2026年11月11日/ }));
      fireEvent.click(within(calendar).getByRole("button", { name: "Apply" }));
      await waitFor(() => expect(screen.getByRole("button", { name: /^日期区间:/ })).toHaveAttribute("aria-expanded", "false"));
      for (const [label, hour] of [["开始时间", 23], ["结束时间", 1]] as const) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}:`) }));
        const clock = within(screen.getByRole("dialog", { name: label }));
        const hours = clock.getByRole("slider", { name: "小时" });
        const steps = (hour - Number(hours.getAttribute("aria-valuenow")) + 24) % 24;
        for (let i = 0; i < steps; i++) fireEvent.keyDown(hours, { key: "ArrowUp" });
        fireEvent.keyDown(hours, { key: "Enter" });
        fireEvent.keyDown(clock.getByRole("slider", { name: "分钟" }), { key: "Enter" });
      }
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      await waitFor(() => {
        const saved = JSON.parse(screen.getByLabelText("保存的日程").textContent!).find((event: { title: string }) => event.title === "跨日时间绑定验收");
        expect(saved?.start_time).toBe(new Date(2026, 10, 10, 23, 0).toISOString());
        expect(saved?.end_time).toBe(new Date(2026, 10, 11, 1, 0).toISOString());
      });
    } finally { vi.useRealTimers(); }
  });
  it("switches the real schedule grid through the original segmented control", async () => {
    show();
    const group = await screen.findByRole("group", { name: "日程视图" });
    fireEvent.click(within(group).getByRole("button", { name: "月" }));
    expect(within(group).getByRole("button", { name: "月" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^\d{4}-\d{2}-\d{2}$/ }).length).toBeGreaterThanOrEqual(28);
    fireEvent.keyDown(within(group).getByRole("button", { name: "月" }), { key: "Home" });
    expect(within(group).getByRole("button", { name: "日" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /^\d{4}-\d{2}-\d{2}$/ })).not.toBeInTheDocument();
  });

  it("keeps the selected personal task linked when saving the time block", async () => {
    show("/schedule?new=1");
    const input = await screen.findByRole("combobox", { name: "从代办仓库选择" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "查工作邮箱" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText(/标题/)).toHaveValue("查工作邮箱");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const original = createDemoDataStore().todos.find(todo => todo.title === "查工作邮箱")!;
    expect(await screen.findByText(original.id)).toBeInTheDocument();
  });
});
