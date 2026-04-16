# V-Life 项目管理模块实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 V-Life 应用新增一个完整的项目管理模块，支持多项目并行管理、任务级五列看板、习惯打卡、里程碑追踪，以及基于权重的进度计算。

**架构：** 采用左右分屏布局，左侧项目列表 + 右侧任务级看板。数据存储于 Supabase，新增 `projects`、`project_tasks`、`habit_logs`、`task_tags`、`project_task_tags` 五张表。看板拖拽使用 `@hello-pangea/dnd`，数据层使用 TanStack Query hooks。

**技术栈：** Vite + React 18 + TypeScript + shadcn/ui + Tailwind CSS + TanStack Query + Supabase

---

## 文件清单

| 文件 | 类型 | 职责 |
|------|------|------|
| `supabase/migrations/20260416_project_management.sql` | 新建 | 创建 `projects`、`project_tasks`、`habit_logs`、`task_tags`、`project_task_tags` 表及 RLS 策略 |
| `src/hooks/useData.ts` | 修改 | 新增 `projectHooks`、`projectTaskHooks`、`habitLogHooks`、`tagHooks` |
| `src/pages/Projects.tsx` | 新建 | 项目管理主页面 |
| `src/components/ProjectSidebar.tsx` | 新建 | 左侧项目列表组件 |
| `src/components/ProjectBoard.tsx` | 新建 | 右侧看板容器 + 顶部工具栏 |
| `src/components/BoardColumn.tsx` | 新建 | 单列容器组件 |
| `src/components/TaskCard.tsx` | 新建 | 普通任务卡片 |
| `src/components/HabitCard.tsx` | 新建 | 习惯卡片（含打卡、进度环） |
| `src/components/MilestoneCard.tsx` | 新建 | 里程碑卡片 |
| `src/components/ProjectModal.tsx` | 新建 | 新建/编辑项目弹窗 |
| `src/components/TaskModal.tsx` | 新建 | 新建/编辑任务/习惯/里程碑弹窗 |
| `src/App.tsx` | 修改 | 新增 `/projects` 路由 |
| `src/components/AppSidebar.tsx` | 修改 | 新增"项目管理"导航项 |
| `src/pages/Index.tsx` | 修改 | 首页 Dashboard 新增项目管理卡片入口 |

---

## 任务 1：Supabase 数据库迁移

**文件：**
- 创建：`supabase/migrations/20260416_project_management.sql`

- [ ] **步骤 1：编写迁移文件**

```sql
-- ============================================
-- 项目管理模块表结构
-- ============================================

-- 1. projects 表
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. project_tasks 表
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'habit', 'milestone')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'this_week', 'in_progress', 'waiting', 'done')),
  weight FLOAT NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. habit_logs 表
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.project_tasks ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, log_date)
);

-- 4. task_tags 表
CREATE TABLE IF NOT EXISTS public.task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6'
);

-- 5. project_task_tags 关联表
CREATE TABLE IF NOT EXISTS public.project_task_tags (
  task_id UUID REFERENCES public.project_tasks ON DELETE CASCADE,
  tag_id UUID REFERENCES public.task_tags ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks (status);
CREATE INDEX IF NOT EXISTS idx_habit_logs_task_id ON public.habit_logs (task_id);

-- RLS 启用
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_tags ENABLE ROW LEVEL SECURITY;

-- projects RLS
CREATE POLICY "projects_select_own" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- project_tasks RLS
CREATE POLICY "tasks_select_own" ON public.project_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_tasks.project_id AND user_id = auth.uid())
);
CREATE POLICY "tasks_insert_own" ON public.project_tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_tasks.project_id AND user_id = auth.uid())
);
CREATE POLICY "tasks_update_own" ON public.project_tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_tasks.project_id AND user_id = auth.uid())
);
CREATE POLICY "tasks_delete_own" ON public.project_tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_tasks.project_id AND user_id = auth.uid())
);

-- habit_logs RLS
CREATE POLICY "habit_logs_select_own" ON public.habit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt JOIN public.projects p ON pt.project_id = p.id
    WHERE pt.id = habit_logs.task_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "habit_logs_insert_own" ON public.habit_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt JOIN public.projects p ON pt.project_id = p.id
    WHERE pt.id = habit_logs.task_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "habit_logs_delete_own" ON public.habit_logs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt JOIN public.projects p ON pt.project_id = p.id
    WHERE pt.id = habit_logs.task_id AND p.user_id = auth.uid()
  )
);

-- task_tags RLS
CREATE POLICY "task_tags_select_own" ON public.task_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = task_tags.project_id AND user_id = auth.uid())
);
CREATE POLICY "task_tags_insert_own" ON public.task_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = task_tags.project_id AND user_id = auth.uid())
);
CREATE POLICY "task_tags_update_own" ON public.task_tags FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = task_tags.project_id AND user_id = auth.uid())
);
CREATE POLICY "task_tags_delete_own" ON public.task_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = task_tags.project_id AND user_id = auth.uid())
);

-- project_task_tags RLS
CREATE POLICY "ptt_select_own" ON public.project_task_tags FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt JOIN public.projects p ON pt.project_id = p.id
    WHERE pt.id = project_task_tags.task_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "ptt_insert_own" ON public.project_task_tags FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt JOIN public.projects p ON pt.project_id = p.id
    WHERE pt.id = project_task_tags.task_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "ptt_delete_own" ON public.project_task_tags FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks pt JOIN public.projects p ON pt.project_id = p.id
    WHERE pt.id = project_task_tags.task_id AND p.user_id = auth.uid()
  )
);
```

