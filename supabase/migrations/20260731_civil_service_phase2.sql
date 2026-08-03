-- ============================================
-- 考公板块第二期：行测套卷 + 错题复习队列
-- ============================================

-- 1. civil_xingce_papers
CREATE TABLE IF NOT EXISTS public.civil_xingce_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  taken_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  is_mock BOOLEAN NOT NULL DEFAULT false,
  verbal_total INT NOT NULL DEFAULT 0,
  verbal_correct INT NOT NULL DEFAULT 0,
  data_total INT NOT NULL DEFAULT 0,
  data_correct INT NOT NULL DEFAULT 0,
  graphic_total INT NOT NULL DEFAULT 0,
  graphic_correct INT NOT NULL DEFAULT 0,
  logic_total INT NOT NULL DEFAULT 0,
  logic_correct INT NOT NULL DEFAULT 0,
  analogy_total INT NOT NULL DEFAULT 0,
  analogy_correct INT NOT NULL DEFAULT 0,
  quantity_total INT NOT NULL DEFAULT 0,
  quantity_correct INT NOT NULL DEFAULT 0,
  common_total INT NOT NULL DEFAULT 0,
  common_correct INT NOT NULL DEFAULT 0,
  duration_minutes INT,
  total_score NUMERIC,
  beat_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_civil_xingce_papers_user_id ON public.civil_xingce_papers (user_id);
CREATE INDEX IF NOT EXISTS idx_civil_xingce_papers_taken_date ON public.civil_xingce_papers (taken_date);

CREATE TRIGGER update_civil_xingce_papers_updated_at
  BEFORE UPDATE ON public.civil_xingce_papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.civil_xingce_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civil_xingce_papers_select_own" ON public.civil_xingce_papers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "civil_xingce_papers_insert_own" ON public.civil_xingce_papers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "civil_xingce_papers_update_own" ON public.civil_xingce_papers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "civil_xingce_papers_delete_own" ON public.civil_xingce_papers
  FOR DELETE USING (auth.uid() = user_id);

-- 2. wrong answers review queue fields
ALTER TABLE public.civil_wrong_answers
  ADD COLUMN IF NOT EXISTS next_review_date DATE,
  ADD COLUMN IF NOT EXISTS review_interval_days INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_civil_wrong_answers_next_review
  ON public.civil_wrong_answers (next_review_date);
