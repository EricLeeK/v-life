-- Redemption-code membership for hosted AI (月卡/年卡).
-- Codes are stored as SHA-256 hashes only (the edge function hashes before
-- calling); code_prefix is kept for support lookups ("码开头是 VL3K9…").

CREATE TABLE IF NOT EXISTS public.redemption_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  code_prefix TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  note TEXT,
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'redeemed', 'disabled')),
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redemption_codes_batch_idx ON public.redemption_codes (batch_id);
CREATE INDEX IF NOT EXISTS redemption_codes_status_idx ON public.redemption_codes (status);

ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role (edge functions) reads/writes.

-- Atomic redeem: lock the code row, validate it, extend the entitlement from
-- max(current expiry, now), then mark the code used — all in one transaction.
CREATE OR REPLACE FUNCTION public.redeem_ai_code(p_code_hash TEXT, p_user_id UUID)
RETURNS TABLE (ok BOOLEAN, error TEXT, plan TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.redemption_codes%ROWTYPE;
  v_existing public.ai_entitlements%ROWTYPE;
  v_days INT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'USER_REQUIRED'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_code FROM public.redemption_codes
   WHERE code_hash = p_code_hash FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'CODE_NOT_FOUND'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_code.status = 'redeemed' THEN
    RETURN QUERY SELECT FALSE, 'CODE_ALREADY_REDEEMED'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_code.status = 'disabled' THEN
    RETURN QUERY SELECT FALSE, 'CODE_DISABLED'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_existing FROM public.ai_entitlements WHERE user_id = p_user_id FOR UPDATE;
  IF FOUND AND v_existing.status = 'disabled' THEN
    RETURN QUERY SELECT FALSE, 'ACCOUNT_DISABLED'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_days := CASE v_code.plan WHEN 'monthly' THEN 30 WHEN 'yearly' THEN 365 END;

  INSERT INTO public.ai_entitlements (user_id, status, expires_at)
  VALUES (p_user_id, 'active', now() + make_interval(days => v_days))
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    expires_at = greatest(coalesce(public.ai_entitlements.expires_at, now()), now())
                 + make_interval(days => v_days),
    updated_at = now();

  UPDATE public.redemption_codes
     SET status = 'redeemed', redeemed_by = p_user_id, redeemed_at = now()
   WHERE id = v_code.id;

  RETURN QUERY
    SELECT TRUE, NULL::TEXT, v_code.plan, e.expires_at
      FROM public.ai_entitlements e
     WHERE e.user_id = p_user_id;
END;
$$;

-- Supabase grants EXECUTE to anon/authenticated via default privileges (not
-- via PUBLIC), so both must be revoked explicitly — service_role only.
REVOKE ALL ON FUNCTION public.redeem_ai_code(TEXT, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.redeem_ai_code(TEXT, UUID) TO service_role;

-- Switch to the paid model: every legacy grant ends now; going forward only
-- redemption codes (re)activate hosted AI.
UPDATE public.ai_entitlements
   SET expires_at = now(), updated_at = now()
 WHERE expires_at IS NULL OR expires_at > now();
