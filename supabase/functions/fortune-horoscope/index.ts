import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNS = new Set([
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
]);

/** FNV-1a → stars 1–5, stable per sign+date+text */
function starsFromText(sign: string, date: string, text: string): number {
  const input = `${sign}|${date}|${text}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 5 + 1;
}

function dimStars(overall: number, salt: string, sign: string, date: string, text: string): number {
  const n = starsFromText(sign, date, `${salt}:${text}`);
  const raw = overall * 0.7 + n * 0.3;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sign = String(body.sign || "").toLowerCase();
    if (!SIGNS.has(sign)) {
      return new Response(JSON.stringify({ error: "invalid sign" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(`https://ohmanda.com/api/horoscope/${sign}/`, {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `upstream ${upstream.status}`, source: "ohmanda.com" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const data = await upstream.json();
    const text = String(data.horoscope || data.description || "").trim();
    const date = String(data.date || new Date().toISOString().slice(0, 10));
    if (!text) {
      return new Response(JSON.stringify({ error: "empty horoscope", source: "ohmanda.com" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overall = starsFromText(sign, date, text);
    const payload = {
      sign,
      date,
      text,
      stars: {
        overall,
        love: dimStars(overall, "love", sign, date, text),
        career: dimStars(overall, "career", sign, date, text),
        wealth: dimStars(overall, "wealth", sign, date, text),
      },
      source: "ohmanda.com/api/horoscope",
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