- [ ] **步骤 2：在本地 Supabase 应用迁移**

运行：`cd ~/Projects/v-life && npx supabase migration up`（如果 Supabase CLI 已登录并启动本地实例）

或者登录 Supabase Dashboard → SQL Editor → 粘贴并执行。

- [ ] **步骤 3：重新生成 TypeScript 类型**

运行：`npx supabase gen types typescript --local > src/integrations/supabase/types.ts`

或如果连接远程项目：`npx supabase gen types typescript --project-id <your-project-ref> > src/integrations/supabase/types.ts`

验证：打开 `src/integrations/supabase/types.ts`，搜索 `projects`、`project_tasks`、`habit_logs`，确认类型已生成。

- [ ] **步骤 4：Commit**

```bash
git add supabase/migrations/20260416_project_management.sql src/integrations/supabase/types.ts
git commit -m "feat(db): add project management tables with RLS"
```

---

## 任务 2：新增 TanStack Query Hooks

**文件：**
- 修改：`src/hooks/useData.ts`

- [ ] **步骤 1：在 useData.ts 末尾新增专用 hooks**

在文件末尾 `useCurrentWeekGoals` 之后插入以下代码：

```typescript
// ============ Project Management Hooks ============

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from("projects").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { data, error } = await supabase.from("projects").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useProjectTasks(projectId?: string) {
  return useQuery({
    queryKey: ["project_tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from("project_tasks").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["project_tasks", variables.project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...updates }: { id: string; project_id: string } & Record<string, any>) => {
      const { data, error } = await supabase.from("project_tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, project_id, ...updates }) => {
      await qc.cancelQueries({ queryKey: ["project_tasks", project_id] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["project_tasks", project_id] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.map((item: any) => item.id === id ? { ...item, ...updates } : item));
        }
      });
      return { snapshots };
    },
    onError: (_err, { project_id }, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, { project_id }) => {
      qc.invalidateQueries({ queryKey: ["project_tasks", project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from("project_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, project_id }) => {
      await qc.cancelQueries({ queryKey: ["project_tasks", project_id] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["project_tasks", project_id] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.filter((item: any) => item.id !== id));
        }
      });
      return { snapshots };
    },
    onError: (_err, { project_id }, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, { project_id }) => {
      qc.invalidateQueries({ queryKey: ["project_tasks", project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useHabitLogs(taskId?: string) {
  return useQuery({
    queryKey: ["habit_logs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("*").eq("task_id", taskId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId,
  });
}

export function useToggleHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId, logDate }: { taskId: string; projectId: string; logDate: string }) => {
      const { data: existing } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("task_id", taskId)
        .eq("log_date", logDate)
        .single();
      if (existing) {
        const { error } = await supabase.from("habit_logs").delete().eq("id", existing.id);
        if (error) throw error;
        return { completed: false };
      } else {
        const { error } = await supabase.from("habit_logs").insert({ task_id: taskId, log_date: logDate });
        if (error) throw error;
        return { completed: true };
      }
    },
    onSuccess: (_data, { taskId, projectId }) => {
      qc.invalidateQueries({ queryKey: ["habit_logs", taskId] });
      qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    },
  });
}

export function useTaskTags(projectId?: string) {
  return useQuery({
    queryKey: ["task_tags", projectId],
    queryFn: async () => {
      let query = supabase.from("task_tags").select("*");
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}
```

