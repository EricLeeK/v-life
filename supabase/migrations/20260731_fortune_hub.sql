-- Fortune hub: profile on settings + daily cache + readings history

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS fortune_profile jsonb DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.fortune_daily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_date)
);

CREATE TABLE IF NOT EXISTS public.fortune_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  question text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reading text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fortune_readings_user_created_idx
  ON public.fortune_readings (user_id, created_at DESC);

ALTER TABLE public.fortune_daily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortune_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fortune_daily_cache_select_own" ON public.fortune_daily_cache
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fortune_daily_cache_insert_own" ON public.fortune_daily_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fortune_daily_cache_update_own" ON public.fortune_daily_cache
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fortune_daily_cache_delete_own" ON public.fortune_daily_cache
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "fortune_readings_select_own" ON public.fortune_readings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fortune_readings_insert_own" ON public.fortune_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fortune_readings_update_own" ON public.fortune_readings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fortune_readings_delete_own" ON public.fortune_readings
  FOR DELETE USING (auth.uid() = user_id);
