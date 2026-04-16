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
