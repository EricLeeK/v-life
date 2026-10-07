-- Keep the existing deadline column as the end of the selected target range.
-- Legacy projects without a start remain single-date targets.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS target_start_date DATE;
ALTER TABLE public.projects ADD CONSTRAINT projects_target_date_range_check
  CHECK (target_start_date IS NULL OR (target_date IS NOT NULL AND target_start_date <= target_date));
