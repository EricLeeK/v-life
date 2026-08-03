import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ingestHoroscopeDay, shanghaiDate } from "../_shared/horoscopeDaily.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-fortune-ingest-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function authorized(req: Request): boolean {
  const secret = Deno.env.get("FORTUNE_INGEST_SECRET") || "";
  const headerSecret = req.headers.get("x-fortune-ingest-secret") || "";
  if (secret && headerSecret && headerSecret === secret) return true;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (serviceKey && token && token === serviceKey) return true;

  // Personal project fallback: allow if secret unset and caller has any Authorization (anon/user)
  if (!secret && auth) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!authorized(req)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const date = String(body.date || shanghaiDate());
    const result = await ingestHoroscopeDay(date);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
