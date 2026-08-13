import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHostedConfig } from "./hostedAi.ts";

export const HOROSCOPE_SIGNS = [
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
] as const;

export type HoroscopeSign = (typeof HOROSCOPE_SIGNS)[number];

export function shanghaiDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function starsFromText(sign: string, date: string, text: string): number {
  const input = `${sign}|${date}|${text}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 5 + 1;
}

export function dimStars(
  overall: number,
  salt: string,
  sign: string,
  date: string,
  text: string,
): number {
  const n = starsFromText(sign, date, `${salt}:${text}`);
  const raw = overall * 0.7 + n * 0.3;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

export function buildStars(sign: string, date: string, text: string) {
  const overall = starsFromText(sign, date, text);
  return {
    overall,
    love: dimStars(overall, "love", sign, date, text),
    career: dimStars(overall, "career", sign, date, text),
    wealth: dimStars(overall, "wealth", sign, date, text),
  };
}

export async function fetchOhmanda(sign: string): Promise<{ date: string; text: string }> {
  const upstream = await fetch(`https://ohmanda.com/api/horoscope/${sign}/`, {
    headers: { Accept: "application/json" },
  });
  if (!upstream.ok) throw new Error(`ohmanda ${sign}: ${upstream.status}`);
  const data = await upstream.json();
  const text = String(data.horoscope || data.description || "").trim();
  if (!text) throw new Error(`ohmanda ${sign}: empty`);
  const date = String(data.date || shanghaiDate());
  return { date, text };
}

function getTranslateConfig() {
  const text = getHostedConfig(false);
  if (text.apiKey) return { apiKey: text.apiKey, model: text.model, baseUrl: text.baseUrl };
  const vision = getHostedConfig(true);
  return { apiKey: vision.apiKey, model: vision.model, baseUrl: vision.baseUrl };
}

/** Translate EN horoscope map → ZH map via hosted AI. Falls back to empty zh on failure. */
export async function translateHoroscopesZh(
  items: Array<{ sign: string; text: string }>,
): Promise<Record<string, string>> {
  const { apiKey, model, baseUrl } = getTranslateConfig();
  if (!apiKey || items.length === 0) return {};

  const payload = Object.fromEntries(items.map((i) => [i.sign, i.text]));
  const system =
    "你是翻译器。把 JSON 里每个星座的英文日运译成自然流畅的简体中文。只输出 JSON 对象，key 与输入相同，value 为中文译文。不要 markdown。";
  const user = JSON.stringify(payload);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("translateHoroscopesZh upstream", res.status, await res.text());
      return {};
    }
    const json = await res.json();
    let content = String(json.choices?.[0]?.message?.content || "").trim();
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(content) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const { sign } of items) {
      const zh = String(parsed[sign] || "").trim();
      if (zh) out[sign] = zh;
    }
    return out;
  } catch (e) {
    console.error("translateHoroscopesZh", e);
    return {};
  }
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export async function countForDate(cacheDate: string): Promise<number> {
  const sb = adminClient();
  const { count, error } = await sb
    .from("fortune_horoscope_daily")
    .select("id", { count: "exact", head: true })
    .eq("cache_date", cacheDate);
  if (error) throw error;
  return count ?? 0;
}

export async function ingestHoroscopeDay(cacheDate = shanghaiDate()): Promise<{
  date: string;
  upserted: number;
  translated: number;
}> {
  const fetched: Array<{ sign: string; text: string; apiDate: string }> = [];
  for (const sign of HOROSCOPE_SIGNS) {
    const row = await fetchOhmanda(sign);
    fetched.push({ sign, text: row.text, apiDate: row.date });
    // gentle pacing for upstream
    await new Promise((r) => setTimeout(r, 120));
  }

  const zhMap = await translateHoroscopesZh(fetched.map((f) => ({ sign: f.sign, text: f.text })));
  const sb = adminClient();
  const rows = fetched.map((f) => ({
    cache_date: cacheDate,
    sign: f.sign,
    text_en: f.text,
    text_zh: zhMap[f.sign] || "",
    stars: buildStars(f.sign, cacheDate, f.text),
    source: "ohmanda.com/api/horoscope",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await sb.from("fortune_horoscope_daily").upsert(rows, {
    onConflict: "cache_date,sign",
  });
  if (error) throw error;

  return {
    date: cacheDate,
    upserted: rows.length,
    translated: Object.keys(zhMap).length,
  };
}
