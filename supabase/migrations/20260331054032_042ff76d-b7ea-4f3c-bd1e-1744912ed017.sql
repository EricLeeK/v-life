
-- Create goals table
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  type text NOT NULL,
  period_start date NOT NULL,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can CRUD goals" ON public.goals FOR ALL TO public USING (true) WITH CHECK (true);

-- Add show_goals_in_schedule to settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS show_goals_in_schedule boolean DEFAULT true;
