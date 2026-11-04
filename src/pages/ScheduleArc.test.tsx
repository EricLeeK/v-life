import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  return <output aria-label="保存的任务关联">{demoData.schedule_events.filter(event => event.todo_id || event.project_task_id)
    .map(event => event.project_task_id ?? event.todo_id).join(",")}</output>;
}

function show(route = "/schedule") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[route]}><LangProvider><DemoModeProvider><SchedulePage /><LinkedTimeBlocks /></DemoModeProvider></LangProvider></MemoryRouter></QueryClientProvider>);
}

describe("Arc schedule controls", () => {
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
