-- ============================================
-- 考公板块第一期
-- ============================================

-- settings: focus mode
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS app_focus_mode TEXT NOT NULL DEFAULT 'full';

-- 1. civil_exams
CREATE TABLE IF NOT EXISTS public.civil_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  exam_type TEXT NOT NULL DEFAULT '自定义',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_civil_exams_user_id ON public.civil_exams (user_id);
CREATE INDEX IF NOT EXISTS idx_civil_exams_exam_date ON public.civil_exams (exam_date);

CREATE TRIGGER update_civil_exams_updated_at
  BEFORE UPDATE ON public.civil_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.civil_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civil_exams_select_own" ON public.civil_exams
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "civil_exams_insert_own" ON public.civil_exams
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "civil_exams_update_own" ON public.civil_exams
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "civil_exams_delete_own" ON public.civil_exams
  FOR DELETE USING (auth.uid() = user_id);

-- 2. civil_plan_items
CREATE TABLE IF NOT EXISTS public.civil_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  plan_date DATE NOT NULL,
  subject_group TEXT NOT NULL DEFAULT 'general',
  subject_tag TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'plan',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  synced_schedule_id UUID,
  synced_todo_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_civil_plan_items_user_id ON public.civil_plan_items (user_id);
CREATE INDEX IF NOT EXISTS idx_civil_plan_items_plan_date ON public.civil_plan_items (plan_date);
CREATE INDEX IF NOT EXISTS idx_civil_plan_items_subject_group ON public.civil_plan_items (subject_group);

CREATE TRIGGER update_civil_plan_items_updated_at
  BEFORE UPDATE ON public.civil_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.civil_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civil_plan_items_select_own" ON public.civil_plan_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "civil_plan_items_insert_own" ON public.civil_plan_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "civil_plan_items_update_own" ON public.civil_plan_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "civil_plan_items_delete_own" ON public.civil_plan_items
  FOR DELETE USING (auth.uid() = user_id);

-- 3. civil_checkins
CREATE TABLE IF NOT EXISTS public.civil_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  studied_minutes INT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_civil_checkins_user_id ON public.civil_checkins (user_id);
CREATE INDEX IF NOT EXISTS idx_civil_checkins_date ON public.civil_checkins (date);

CREATE TRIGGER update_civil_checkins_updated_at
  BEFORE UPDATE ON public.civil_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.civil_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civil_checkins_select_own" ON public.civil_checkins
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "civil_checkins_insert_own" ON public.civil_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "civil_checkins_update_own" ON public.civil_checkins
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "civil_checkins_delete_own" ON public.civil_checkins
  FOR DELETE USING (auth.uid() = user_id);

-- 4. civil_wrong_answers
CREATE TABLE IF NOT EXISTS public.civil_wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  subject_group TEXT NOT NULL,
  subject_tag TEXT,
  title TEXT NOT NULL,
  content TEXT,
  wrong_reason TEXT,
  knowledge_point TEXT,
  image_url TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending',
  source_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_draft_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_civil_wrong_answers_user_id ON public.civil_wrong_answers (user_id);
CREATE INDEX IF NOT EXISTS idx_civil_wrong_answers_subject_group ON public.civil_wrong_answers (subject_group);
CREATE INDEX IF NOT EXISTS idx_civil_wrong_answers_source_date ON public.civil_wrong_answers (source_date);
CREATE INDEX IF NOT EXISTS idx_civil_wrong_answers_review_status ON public.civil_wrong_answers (review_status);

CREATE TRIGGER update_civil_wrong_answers_updated_at
  BEFORE UPDATE ON public.civil_wrong_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.civil_wrong_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civil_wrong_answers_select_own" ON public.civil_wrong_answers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "civil_wrong_answers_insert_own" ON public.civil_wrong_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "civil_wrong_answers_update_own" ON public.civil_wrong_answers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "civil_wrong_answers_delete_own" ON public.civil_wrong_answers
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for wrong-answer images
INSERT INTO storage.buckets (id, name, public)
VALUES ('civil-wrong', 'civil-wrong', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "civil_wrong_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'civil-wrong'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "civil_wrong_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'civil-wrong'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "civil_wrong_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'civil-wrong'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "civil_wrong_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'civil-wrong');
