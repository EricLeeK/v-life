
CREATE TABLE public.weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  date date NOT NULL,
  weight numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD weight_records" ON public.weight_records FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.measurement_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  date date NOT NULL,
  waist numeric,
  hip numeric,
  chest numeric,
  arm numeric,
  thigh numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.measurement_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD measurement_records" ON public.measurement_records FOR ALL TO public USING (true) WITH CHECK (true);
