
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Tokyo',
ADD COLUMN IF NOT EXISTS fasting_start_hour integer DEFAULT 12;
