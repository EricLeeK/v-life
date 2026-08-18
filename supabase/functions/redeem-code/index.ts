// User-facing redemption endpoint for hosted-AI membership codes (月卡/年卡).
// Authenticates the caller's JWT, then runs the atomic redeem_ai_code RPC
// with the service-role client (the RPC is not executable by clients).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError } from "../_shared/hostedAi.ts";
import { normalizeRedemptionCode, sha256Hex } from "../_shared/redemptionCode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ERROR_MESSAGES: Record<string, string> = {
  CODE_NOT_FOUND: "兑换码不存在，请检查输入",
  CODE_ALREADY_REDEEMED: "兑换码已被使用",
  CODE_DISABLED: "兑换码已失效",
  ACCOUNT_DISABLED: "当前账号无法开通会员，请联系管理员",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    const normalized = normalizeRedemptionCode(String(code ?? ""));
    if (!/^[A-Z0-9]{10,64}$/.test(normalized)) {
      return jsonError("CODE_INVALID", "兑换码格式不正确", 400, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userJwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const userSb = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) {
      return jsonError("UNAUTHORIZED", "未授权，请先登录", 401, corsHeaders);
    }

    const codeHash = await sha256Hex(normalized);
    const adminSb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await adminSb.rpc("redeem_ai_code", {
      p_code_hash: codeHash,
      p_user_id: user.id,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      const errCode = String(row?.error || "REDEEM_FAILED");
      return jsonError(errCode, ERROR_MESSAGES[errCode] || "兑换失败", 400, corsHeaders);
    }

    return new Response(
      JSON.stringify({ ok: true, plan: row.plan, expires_at: row.expires_at }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("redeem-code error:", e);
    return jsonError(
      "REDEEM_ERROR",
      e instanceof Error ? e.message : "兑换失败",
      500,
      corsHeaders,
    );
  }
});
