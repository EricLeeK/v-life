import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider, useLang } from "@/contexts/LanguageContext";
import { todoHooks } from "@/hooks/useData";
import TodosPage from "@/pages/Todos";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderTodos(extra?: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/todos"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LangProvider>
            <DemoModeProvider>
              {extra}
              <AuthProvider><TodosPage /></AuthProvider>
            </DemoModeProvider>
          </LangProvider>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function LanguageSwitcher() {
  const { lang, toggleLang } = useLang();
  return <button type="button" onClick={toggleLang}>{lang === "zh" ? "切换英文" : "切换中文"}</button>;
}

async function addFilter(field: string, value: string) {
  fireEvent.click(await screen.findByRole("button", { name: "添加筛选" }));
  const menu = await screen.findByRole("dialog", { name: "添加筛选" });
  fireEvent.click(await within(menu).findByRole("menuitem", { name: field }));
  fireEvent.click(await within(menu).findByRole("menuitemradio", { name: value }));
}

describe("Todos original Arc task controls", () => {
  beforeEach(() => {
    localStorage.setItem("vlife-demo-mode", "true");
    localStorage.setItem("vlife-lang", "zh");
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  afterEach(() => vi.restoreAllMocks());

  it("uses the original segmented control to change the existing task view", async () => {
    renderTodos();

    const views = await screen.findByRole("group", { name: "任务视图" });
    expect(within(views).getByRole("button", { name: "按分类" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(views).getByRole("button", { name: "按重要性" }));
    expect(within(views).getByRole("button", { name: "按重要性" })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies and removes the selected category from the parent task list", async () => {
    renderTodos();

    await addFilter("分类", "工作");
    expect(await screen.findByRole("button", { name: "Remove 分类: 工作" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "提交研究报告" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交论文初稿" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove 分类: 工作" }));
    expect(await screen.findByRole("button", { name: "提交论文初稿" })).toBeInTheDocument();
  });

  it("uses the completion filter to show only completed parent tasks", async () => {
    renderTodos();

    await addFilter("完成状态", "已完成");
    expect(await screen.findByRole("button", { name: "交水电费" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更新博客文章" })).not.toBeInTheDocument();
  });

  it("keeps an applied completion filter working and translated after switching languages", async () => {
    renderTodos(<LanguageSwitcher />);

    await addFilter("完成状态", "已完成");
    expect(await screen.findByRole("button", { name: "交水电费" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更新博客文章" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换英文" }));

    expect(await screen.findByRole("button", { name: "Remove Completion: Completed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "交水电费" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更新博客文章" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Completion: Completed" }));
    expect(await screen.findByRole("button", { name: "更新博客文章" })).toBeInTheDocument();
  });

  it("archives completed tasks with the original confirmation control and restores the captured tasks", async () => {
    renderTodos();

    fireEvent.click(await screen.findByRole("button", { name: "归档已完成" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认归档" }));
    expect(await screen.findByRole("button", { name: "撤销归档" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "交水电费" })).not.toBeInTheDocument();

    await addFilter("归档状态", "已归档");
    expect(await screen.findByRole("button", { name: "交水电费" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove 归档状态: 已归档" }));
    expect(screen.queryByRole("button", { name: "交水电费" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "撤销归档" }));
    expect(await screen.findByRole("button", { name: "交水电费" })).toBeInTheDocument();
  }, 10000);

  it("starts a fresh captured batch after the prior archive result returns to idle", async () => {
    renderTodos();

    fireEvent.click(await screen.findByRole("button", { name: "归档已完成" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认归档" }));
    expect(await screen.findByRole("button", { name: "撤销归档" })).toBeInTheDocument();

    // ConfirmMorph keeps its result face for its original five second timeout.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "归档已完成" })).toBeInTheDocument();
    }, { timeout: 7000 });

    const nextTodo = screen.getByRole("button", { name: "更新博客文章" });
    const nextTodoCard = nextTodo.closest(".space-y-2") as HTMLElement;
    fireEvent.click(within(nextTodoCard).getByRole("button", { name: "标记为已完成" }));
    fireEvent.click(screen.getByRole("button", { name: "归档已完成" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认归档" }));
    fireEvent.click(await screen.findByRole("button", { name: "撤销归档" }));

    expect(await screen.findByRole("button", { name: "更新博客文章" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "交水电费" })).not.toBeInTheDocument();
  }, 15000);

  it("retains IDs from a partial archive failure across retry so Undo restores the whole batch", async () => {
    const originalUseUpdate = todoHooks.useUpdate;
    let failedFirstArchive = false;
    vi.spyOn(todoHooks, "useUpdate").mockImplementation(() => {
      const mutation = originalUseUpdate();
      return {
        ...mutation,
        mutateAsync: async (args: { id: string; is_archived?: boolean }) => {
          if (args.is_archived && !failedFirstArchive) {
            failedFirstArchive = true;
            throw new Error("temporary archive failure");
          }
          return mutation.mutateAsync(args);
        },
      } as typeof mutation;
    });

    renderTodos();

    fireEvent.click(await screen.findByRole("button", { name: "归档已完成" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认归档" }));
    fireEvent.click(await screen.findByRole("button", { name: "重试" }));
    fireEvent.click(await screen.findByRole("button", { name: "撤销归档" }));

    const restoredTitles = ["交水电费", "报名CS231n", "整理参考文献", "提交研究报告"];
    await waitFor(() => {
      for (const title of restoredTitles) {
        expect(screen.getByRole("button", { name: title })).toBeInTheDocument();
      }
    });
  }, 10000);

  it("edits and persists task detail from the expanded detail region", async () => {
    renderTodos();

    const title = await screen.findByRole("button", { name: "提交论文初稿" });
    const task = title.closest(".space-y-2") as HTMLElement;
    fireEvent.click(within(task).getByRole("button", { name: "展开任务详情" }));
    fireEvent.click(await within(task).findByRole("button", { name: /详细说明:/ }));

    const detail = within(task).getByRole("textbox", { name: "详细说明" });
    fireEvent.change(detail, { target: { value: "补充实验记录" } });
    fireEvent.keyDown(detail, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(within(task).getByRole("button", { name: "详细说明: 补充实验记录" })).toBeInTheDocument();
    });
  });
});
