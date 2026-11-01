import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "./Projects";

const api = vi.hoisted(() => ({
  projects: [{ id: "p1", name: "论文", status: "active", priority: "medium", progress: 50 }, { id: "p2", name: "旅行", status: "planning", priority: "medium", progress: 0 }],
  tasks: [
    { id: "t1", title: "文献综述", type: "task", status: "todo", weight: 1, sort_order: 0 },
    { id: "h1", title: "每日阅读", type: "habit", status: "todo", weight: 1, sort_order: 1 },
    { id: "m1", title: "提交初稿", type: "milestone", status: "done", weight: 1, sort_order: 0 },
  ],
  updateTask: vi.fn(), deleteTask: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), create: vi.fn(), toast: vi.fn(), move: vi.fn(),
}));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: api.toast }) }));
vi.mock("@/hooks/useProjectBoardMove", () => ({ useProjectBoardMove: () => ({ mutateAsync: api.move }) }));
vi.mock("@/hooks/useData", () => ({
  useProjects: () => ({ data: api.projects }),
  useProjectTasks: (id: string) => ({ data: id === "p1" ? api.tasks : [] }),
  useCreateProject: () => ({ mutateAsync: api.create }),
  useUpdateProject: () => ({ mutate: api.updateProject, mutateAsync: api.updateProject }),
  useDeleteProject: () => ({ mutateAsync: api.deleteProject }),
  useCreateProjectTask: () => ({ mutateAsync: api.create }),
  useUpdateProjectTask: () => ({ mutate: api.updateTask, mutateAsync: api.updateTask }),
  useDeleteProjectTask: () => ({ mutateAsync: api.deleteTask }),
  useHabitLogs: () => ({ data: [] }),
  useToggleHabitLog: () => ({ mutate: vi.fn() }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  api.updateTask.mockResolvedValue({}); api.deleteTask.mockResolvedValue(undefined);
  api.updateProject.mockResolvedValue({}); api.deleteProject.mockResolvedValue(undefined);
  api.move.mockResolvedValue([]);
});
afterEach(cleanup);
const editMode = () => fireEvent.click(screen.getByRole("button", { name: "编辑" }));

describe("project edit mode", () => {
  it("uses task weights for the selected sidebar progress even when the stored summary is stale", () => {
    const stored=api.projects[0].progress;
    api.projects[0].progress=99;
    try {
      const {container}=render(<ProjectsPage />);
      expect(container.querySelector('.project-sidebar')).toHaveTextContent('50%');
      expect(container.querySelector('.project-sidebar')).not.toHaveTextContent('99%');
    } finally { api.projects[0].progress=stored; }
  });
  it("keeps task-derived progress when selecting another project and reflects task changes while unselected", () => {
    const stored = api.projects[0].progress;
    const originalTasks = api.tasks;
    api.projects[0].progress = 0;
    try {
      const { container, rerender } = render(<ProjectsPage />);
      const thesis = () => Array.from(container.querySelectorAll('.project-sidebar-item')).find(item => item.textContent?.includes('论文'))!;
      expect(thesis()).toHaveTextContent('50%');
      fireEvent.click(container.querySelector('.project-sidebar-item[data-selected="false"]')!);
      expect(thesis()).toHaveTextContent('50%');
      expect(thesis()).not.toHaveAttribute('aria-current');
      api.tasks = originalTasks.map(task => task.id === 't1' ? { ...task, status: 'done' } : task);
      rerender(<ProjectsPage />);
      expect(thesis()).toHaveTextContent('100%');
      fireEvent.click(thesis());
      expect(thesis()).toHaveTextContent('100%');
      expect(thesis()).toHaveAttribute('aria-current', 'true');
    } finally {
      api.projects[0].progress = stored;
      api.tasks = originalTasks;
    }
  });
  it("creates into the column whose add button was used and saves the chosen texture", async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "在等待中添加工作项" }));
    fireEvent.change(screen.getByLabelText(/标题/), { target: { value: "等导师反馈" } });
    fireEvent.click(screen.getByRole("button", { name: "雾蓝" }));
    fireEvent.click(screen.getByRole("button", { name: "创建工作项" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ status: "waiting", cover_preset: "mist", title: "等导师反馈", project_id: "p1" })));
  });
  it("restores the board and reports a failed keyboard move", async () => {
    api.move.mockRejectedValueOnce(new Error("offline"));
    render(<ProjectsPage />);
    const item=screen.getByRole('listitem',{name:'文献综述'});
    fireEvent.keyDown(item,{key:' '});
    fireEvent.keyDown(item,{key:'ArrowRight'});
    fireEvent.keyDown(screen.getByRole('listitem',{name:'文献综述'}),{key:' '});
    await waitFor(()=>expect(api.move).toHaveBeenCalledWith(expect.objectContaining({id:'t1',status:'in_progress'})));
    await waitFor(()=>expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({title:'移动未保存，已恢复原状态'})));
    expect(screen.getByRole('listitem',{name:'文献综述'}).closest('[data-project-column]')).toHaveAttribute('data-project-column','todo');
  });
  it("keeps this-week and waiting items accessible for editing", () => {
    const original = api.tasks;
    api.tasks = [...original,
      { id: "week", title: "本周阅读", type: "task", status: "this_week", weight: 1, sort_order: 0 },
      { id: "waiting", title: "等待反馈", type: "task", status: "waiting", weight: 1, sort_order: 0 },
    ];
    try {
      render(<ProjectsPage />); editMode();
      expect(screen.getByRole("button", { name: "编辑本周阅读" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "编辑等待反馈" })).toBeInTheDocument();
    } finally { api.tasks = original; }
  });
  it("shows corner actions for board cards without changing the project sidebar", () => {
    const {container}=render(<ProjectsPage />);
    const sidebar=container.querySelector('.project-sidebar')!.innerHTML;
    expect(screen.queryByRole("button", { name: "删除每日阅读" })).not.toBeInTheDocument();
    editMode();
    for (const title of ["论文", "文献综述", "每日阅读", "提交初稿"]) {
      expect(screen.getByRole("button", { name: `编辑${title}` })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `删除${title}` })).toBeInTheDocument();
    }
    expect(container.querySelector('.project-sidebar')!.innerHTML).toBe(sidebar);
    expect(screen.getByRole('button',{name:'编辑论文'}).closest('.project-board-title')).not.toBeNull();
    expect(screen.getByRole('button',{name:'编辑文献综述'}).closest('.project-card-shell')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    expect(screen.queryByRole("button", { name: "删除每日阅读" })).not.toBeInTheDocument();
  });

  it("does not open a task editor by clicking a card outside edit mode", () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByText('文献综述'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    editMode();
    fireEvent.click(screen.getByRole('button',{name:'编辑文献综述'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it("blocks header actions while saving without entering the dimmed disabled appearance", async () => {
    let finish!:()=>void;
    api.move.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    render(<ProjectsPage />);
    fireEvent.keyDown(screen.getByRole('listitem',{name:'文献综述'}),{key:' '});
    fireEvent.keyDown(screen.getByRole('listitem',{name:'文献综述'}),{key:'ArrowRight'});
    fireEvent.keyDown(screen.getByRole('listitem',{name:'文献综述'}),{key:' '});
    await waitFor(()=>expect(api.move).toHaveBeenCalled());
    for(const name of ['编辑','新建事项']) {
      const button=screen.getByRole('button',{name});
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled','true');
      fireEvent.click(button);
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'完成编辑'})).not.toBeInTheDocument();
    await act(async()=>{finish();});
  });

  it("edits a habit through its visible action", async () => {
    render(<ProjectsPage />); editMode();
    fireEvent.click(screen.getByRole("button", { name: "编辑每日阅读" }));
    fireEvent.change(screen.getByLabelText(/标题/), { target: { value: "阅读半小时" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith(expect.objectContaining({ id: "h1", project_id: "p1", title: "阅读半小时" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps an edit draft on save failure", async () => {
    api.updateTask.mockRejectedValueOnce(new Error("network unavailable"));
    render(<ProjectsPage />); editMode();
    fireEvent.click(screen.getByRole("button", { name: "编辑每日阅读" }));
    fireEvent.change(screen.getByLabelText(/标题/), { target: { value: "保留草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "保存失败" })));
    expect(screen.getByLabelText(/标题/)).toHaveValue("保留草稿");
  });

  it("cancels deletion, then deletes a milestone and recalculates progress", async () => {
    render(<ProjectsPage />); editMode();
    fireEvent.click(screen.getByRole("button", { name: "删除提交初稿" }));
    expect(api.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(api.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除提交初稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(api.deleteTask).toHaveBeenCalledWith({ id: "m1", project_id: "p1" }));
    expect(api.updateProject).toHaveBeenCalledWith({ id: "p1", progress: 0 });
  });

  it("keeps the confirmation open when deletion fails", async () => {
    api.deleteTask.mockRejectedValueOnce(new Error("offline"));
    render(<ProjectsPage />); editMode();
    fireEvent.click(screen.getByRole("button", { name: "删除文献综述" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "删除失败" })));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(api.updateProject).not.toHaveBeenCalled();
  });

  it("deletes the selected project and selects the next project", async () => {
    const { rerender } = render(<ProjectsPage />); editMode();
    fireEvent.click(screen.getAllByRole("button", { name: "删除论文" }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(api.deleteProject).toHaveBeenCalledWith("p1"));
    const original = api.projects;
    api.projects = original.slice(1);
    rerender(<ProjectsPage />);
    expect(await screen.findByRole("heading", { name: "旅行", level: 2 })).toBeInTheDocument();
    api.projects = original;
  });
});
