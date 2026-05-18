-- Today's Todo: daily_tasks + user_points tables
-- daily_tasks: junction table linking todos to specific dates with difficulty/points
-- user_points: singleton per user storing gamification state

-- ============ daily_tasks ============

CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  todo_id UUID REFERENCES public.todos(id) ON DELETE CASCADE NOT NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  base_points INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(todo_id, task_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_id ON public.daily_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_task_date ON public.daily_tasks (task_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_todo_id ON public.daily_tasks (todo_id);

CREATE TRIGGER update_daily_tasks_updated_at
  BEFORE UPDATE ON public.daily_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_tasks_select_own" ON public.daily_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_tasks_insert_own" ON public.daily_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_tasks_update_own" ON public.daily_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "daily_tasks_delete_own" ON public.daily_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ============ user_points ============

CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users NOT NULL,
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points (user_id);

CREATE TRIGGER update_user_points_updated_at
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_points_select_own" ON public.user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_points_insert_own" ON public.user_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_points_update_own" ON public.user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_points_delete_own" ON public.user_points
  FOR DELETE USING (auth.uid() = user_id);