- [ ] **步骤 2：运行类型检查**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无新增类型错误。如果报错，根据错误信息修复 hooks 签名或导入。

- [ ] **步骤 3：Commit**

```bash
git add src/hooks/useData.ts
git commit -m "feat(hooks): add project management query hooks"
```

---

## 任务 3：新增弹窗组件

### 3.1 ProjectModal

**文件：**
- 创建：`src/components/ProjectModal.tsx`

- [ ] **步骤 1：创建文件**

```tsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: any) => void;
  initial?: any;
}

export function ProjectModal({ open, onOpenChange, onSave, initial }: ProjectModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    target_date: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || "",
        description: initial?.description || "",
        status: initial?.status || "planning",
        priority: initial?.priority || "medium",
        target_date: initial?.target_date ? initial.target_date.slice(0, 10) : "",
      });
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      target_date: form.target_date || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑项目" : "新建项目"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>项目名称 *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：毕业论文"
            />
          </div>
          <div>
            <Label>项目描述</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简要描述项目目标..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">规划中</SelectItem>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="paused">暂停中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>优先级</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>目标日期</Label>
            <Input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {initial ? "保存修改" : "创建项目"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3.2 TaskModal

**文件：**
- 创建：`src/components/TaskModal.tsx`

- [ ] **步骤 2：创建文件**

```tsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: any) => void;
  projectId: string;
  initial?: any;
  defaultType?: "task" | "habit" | "milestone";
}

