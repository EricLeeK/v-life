-- Update user_id defaults from hardcoded UUID to auth.uid()
ALTER TABLE pantry_items ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE belongings_daily ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE belongings_durable ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE schedule_events ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE calorie_records ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE finance_records ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE todos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE thoughts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE goals ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE weight_records ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE measurement_records ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE settings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE ai_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Drop old permissive policies and create new ones for all business tables

-- pantry_items
DROP POLICY IF EXISTS "Anyone can CRUD pantry_items" ON pantry_items;
CREATE POLICY "Users can CRUD own pantry_items" ON pantry_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- belongings_daily
DROP POLICY IF EXISTS "Anyone can CRUD belongings_daily" ON belongings_daily;
CREATE POLICY "Users can CRUD own belongings_daily" ON belongings_daily FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- belongings_durable
DROP POLICY IF EXISTS "Anyone can CRUD belongings_durable" ON belongings_durable;
CREATE POLICY "Users can CRUD own belongings_durable" ON belongings_durable FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- schedule_events
DROP POLICY IF EXISTS "Anyone can CRUD schedule_events" ON schedule_events;
CREATE POLICY "Users can CRUD own schedule_events" ON schedule_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- calorie_records
DROP POLICY IF EXISTS "Anyone can CRUD calorie_records" ON calorie_records;
CREATE POLICY "Users can CRUD own calorie_records" ON calorie_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- finance_records
DROP POLICY IF EXISTS "Anyone can CRUD finance_records" ON finance_records;
CREATE POLICY "Users can CRUD own finance_records" ON finance_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- todos
DROP POLICY IF EXISTS "Anyone can CRUD todos" ON todos;
CREATE POLICY "Users can CRUD own todos" ON todos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- thoughts
DROP POLICY IF EXISTS "Anyone can CRUD thoughts" ON thoughts;
CREATE POLICY "Users can CRUD own thoughts" ON thoughts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- goals
DROP POLICY IF EXISTS "Anyone can CRUD goals" ON goals;
CREATE POLICY "Users can CRUD own goals" ON goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- weight_records
DROP POLICY IF EXISTS "Anyone can CRUD weight_records" ON weight_records;
CREATE POLICY "Users can CRUD own weight_records" ON weight_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- measurement_records
DROP POLICY IF EXISTS "Anyone can CRUD measurement_records" ON measurement_records;
CREATE POLICY "Users can CRUD own measurement_records" ON measurement_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- settings
DROP POLICY IF EXISTS "Anyone can insert settings" ON settings;
DROP POLICY IF EXISTS "Anyone can read settings" ON settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON settings;
CREATE POLICY "Users can read own settings" ON settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ai_sessions
DROP POLICY IF EXISTS "Anyone can CRUD ai_sessions" ON ai_sessions;
CREATE POLICY "Users can CRUD own ai_sessions" ON ai_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_messages: policy based on session ownership
DROP POLICY IF EXISTS "Anyone can CRUD ai_messages" ON ai_messages;
CREATE POLICY "Users can CRUD own ai_messages" ON ai_messages FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_sessions WHERE ai_sessions.id = ai_messages.session_id AND ai_sessions.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM ai_sessions WHERE ai_sessions.id = ai_messages.session_id AND ai_sessions.user_id = auth.uid())
);