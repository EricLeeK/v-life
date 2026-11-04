import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider, useDemoMode } from "@/contexts/DemoModeContext";
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

  it("creates and edits todos without unsupported tag fields", async () => {
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const useCreate = todoHooks.useCreate;
    const useUpdate = todoHooks.useUpdate;
    vi.spyOn(todoHooks, "useCreate").mockImplementation(() => ({ ...useCreate(), mutateAsync: create }));
    vi.spyOn(todoHooks, "useUpdate").mockImplementation(() => ({ ...useUpdate(), mutateAsync: update }));
    renderTodos();
    fireEvent.click(await screen.findByRole("button", { name: "添加主任务" }));
    fireEvent.change(screen.getByLabelText(/任务标题/), { target: { value: "无需标签的待办" } });
    fireEvent.click(screen.getByRole("button", { name: "保存添加" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).not.toHaveProperty("tags");
    expect(create.mock.calls[0][0]).not.toHaveProperty("tag");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "添加待办主任务" })).not.toBeInTheDocument());
    const task = (await screen.findByRole("button", { name: "提交论文初稿" })).closest(".space-y-2") as HTMLElement;
    fireEvent.keyDown(within(task).getByRole("button", { name: "任务操作菜单" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "编辑任务" }));
    const editor = await screen.findByRole("dialog", { name: "编辑待办任务" });
    expect(within(editor).queryByLabelText(/标签/)).not.toBeInTheDocument();
    fireEvent.click(within(editor).getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).not.toHaveProperty("tags");
    expect(update.mock.calls[0][0]).not.toHaveProperty("tag");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑待办任务" })).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole("button", { name: "添加主任务" }));
    expect(screen.queryByLabelText(/标签/)).not.toBeInTheDocument();
  });

  it.each(["删除", "取消"])("releases the page pointer lock after choosing %s in task deletion", async (action) => {
    renderTodos();
    const title = await screen.findByRole("button", { name: "提交论文初稿" });
    const task = title.closest(".space-y-2") as HTMLElement;
    fireEvent.keyDown(within(task).getByRole("button", { name: "任务操作菜单" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除" }));
    const confirmation = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmation).getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    if (action === "删除") {
      expect(screen.queryByRole("button", { name: "提交论文初稿" })).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("button", { name: "提交论文初稿" })).toBeInTheDocument();
    }
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    const category = screen.getAllByRole("button", { name: /^收起分类:/ })[0];
    fireEvent.click(category);
    expect(category).toHaveAttribute("aria-expanded", "false");
  });

  it.each(["保存修改", "关闭"])("releases the page pointer lock after choosing %s in task editing", async (action) => {
    renderTodos();
    const title = await screen.findByRole("button", { name: "提交论文初稿" });
    const task = title.closest(".space-y-2") as HTMLElement;
    fireEvent.keyDown(within(task).getByRole("button", { name: "任务操作菜单" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "编辑任务" }));
    const editor = await screen.findByRole("dialog", { name: "编辑待办任务" });
    fireEvent.change(within(editor).getByRole("textbox", { name: /任务标题/ }), { target: { value: "提交修改后的论文" } });
    fireEvent.click(within(editor).getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑待办任务" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: action === "保存修改" ? "提交修改后的论文" : "提交论文初稿" })).toBeInTheDocument();
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    const category = screen.getAllByRole("button", { name: /^收起分类:/ })[0];
    fireEvent.click(category);
    expect(category).toHaveAttribute("aria-expanded", "false");
  });

  it("groups personal tasks and project cards under one category and folds them together", () => {
    renderTodos();
    expect(screen.queryByRole("group", { name: "任务视图" })).not.toBeInTheDocument();
    const header = screen.getByRole("button", { name: "收起分类: 工作" });
    const category = header.closest(".todo-fold") as HTMLElement;
    expect(within(category).getByRole("button", { name: "加入今天：部署上线" })).toBeInTheDocument();
    expect(within(category).getByRole("button", { name: "回复导师邮件" })).toBeInTheDocument();
    const blog = within(category).getByRole("region", {name:"来自项目 · 个人技术博客"});
    expect(within(blog).getByRole("button", {name:"加入今天：部署上线"})).toBeInTheDocument();
    expect(within(blog).getByRole("button", {name:"加入今天：撰写第一篇文章"})).toBeInTheDocument();
    expect(within(category).getAllByRole("region", {name:"来自项目 · 个人技术博客"})).toHaveLength(1);
    const projectToggle = within(blog).getByRole("button", {name:"收起项目: 个人技术博客"});
    fireEvent.click(projectToggle);
    expect(blog.querySelector(".warehouse-project-list")).toHaveAttribute("inert");
    expect(projectToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(category).getByRole("button", {name:"回复导师邮件"})).toBeInTheDocument();
    fireEvent.click(projectToggle);
    expect(screen.queryByRole("button", { name: "收起分类: 个人技术博客" })).not.toBeInTheDocument();
    const research = screen.getByRole("button", {name:"收起分类: 科研"}).closest(".todo-fold") as HTMLElement;
    expect(within(research).getByRole("region", {name:"来自项目 · 毕业论文"})).toBeInTheDocument();
    expect(within(research).getByRole("region", {name:"来自项目 · 可微分FEM框架"})).toBeInTheDocument();
    fireEvent.click(header);
    expect(category.querySelector(".todo-fold-list")).toHaveAttribute("inert");
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("shows completed over total for personal and mixed categories, and updates after checking a task", async () => {
    renderTodos();
    const life = screen.getByRole("button", {name:"收起分类: 生活"});
    const work = screen.getByRole("button", {name:"收起分类: 工作"});
    expect(within(life).getByTitle("已完成 1 项，共 5 项")).toHaveTextContent("1/5");
    expect(within(work).getByTitle("已完成 2 项，共 8 项")).toHaveTextContent("2/8");
    expect(within(screen.getByRole("button", {name:"收起分类: AI学习"})).getByTitle("已完成 0 项，共 8 项")).toHaveTextContent("0/8");

    const task = screen.getByRole("button", {name:"买日用品"}).closest(".space-y-2") as HTMLElement;
    fireEvent.click(within(task).getByRole("button", {name:"标记为已完成"}));
    await waitFor(() => expect(within(life).getByTitle("已完成 2 项，共 5 项")).toHaveTextContent("2/5"));

    fireEvent.click(screen.getByRole("button", {name:"完成部署上线"}));
    await waitFor(() => expect(within(work).getByTitle("已完成 3 项，共 8 项")).toHaveTextContent("3/8"));
  });

  it("moves the original cards when the parent project changes category", () => {
    function Reclassify() {
      const { demoData, updateRecord } = useDemoMode();
      return <button onClick={() => updateRecord("projects", demoData.projects.find(p => p.name === "个人技术博客")!.id, {category:"科研"})}>修改项目分类</button>;
    }
    renderTodos(<Reclassify />);
    const original = screen.getByRole("button", {name:"加入今天：部署上线"}).closest("[data-project-task]")!.getAttribute("data-project-task");
    fireEvent.click(screen.getByRole("button", {name:"修改项目分类"}));
    const research = screen.getByRole("button", {name:"收起分类: 科研"}).closest(".todo-fold") as HTMLElement;
    expect(within(research).getByRole("button", {name:"加入今天：部署上线"}).closest("[data-project-task]")).toHaveAttribute("data-project-task", original);
    expect(screen.getAllByRole("button", {name:"加入今天：部署上线"})).toHaveLength(1);
    expect(within(research).getByRole("region", {name:"来自项目 · 毕业论文"})).toBeInTheDocument();
  });

  it("updates the existing warehouse group when its project color changes", () => {
    function Recolor() {
      const { demoData, updateRecord } = useDemoMode();
      return <button onClick={() => updateRecord("projects", demoData.projects.find(p => p.name === "个人技术博客")!.id, {cover_preset:"rose"})}>修改项目颜色</button>;
    }
    renderTodos(<Recolor />);
    const group = screen.getByRole("region", {name:"来自项目 · 个人技术博客"});
    const original = group.querySelector("[data-project-task]")!.getAttribute("data-project-task");
    fireEvent.click(screen.getByRole("button", {name:"修改项目颜色"}));
    expect(group.querySelector(".project-cover")).toHaveAttribute("data-preset", "rose");
    expect(group.querySelector("[data-project-task]")).toHaveAttribute("data-project-task", original);
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