export function TaskModal({
  open,
  onOpenChange,
  onSave,
  projectId,
  initial,
  defaultType = "task",
}: TaskModalProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: defaultType,
    status: "todo",
    weight: 1,
    due_date: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title || "",
        description: initial?.description || "",
        type: initial?.type || defaultType,
        status: initial?.status || "todo",
        weight: initial?.weight ?? 1,
        due_date: initial?.due_date ? initial.due_date.slice(0, 10) : "",
      });
    }
  }, [open, initial, defaultType]);

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      project_id: projectId,
      weight: Number(form.weight) || 1,
      due_date: form.due_date || null,
    });
  };

  const isHabit = form.type === "habit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "编辑工作项" : "新建工作项"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>类型</Label>
            <Select
              value={form.type}
              onValueChange={(v: any) => setForm({ ...form, type: v })}
              disabled={!!initial}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">任务</SelectItem>
                <SelectItem value="habit">习惯</SelectItem>
                <SelectItem value="milestone">里程碑</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>标题 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={isHabit ? "例如：晨跑 30 分钟" : "例如：完成文献综述"}
            />
          </div>
          <div>
            <Label>描述</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          {!isHabit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">待办</SelectItem>
                    <SelectItem value="this_week">本周</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="waiting">等待中</SelectItem>
                    <SelectItem value="done">已完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>权重</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          {isHabit && (
            <div>
              <Label>权重</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">习惯默认不计入项目进度</p>
            </div>
          )}
          <div>
            <Label>截止日期</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {initial ? "保存修改" : "创建工作项"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **步骤 3：运行 lint/typecheck**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无错误。

- [ ] **步骤 4：Commit**

```bash
git add src/components/ProjectModal.tsx src/components/TaskModal.tsx
git commit -m "feat(components): add ProjectModal and TaskModal"
```

---

## 任务 4：新增卡片组件

### 4.1 TaskCard

**文件：**
- 创建：`src/components/TaskCard.tsx`

- [ ] **步骤 1：创建文件**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

interface TaskCardProps {
  task: any;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityColors: Record<string, string> = {
    high: "bg-destructive/20 text-destructive",
    medium: "bg-warning/20 text-warning",
    low: "bg-primary/20 text-primary",
  };

  return (
    <Card
      className="border-l-4 border-l-blue-500 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <CheckSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <span className="text-sm font-medium leading-snug flex-1">{task.title}</span>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 pl-6">
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between pl-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">w={task.weight}</span>
            {task.priority && task.priority !== "medium" && (
              <Badge variant="secondary" className={`text-[10px] px-1 py-0 h-4 ${priorityColors[task.priority] || ""}`}>
                {task.priority === "high" ? "高" : task.priority === "low" ? "低" : "中"}
              </Badge>
            )}
          </div>
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(parseISO(task.due_date), { addSuffix: true, locale: zhCN })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.2 MilestoneCard

**文件：**
- 创建：`src/components/MilestoneCard.tsx`

- [ ] **步骤 2：创建文件**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Flag } from "lucide-react";
import { format, parseISO } from "date-fns";

interface MilestoneCardProps {
  task: any;
  onToggle?: (done: boolean) => void;
  onClick?: () => void;
}

export function MilestoneCard({ task, onToggle, onClick }: MilestoneCardProps) {
  return (
    <Card
      className="border-l-4 border-l-amber-500 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Flag className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{task.title}</p>
            {task.due_date && (
              <p className="text-[10px] text-muted-foreground mt-1">
                截止 {format(parseISO(task.due_date), "MM/dd")}
              </p>
            )}
          </div>
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={(v) => {
              if (onToggle) onToggle(v as boolean);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.3 HabitCard

**文件：**
- 创建：`src/components/HabitCard.tsx`

- [ ] **步骤 3：创建文件**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Repeat } from "lucide-react";
import { useHabitLogs, useToggleHabitLog } from "@/hooks/useData";

interface HabitCardProps {
  task: any;
  projectId: string;
}

function CircularProgress({ value }: { value: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="w-12 h-12 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-purple-500"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-medium">{Math.round(value)}%</span>
    </div>
  );
}

export function HabitCard({ task, projectId }: HabitCardProps) {
  const { data: logs = [] } = useHabitLogs(task.id);
  const toggleMutation = useToggleHabitLog();

  const today = new Date().toISOString().split("T")[0];
  const isCompletedToday = logs.some((log: any) => log.log_date === today);

  // 本周一到今天
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const daysSinceMonday = Math.floor((now.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weeklyGoal = 7;
  const completedThisWeek = logs.filter((log: any) => {
    const d = new Date(log.log_date);
    return d >= monday && d <= now;
  }).length;
  const progress = Math.min(100, (completedThisWeek / weeklyGoal) * 100);

  // streak 计算
  let streak = 0;
  const sortedLogs = [...logs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  if (sortedLogs.length > 0 && sortedLogs[0].log_date === today) {
    streak = 1;
    for (let i = 1; i < sortedLogs.length; i++) {
      const prev = new Date(sortedLogs[i - 1].log_date);
      const curr = new Date(sortedLogs[i].log_date);
      const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) streak++;
      else break;
    }
  } else if (sortedLogs.length > 0) {
    const last = new Date(sortedLogs[0].log_date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (last.toISOString().split("T")[0] === yesterday.toISOString().split("T")[0]) {
      streak = 1;
      for (let i = 1; i < sortedLogs.length; i++) {
        const prev = new Date(sortedLogs[i - 1].log_date);
        const curr = new Date(sortedLogs[i].log_date);
        const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) streak++;
        else break;
      }
    }
  }

  const handleToggle = () => {
    toggleMutation.mutate({ taskId: task.id, projectId, logDate: today });
  };

  return (
    <Card className="border-l-4 border-l-purple-500 hover:border-primary/30 transition-colors">
      <CardContent className="p-3 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 w-full mb-2">
          <Repeat className="h-4 w-4 text-purple-500 shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
          {streak > 0 && (
            <span className="text-[10px] bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded-full">
              🔥 {streak}
            </span>
          )}
        </div>
        <CircularProgress value={progress} />
        <p className="text-[10px] text-muted-foreground mt-1">
          本周 {completedThisWeek} / {weeklyGoal}
        </p>
        <button
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          className={`mt-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            isCompletedToday
              ? "bg-purple-500 text-white"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          }`}
        >
          {isCompletedToday ? "已打卡" : "今日打卡"}
        </button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **步骤 4：检查 `date-fns` 是否已安装**

查看 `package.json`，确认 `date-fns` 在 dependencies 中。v-life 项目已有 `date-fns": "^3.6.0"`，无需安装。

- [ ] **步骤 5：运行类型检查**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无错误。

- [ ] **步骤 6：Commit**

```bash
git add src/components/TaskCard.tsx src/components/MilestoneCard.tsx src/components/HabitCard.tsx
git commit -m "feat(components): add task, milestone and habit cards"
```

---

## 任务 5：新增看板列和侧边栏组件

### 5.1 BoardColumn

**文件：**
- 创建：`src/components/BoardColumn.tsx`

- [ ] **步骤 1：创建文件**

```tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface BoardColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
  onAdd?: () => void;
}

export function BoardColumn({ title, count, children, onAdd }: BoardColumnProps) {
  return (
    <div className="flex flex-col min-w-[260px] max-w-[260px] h-full">
      <div className="flex items-center justify-between px-1 py-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {children}
      </div>
      <Button variant="ghost" size="sm" className="mt-2 justify-start text-muted-foreground" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" />
        添加
      </Button>
    </div>
  );
}
```

### 5.2 ProjectSidebar

**文件：**
- 创建：`src/components/ProjectSidebar.tsx`

- [ ] **步骤 2：创建文件**

```tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectSidebarProps {
  projects: any[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (project: any) => void;
}

export function ProjectSidebar({ projects, selectedId, onSelect, onAdd, onEdit }: ProjectSidebarProps) {
  const [showArchived, setShowArchived] = useState(false);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const grouped = {
    active: projects.filter((p) => p.status === "active").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    planning: projects.filter((p) => p.status === "planning").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    paused: projects.filter((p) => p.status === "paused").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    done: projects.filter((p) => p.status === "completed" || p.status === "archived").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
  };

  const priorityDot: Record<string, string> = {
    high: "bg-destructive",
    medium: "bg-warning",
    low: "bg-success",
  };

  const renderGroup = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground px-1">{title} ({items.length})</h4>
        <div className="space-y-2">
          {items.map((p) => (
            <Card
              key={p.id}
              className={`cursor-pointer transition-colors ${
                selectedId === p.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/20"
              }`}
              onClick={() => onSelect(p.id)}
            >
              <CardContent className="p-3 relative">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${priorityDot[p.priority] || "bg-muted"}`} />
                  <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(p); }}>
                        编辑
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Progress value={p.progress} className="h-1.5 mt-2" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {p.target_date ? `目标 ${p.target_date.slice(0, 10)}` : "无截止日期"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col p-3 border-r border-border bg-card/30">
      <Button onClick={onAdd} className="w-full mb-4">
        <Plus className="h-4 w-4 mr-1" />
        新建项目
      </Button>
      <div className="flex-1 overflow-y-auto space-y-4">
        {renderGroup("进行中", grouped.active)}
        {renderGroup("规划中", grouped.planning)}
        {renderGroup("暂停中", grouped.paused)}
        <Collapsible open={showArchived} onOpenChange={setShowArchived}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span>已完成 / 归档 ({grouped.done.length})</span>
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {grouped.done.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors ${
                  selectedId === p.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/20"
                }`}
                onClick={() => onSelect(p.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${priorityDot[p.priority] || "bg-muted"}`} />
                    <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
```

- [ ] **步骤 3：运行类型检查**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无错误。

- [ ] **步骤 4：Commit**

```bash
git add src/components/BoardColumn.tsx src/components/ProjectSidebar.tsx
git commit -m "feat(components): add BoardColumn and ProjectSidebar"
```

---

## 任务 6：新增 ProjectBoard 组件（含拖拽逻辑）

**文件：**
- 创建：`src/components/ProjectBoard.tsx`

- [ ] **步骤 1：创建文件**

```tsx
import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoardColumn } from "./BoardColumn";
import { TaskCard } from "./TaskCard";
import { HabitCard } from "./HabitCard";
import { MilestoneCard } from "./MilestoneCard";
import { TaskModal } from "./TaskModal";
import { useProjectTasks, useUpdateProjectTask, useUpdateProject } from "@/hooks/useData";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLUMNS = [
  { id: "todo", title: "待办" },
  { id: "this_week", title: "本周" },
  { id: "in_progress", title: "进行中" },
  { id: "waiting", title: "等待中" },
  { id: "done", title: "已完成" },
] as const;

type FilterType = "all" | "task" | "habit" | "milestone";

interface ProjectBoardProps {
  project: any;
  onEditProject: () => void;
}

export function ProjectBoard({ project, onEditProject }: ProjectBoardProps) {
  const { data: tasks = [] } = useProjectTasks(project.id);
  const updateTask = useUpdateProjectTask();
  const updateProject = useUpdateProject();
  const [filter, setFilter] = useState<FilterType>("all");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"task" | "habit" | "milestone">("task");
  const [editingTask, setEditingTask] = useState<any>(null);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.type === filter);
  }, [tasks, filter]);

  // 计算并更新项目进度
  const computeProgress = (allTasks: any[]) => {
    const countable = allTasks.filter((t) => t.type !== "habit");
    if (countable.length === 0) return 0;
    const totalWeight = countable.reduce((s, t) => s + (t.weight || 1), 0);
    const doneWeight = countable.filter((t) => t.status === "done").reduce((s, t) => s + (t.weight || 1), 0);
    return Math.round((doneWeight / totalWeight) * 100);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as any;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task || task.status === newStatus) return;

    const updates: any = { status: newStatus };
    if (newStatus === "done" && task.type !== "habit") {
      // 自动标记完成，无需额外字段
    }

    // 乐观更新本地顺序
    updateTask.mutate({ id: task.id, project_id: project.id, ...updates });

    // 检查进度变化
    const simulatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, ...updates } : t));
    const newProgress = computeProgress(simulatedTasks);
    if (newProgress !== project.progress) {
      updateProject.mutate({ id: project.id, progress: newProgress });
    }
  };

  const handleMilestoneToggle = (task: any, done: boolean) => {
    const newStatus = done ? "done" : "todo";
    updateTask.mutate({ id: task.id, project_id: project.id, status: newStatus });
    const simulatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
    const newProgress = computeProgress(simulatedTasks);
    if (newProgress !== project.progress) {
      updateProject.mutate({ id: project.id, progress: newProgress });
    }
  };

  const openAddModal = (type: "task" | "habit" | "milestone") => {
    setModalType(type);
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const openEditModal = (task: any) => {
    setModalType(task.type);
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const createTask = useCreateProjectTask();

  const handleSaveTask = (values: any) => {
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, project_id: project.id, ...values });
    } else {
      createTask.mutate(values, {
        onSuccess: () => {
          // 创建后重新计算进度（如果习惯则不影响）
          const newTasks = [...tasks, { ...values, id: "temp" }];
          const newProgress = computeProgress(newTasks);
          if (newProgress !== project.progress) {
            updateProject.mutate({ id: project.id, progress: newProgress });
          }
        },
      });
    }
    setTaskModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-lg font-semibold truncate">{project.name}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditProject}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2">全部</TabsTrigger>
              <TabsTrigger value="task" className="text-xs px-2">任务</TabsTrigger>
              <TabsTrigger value="habit" className="text-xs px-2">习惯</TabsTrigger>
              <TabsTrigger value="milestone" className="text-xs px-2">里程碑</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Progress value={project.progress} className="h-2 flex-1" />
          <span className="text-sm font-medium w-10 text-right">{project.progress}%</span>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-2">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="h-full">
                      <BoardColumn
                        title={col.title}
                        count={colTasks.length}
                        onAdd={() => openAddModal(col.id === "done" ? "task" : "task")}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className="mb-2"
                              >
                                {task.type === "habit" ? (
                                  <HabitCard task={task} projectId={project.id} />
                                ) : task.type === "milestone" ? (
                                  <MilestoneCard
                                    task={task}
                                    onToggle={(done) => handleMilestoneToggle(task, done)}
                                    onClick={() => openEditModal(task)}
                                  />
                                ) : (
                                  <TaskCard task={task} onClick={() => openEditModal(task)} />
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </BoardColumn>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSave={handleSaveTask}
        projectId={project.id}
        initial={editingTask}
        defaultType={modalType}
      />
    </div>
  );
}
```

注意：上面代码中 `useCreateProjectTask` 需要从 `useData.ts` 导入，请在文件顶部添加：

```tsx
import { useProjectTasks, useUpdateProjectTask, useUpdateProject, useCreateProjectTask } from "@/hooks/useData";
```

- [ ] **步骤 2：修复导入**

确保 `src/components/ProjectBoard.tsx` 文件顶部的导入包含 `useCreateProjectTask`。

- [ ] **步骤 3：运行类型检查**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无错误。如果有 `date-fns` locale 导入错误，检查 `zhCN` 是否为 `zhCN`（v3 中是小写 `zhCN`，不是 `zhCN`...实际上 date-fns v3 的 locale 导出是 `zhCN`，正确）。

- [ ] **步骤 4：Commit**

```bash
git add src/components/ProjectBoard.tsx
git commit -m "feat(components): add ProjectBoard with drag-and-drop"
```

---

## 任务 7：新增 Projects 页面

**文件：**
- 创建：`src/pages/Projects.tsx`

- [ ] **步骤 1：创建文件**

```tsx
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { ProjectBoard } from "@/components/ProjectBoard";
import { ProjectModal } from "@/components/ProjectModal";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";

export default function ProjectsPage() {
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedId) {
      const active = projects.find((p) => p.status === "active");
      setSelectedId(active?.id || projects[0].id);
    }
  }, [projects, selectedId]);

  const selectedProject = projects.find((p) => p.id === selectedId);

  const handleSaveProject = async (values: any) => {
    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject.id, ...values });
      } else {
        const data = await createProject.mutateAsync(values);
        if (data?.id) setSelectedId(data.id);
      }
      setProjectModalOpen(false);
      setEditingProject(null);
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  return (
    <AppLayout title="项目管理">
      <div className="flex h-[calc(100vh-3rem)]">
        <div className="w-80 shrink-0">
          <ProjectSidebar
            projects={projects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
            onEdit={handleEditProject}
          />
        </div>
        <div className="flex-1 min-w-0">
          {selectedProject ? (
            <ProjectBoard
              project={selectedProject}
              onEditProject={() => handleEditProject(selectedProject)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              请新建或选择一个项目
            </div>
          )}
        </div>
      </div>
      <ProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        onSave={handleSaveProject}
        initial={editingProject}
      />
    </AppLayout>
  );
}
```

- [ ] **步骤 2：运行类型检查**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无错误。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/Projects.tsx
git commit -m "feat(pages): add Projects page"
```

---

## 任务 8：路由与导航集成

### 8.1 App.tsx

**文件：**
- 修改：`src/App.tsx`

- [ ] **步骤 1：导入并注册路由**

在 `src/App.tsx` 中：
1. 在 import 区域新增：`import ProjectsPage from "./pages/Projects";`
2. 在 `<Routes>` 内添加：`<Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />`

### 8.2 AppSidebar.tsx

**文件：**
- 修改：`src/components/AppSidebar.tsx`

- [ ] **步骤 2：导入图标并添加导航项**

1. 在 lucide 导入处新增 `Kanban`：
```tsx
import {
  LayoutDashboard,
  Carrot,
  Package,
  CalendarDays,
  Flame,
  Wallet,
  CheckSquare,
  Target,
  Lightbulb,
  Settings,
  Scale,
  LogOut,
  Kanban,
} from "lucide-react";
```

2. 在 `mainItems` 数组中添加（建议放在 "待办事项" 之后）：
```tsx
  { title: "项目管理", url: "/projects", icon: Kanban },
```

### 8.3 Index.tsx

**文件：**
- 修改：`src/pages/Index.tsx`

- [ ] **步骤 3：Dashboard 新增入口卡片**

1. 在 `Index.tsx` 的 import 区域新增 `Kanban`：
```tsx
import { CalendarDays, Flame, Wallet, CheckSquare, Carrot, Package, Lightbulb, Target, TrendingDown, Timer, Kanban } from "lucide-react";
```

2. 在 `useRecentWeightTrend` 导入后新增 `useProjects`：
```tsx
import { useProjects } from "@/hooks/useData";
```

3. 在 Dashboard 组件内新增：
```tsx
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p) => p.status === "active" || p.status === "planning");
  const avgProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((s, p) => s + p.progress, 0) / activeProjects.length)
    : 0;
```

4. 在 grid 中插入一个新的 `DashboardCard`（建议放在"待办事项"之后）：
```tsx
        <DashboardCard title="项目管理" icon={Kanban} onClick={() => navigate("/projects")}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{activeProjects.length} 个活跃项目</span>
              <span className="text-muted-foreground">{avgProgress}%</span>
            </div>
            <Progress value={avgProgress} className="h-2" />
          </div>
        </DashboardCard>
```

- [ ] **步骤 4：运行类型检查**

运行：`cd ~/Projects/v-life && npx tsc --noEmit`

预期：无错误。

- [ ] **步骤 5：Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx src/pages/Index.tsx
git commit -m "feat(nav): integrate projects route, sidebar and dashboard card"
```

---

## 任务 9：功能验证

- [ ] **步骤 1：启动开发服务器**

运行：`cd ~/Projects/v-life && npm run dev`

验证：
1. 侧边栏出现"项目管理"
2. 首页 Dashboard 出现"项目管理"卡片
3. 点击后进入 `/projects` 页面
4. 左侧项目列表正常显示（若 Supabase 已同步则显示空列表，否则 Toast 报错属正常）

- [ ] **步骤 2：创建第一个项目**

在项目管理页面点击"新建项目"，填写名称后保存。
验证：项目出现在左侧列表，右侧显示该项目的空看板。

- [ ] **步骤 3：创建任务并拖拽**

在看板任一列底部点击"添加"，创建一个任务。
验证：任务卡片出现在对应列，可以拖拽到其他列，拖拽到"已完成"后项目进度自动更新。

- [ ] **步骤 4：创建习惯并打卡**

创建一个习惯工作项，卡片上显示进度环，点击"今日打卡"后状态切换，进度环刷新。

- [ ] **步骤 5：响应式检查**

缩小浏览器窗口到手机宽度，确认布局不崩溃（左侧列表可能需要后续 Drawer 优化，V1 先保证不溢出即可）。

- [ ] **步骤 6：最终 Commit**

```bash
git add .
git commit -m "feat(projects): complete project management kanban board"
```

---

## 自检结果

**1. 规格覆盖度：**
- 左右分屏布局 ✅（任务 7）
- 5 列看板 ✅（任务 6）
- 任务/习惯/里程碑 3 种卡片 ✅（任务 4）
- 习惯打卡 + 进度环 + 连击 ✅（任务 4）
- 权重进度计算 ✅（任务 6）
- Supabase 5 张表 + RLS ✅（任务 1）
- 拖拽支持 ✅（任务 6）
- 路由导航集成 ✅（任务 8）

**2. 占位符扫描：**
- 无"待定"、"TODO"、"后续实现"等占位符
- 所有代码步骤均包含完整代码块
- 所有导入路径精确

**3. 类型一致性：**
- `project_tasks` 表中的 `status` 枚举与 `COLUMNS` 数组一致（`todo`, `this_week`, `in_progress`, `waiting`, `done`）
- hooks 签名在定义处与调用处一致
- `useCreateProjectTask` 在任务 2 中定义，任务 6 中使用，签名一致

---

## 执行选项

计划已完成并保存到 `docs/superpowers/plans/2026-04-16-project-management.md`。

**两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 `executing-plans` 执行任务，批量执行并设有检查点

**选哪种方式？**
