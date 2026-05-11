-- ============================================
-- 学习笔记模块表结构
-- ============================================

-- 1. learning_courses 表
CREATE TABLE IF NOT EXISTS public.learning_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#5b88b5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. learning_notes 表
CREATE TABLE IF NOT EXISTS public.learning_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.learning_courses ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  note_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_learning_courses_user_id ON public.learning_courses (user_id);
CREATE INDEX IF NOT EXISTS idx_learning_notes_course_id ON public.learning_notes (course_id);
CREATE INDEX IF NOT EXISTS idx_learning_notes_note_date ON public.learning_notes (note_date);
CREATE INDEX IF NOT EXISTS idx_learning_notes_tags ON public.learning_notes USING GIN(tags);

-- 更新时间触发器
CREATE TRIGGER update_learning_courses_updated_at
  BEFORE UPDATE ON public.learning_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_notes_updated_at
  BEFORE UPDATE ON public.learning_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS 启用
ALTER TABLE public.learning_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_notes ENABLE ROW LEVEL SECURITY;

-- learning_courses RLS
CREATE POLICY "learning_courses_select_own" ON public.learning_courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "learning_courses_insert_own" ON public.learning_courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learning_courses_update_own" ON public.learning_courses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "learning_courses_delete_own" ON public.learning_courses
  FOR DELETE USING (auth.uid() = user_id);

-- learning_notes RLS
CREATE POLICY "learning_notes_select_own" ON public.learning_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.learning_courses
      WHERE id = learning_notes.course_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "learning_notes_insert_own" ON public.learning_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_courses
      WHERE id = learning_notes.course_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "learning_notes_update_own" ON public.learning_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.learning_courses
      WHERE id = learning_notes.course_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "learning_notes_delete_own" ON public.learning_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.learning_courses
      WHERE id = learning_notes.course_id AND user_id = auth.uid()
    )
  );
