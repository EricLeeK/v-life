import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LangProvider } from "@/contexts/LanguageContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import SchedulePage from "./Schedule";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }));
beforeEach(() => { localStorage.setItem("vlife-demo-mode", "true"); });
function show(route = "/schedule") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[route]}><LangProvider><DemoModeProvider><SchedulePage /></DemoModeProvider></LangProvider></MemoryRouter></QueryClientProvider>);
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

  it("selects a real task by searching and copies it into the event draft", async () => {
    show("/schedule?new=1");
    const input = await screen.findByRole("combobox", { name: "从待办快速选择" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "查工作邮箱" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText(/标题/)).toHaveValue("查工作邮箱");
  });
});
