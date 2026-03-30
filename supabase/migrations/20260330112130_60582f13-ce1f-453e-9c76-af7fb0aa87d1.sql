
-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ Settings ============
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  exchange_rate_jpy_to_cny NUMERIC DEFAULT 0.048,
  exchange_rate_updated_at TIMESTAMPTZ,
  monthly_budget NUMERIC DEFAULT 5000,
  calorie_target INTEGER DEFAULT 2000,
  custom_thought_tags JSONB DEFAULT '[]'::jsonb,
  ai_platform TEXT DEFAULT 'gemini',
  ai_api_key TEXT,
  ai_model TEXT DEFAULT 'gemini-2.5-flash',
  ai_base_url TEXT,
  ai_mode TEXT DEFAULT 'confirm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert settings" ON public.settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.settings FOR UPDATE USING (true);
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Pantry Items ============
CREATE TABLE public.pantry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('新鲜食材','零食','调料','主食/干货','饮品','冷冻食品')),
  quantity TEXT,
  purchase_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD pantry_items" ON public.pantry_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_pantry_items_updated_at BEFORE UPDATE ON public.pantry_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Belongings Daily ============
CREATE TABLE public.belongings_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purchase_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.belongings_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD belongings_daily" ON public.belongings_daily FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_belongings_daily_updated_at BEFORE UPDATE ON public.belongings_daily FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Belongings Durable ============
CREATE TABLE public.belongings_durable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('电子产品','家电','家具','交通工具','其他')),
  purchase_price NUMERIC NOT NULL,
  purchase_date DATE NOT NULL,
  expected_lifespan_days INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.belongings_durable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD belongings_durable" ON public.belongings_durable FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_belongings_durable_updated_at BEFORE UPDATE ON public.belongings_durable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Schedule Events ============
CREATE TABLE public.schedule_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT,
  importance TEXT DEFAULT '普通' CHECK (importance IN ('紧急','重要','普通','低')),
  status TEXT NOT NULL DEFAULT '未开始' CHECK (status IN ('未开始','进行中','已完成','已取消')),
  notes TEXT,
  recurrence JSONB,
  parent_event_id UUID REFERENCES public.schedule_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD schedule_events" ON public.schedule_events FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON public.schedule_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Calorie Records ============
CREATE TABLE public.calorie_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  food_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calorie_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD calorie_records" ON public.calorie_records FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_calorie_records_updated_at BEFORE UPDATE ON public.calorie_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Finance Records ============
CREATE TABLE public.finance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  date DATE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('餐饮','日用','交通','住房','通讯/订阅','医疗','服饰','娱乐','学习','电子','大额','其他')),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency IN ('CNY','JPY')),
  amount_cny NUMERIC NOT NULL,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD finance_records" ON public.finance_records FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_finance_records_updated_at BEFORE UPDATE ON public.finance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Todos ============
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL,
  detail TEXT,
  importance TEXT NOT NULL DEFAULT '普通' CHECK (importance IN ('紧急','重要','普通','低优先')),
  category TEXT NOT NULL DEFAULT '未分类',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD todos" ON public.todos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Thoughts ============
CREATE TABLE public.thoughts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.thoughts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD thoughts" ON public.thoughts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_thoughts_updated_at BEFORE UPDATE ON public.thoughts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AI Sessions ============
CREATE TABLE public.ai_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD ai_sessions" ON public.ai_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_ai_sessions_updated_at BEFORE UPDATE ON public.ai_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AI Messages ============
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  images TEXT[],
  actions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can CRUD ai_messages" ON public.ai_messages FOR ALL USING (true) WITH CHECK (true);

-- ============ Indexes ============
CREATE INDEX idx_pantry_category ON public.pantry_items(category);
CREATE INDEX idx_pantry_expiry ON public.pantry_items(expiry_date);
CREATE INDEX idx_calorie_date ON public.calorie_records(date);
CREATE INDEX idx_finance_date ON public.finance_records(date);
CREATE INDEX idx_finance_category ON public.finance_records(category);
CREATE INDEX idx_todos_importance ON public.todos(importance);
CREATE INDEX idx_todos_completed ON public.todos(is_completed);
CREATE INDEX idx_thoughts_tags ON public.thoughts USING GIN(tags);
CREATE INDEX idx_schedule_start ON public.schedule_events(start_time);
CREATE INDEX idx_ai_messages_session ON public.ai_messages(session_id);

-- ============ Insert default settings ============
INSERT INTO public.settings (id) VALUES (gen_random_uuid());
