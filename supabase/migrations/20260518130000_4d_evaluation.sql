-- 4D Evaluation: add metadata column to daily_tasks for storing AI-evaluated scores

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update the estimate-difficulty edge function prompt reference:
-- The edge function should now return:
-- {
--   "cognitive_level": 1-5,
--   "willpower_level": 1-5,
--   "duration_level": 1-5,
--   "impact_level": 1-5,
--   "awarded_xp": number,
--   "attribute_tags": string[],
--   "ai_encouragement": string
-- }
