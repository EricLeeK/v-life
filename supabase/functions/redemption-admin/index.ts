// Owner-only batch management for redemption codes: generate / disable / list.
// Deployed with --no-verify-jwt; access is controlled by the x-admin-key
// header checked against the ADMIN_API_KEY secret. Plaintext codes are
// returned by "generate" exactly once — the DB only stores SHA-256 hashes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateRedemptionCode,
  normalizeRedemptionCode,
  prefixOf,
  sha256Hex,
} from "../_shared/redemptionCode.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function keyMatches(provided: string, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  const adminKey = Deno.env.get("ADMIN_API_KEY");
  if (!adminKey) {
    return json({ error: "admin key not configured" }, 500);
  }
  if (!keyMatches(req.headers.get("x-admin-key") ?? "", adminKey)) {
    return json({ error: "invalid admin key" }, 401);
  }

  try {
    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const url = new URL(req.url);

    if (req.method === "POST") {
      const { action, plan, count, note, batch_id } = await req.json();

      if (action === "generate") {
        if (plan !== "monthly" && plan !== "yearly") {
          return json({ error: "plan must be 'monthly' or 'yearly'" }, 400);
        }
        const n = Math.floor(Number(count) || 1);
        if (n < 1 || n > 500) {
          return json({ error: "count must be 1..500" }, 400);
        }
        const newBatchId = crypto.randomUUID();
        const codes: string[] = [];
        const rows: Record<string, unknown>[] = [];
        for (let i = 0; i < n; i++) {
          const code = generateRedemptionCode();
          codes.push(code);
          rows.push({
            code_hash: await sha256Hex(normalizeRedemptionCode(code)),
            code_prefix: prefixOf(code),
            plan,
            note: note ?? null,
            batch_id: newBatchId,
          });
        }
        const { error } = await adminSb.from("redemption_codes").insert(rows);
        if (error) throw error;
        return json({ batch_id: newBatchId, plan, count: codes.length, codes });
      }

      if (action === "disable") {
        if (!batch_id) {
          return json({ error: "batch_id required" }, 400);
        }
        const { data, error } = await adminSb
          .from("redemption_codes")
          .update({ status: "disabled" })
          .eq("batch_id", batch_id)
          .eq("status", "unused")
          .select("id");
        if (error) throw error;
        return json({ batch_id, disabled: (data ?? []).length });
      }

      return json({ error: "unknown action; use generate|disable" }, 400);
    }

    if (req.method === "GET") {
      let q = adminSb
        .from("redemption_codes")
        .select(
          "id, code_prefix, plan, note, batch_id, status, redeemed_by, redeemed_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const batch = url.searchParams.get("batch_id");
      if (batch) q = q.eq("batch_id", batch);
      const { data, error } = await q;
      if (error) throw error;
      return json({ codes: data ?? [] });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    console.error("redemption-admin error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
