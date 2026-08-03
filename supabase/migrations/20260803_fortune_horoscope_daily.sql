-- Fortune hub: shared daily horoscope cache (12 signs × date) + optional cron helpers
-- Applied remotely as fortune_horoscope_daily; keep this file for repo history.

CREATE TABLE IF NOT EXISTS public.fortune_horoscope_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_date date NOT NULL,
  sign text NOT NULL,
  text_en text NOT NULL DEFAULT '',
  text_zh text NOT NULL DEFAULT '',
  stars jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'ohmanda.com/api/horoscope',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cache_date, sign)
);

CREATE INDEX IF NOT EXISTS fortune_horoscope_daily_date_idx
  ON public.fortune_horoscope_daily (cache_date DESC);

ALTER TABLE public.fortune_horoscope_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fortune_horoscope_daily_select_all" ON public.fortune_horoscope_daily;
CREATE POLICY "fortune_horoscope_daily_select_all" ON public.fortune_horoscope_daily
  FOR SELECT TO anon, authenticated USING (true);
