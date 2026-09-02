ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS habit_type TEXT,
  ADD COLUMN IF NOT EXISTS habit_target NUMERIC,
  ADD COLUMN IF NOT EXISTS habit_unit TEXT,
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_kind_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_kind_check
  CHECK (kind IN ('once', 'routine', 'habit'));

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_habit_type_check;
ALTER TABLE public.todos ADD CONSTRAINT todos_habit_type_check
  CHECK (habit_type IS NULL OR habit_type IN ('checkin', 'count', 'duration', 'avoidance'));

CREATE TABLE IF NOT EXISTS public.todo_habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  todo_id UUID REFERENCES public.todos(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL,
  value NUMERIC,
  broken BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (todo_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_todo_habit_logs_user_id ON public.todo_habit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_todo_habit_logs_todo_id ON public.todo_habit_logs (todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_habit_logs_log_date ON public.todo_habit_logs (log_date);

DROP TRIGGER IF EXISTS update_todo_habit_logs_updated_at ON public.todo_habit_logs;
CREATE TRIGGER update_todo_habit_logs_updated_at
  BEFORE UPDATE ON public.todo_habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.todo_habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todo_habit_logs_select_own" ON public.todo_habit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "todo_habit_logs_insert_own" ON public.todo_habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "todo_habit_logs_update_own" ON public.todo_habit_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "todo_habit_logs_delete_own" ON public.todo_habit_logs
  FOR DELETE USING (auth.uid() = user_id);
