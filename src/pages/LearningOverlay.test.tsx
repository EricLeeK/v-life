import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider } from "@/contexts/LanguageContext";
import LearningNotes from "./LearningNotes";

function renderLearning() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/learning-notes"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LangProvider><DemoModeProvider><AuthProvider><LearningNotes /></AuthProvider></DemoModeProvider></LangProvider>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

let focusCalls = 0;
beforeEach(() => {
  focusCalls = 0;
  const originalFocus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    focusCalls += 1;
    // Bound a focus-trap loop so it fails an assertion instead of freezing the test worker.
    if (focusCalls > 50) return;
    originalFocus.call(this, options);
  });
  localStorage.setItem("vlife-demo-mode", "true");
  localStorage.setItem("vlife-lang", "zh");
});

afterEach(() => vi.restoreAllMocks());

async function expectPageUnlocked() {
  expect(focusCalls).toBeLessThan(50);
  await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
  await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
  fireEvent.click(screen.getByRole("button", { name: "新建课程" }));
  const dialog = await screen.findByRole("dialog", { name: "新建课程" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建课程" })).not.toBeInTheDocument());
  await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
}

describe("learning menu modal lock recovery", () => {
  it.each([
    { action: "编辑", finish: "Close", role: "dialog" as const },
    { action: "编辑", finish: "保存修改", role: "dialog" as const },
    { action: "删除", finish: "取消", role: "alertdialog" as const },
    { action: "删除", finish: "确认删除", role: "alertdialog" as const },
  ])("releases page locks after $action → $finish", async ({ action, finish, role }) => {
    renderLearning();
    const trigger = (await screen.findAllByRole("button", { name: "更多操作" }))[0];
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: action }));
    expect(focusCalls).toBeLessThan(50);
    const dialog = await screen.findByRole(role);
    fireEvent.click(within(dialog).getByRole("button", { name: finish }));
    await waitFor(() => expect(screen.queryByRole(role)).not.toBeInTheDocument());
    await expectPageUnlocked();
  });

  it.each(["内容润色", "格式排版优化"])("releases page locks after closing %s from the AI menu", async (action) => {
    renderLearning();
    fireEvent.keyDown(await screen.findByRole("button", { name: "AI 助手" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: action }));
    expect(focusCalls).toBeLessThan(50);
    const dialog = await screen.findByRole("dialog", { name: "AI 笔记优化助手" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "AI 笔记优化助手" })).not.toBeInTheDocument());
    await expectPageUnlocked();
  });
});
