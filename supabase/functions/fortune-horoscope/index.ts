import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  adminClient,
  countForDate,
  HOROSCOPE_SIGNS,
  ingestHoroscopeDay,
  shanghaiDate,
} from "../_shared/horoscopeDaily.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGN_SET = new Set<string>(HOROSCOPE_SIGNS);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sign = String(body.sign || "").toLowerCase();
    const lang = String(body.lang || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
    const cacheDate = String(body.date || shanghaiDate());

    if (!SIGN_SET.has(sign)) {
      return new Response(JSON.stringify({ error: "invalid sign" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = adminClient();
    let { data: row, error } = await sb
      .from("fortune_horoscope_daily")
      .select("*")
      .eq("cache_date", cacheDate)
      .eq("sign", sign)
      .maybeSingle();
    if (error) throw error;

    // First visitor of the day (or incomplete cache): site pulls all 12 once and stores.
    if (!row || (lang === "zh" && !String(row.text_zh || "").trim())) {
      const n = await countForDate(cacheDate);
      if (n < 12 || (row && lang === "zh" && !String(row.text_zh || "").trim())) {
        await ingestHoroscopeDay(cacheDate);
        const again = await sb
          .from("fortune_horoscope_daily")
          .select("*")
          .eq("cache_date", cacheDate)
          .eq("sign", sign)
          .maybeSingle();
        if (again.error) throw again.error;
        row = again.data;
      }
    }

    if (!row) {
      return new Response(JSON.stringify({ error: "horoscope not ready", date: cacheDate, sign }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textEn = String(row.text_en || "").trim();
    const textZh = String(row.text_zh || "").trim();
    const text = lang === "zh" ? textZh || textEn : textEn;
    if (!text) {
      return new Response(JSON.stringify({ error: "empty horoscope row" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stars = (row.stars || {}) as Record<string, number>;
    const payload = {
      sign,
      date: cacheDate,
      lang,
      text,
      text_en: textEn,
      text_zh: textZh,
      translated: Boolean(textZh),
      stars: {
        overall: Number(stars.overall) || 3,
        love: Number(stars.love) || Number(stars.overall) || 3,
        career: Number(stars.career) || Number(stars.overall) || 3,
        wealth: Number(stars.wealth) || Number(stars.overall) || 3,
      },
      source: String(row.source || "ohmanda.com/api/horoscope"),
      cached: true,
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
