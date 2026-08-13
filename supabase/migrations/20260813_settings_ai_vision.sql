ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS day_start_hour integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_vision_api_key text,
  ADD COLUMN IF NOT EXISTS ai_vision_base_url text,
  ADD COLUMN IF NOT EXISTS ai_vision_model text DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS ai_vision_platform text DEFAULT 'gemini';
