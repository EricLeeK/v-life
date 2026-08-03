-- Hosted AI entitlements + usage (phase 1)

CREATE TABLE IF NOT EXISTS public.ai_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  monthly_token_limit INTEGER NOT NULL DEFAULT 1000000,
  daily_request_limit INTEGER NOT NULL DEFAULT 50,
  per_minute_limit INTEGER NOT NULL DEFAULT 10,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'hosted' CHECK (source IN ('hosted')),
  function_name TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  token_estimate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_created_idx
  ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_idx
  ON public.ai_usage_logs (created_at DESC);

ALTER TABLE public.ai_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ai_entitlements"
  ON public.ai_entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_ai_entitlements_updated_at ON public.ai_entitlements;
CREATE TRIGGER update_ai_entitlements_updated_at
  BEFORE UPDATE ON public.ai_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
