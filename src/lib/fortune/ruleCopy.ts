import type { DailyScores, FortuneProfile } from "./types";
import { ZODIAC_LABELS } from "./zodiac";
import { SHENGXIAO_LABELS } from "./shengxiao";

function starsLine(n: number): string {
  return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}

export function buildDailyRuleCopy(input: {
  date: string;
  scores: DailyScores;
  profile: FortuneProfile | null;
  lang: "zh" | "en";
}): { headline: string; body: string; meta: string } {
  const { scores, profile, lang } = input;
  const hasProfile = Boolean(profile?.birth_date);
  const z = profile?.zodiac_sign ? ZODIAC_LABELS[profile.zodiac_sign] : null;
  const s = profile?.shengxiao ? SHENGXIAO_LABELS[profile.shengxiao] : null;

  if (lang === "en") {
    const meta = hasProfile
      ? `For you · ${z?.en || "—"} · ${s?.en || "—"}`
      : "Today · general vibe";
    const headline = `Overall ${starsLine(scores.overall)}`;
    const body = hasProfile
      ? `Keep a steady pace today. Finish one small thing and let ${z?.en || "your sign"} energy stay soft and clear.`
      : "A calm day works best. Pick one kind task for yourself and keep it light.";
    return { headline, body, meta };
  }

  const meta = hasProfile
    ? `专属今日 · ${z?.zh || "—"} · 属${s?.zh || "—"}`
    : "通用今日 · 可在设置补生日";
  const headline = `整体运势 ${starsLine(scores.overall)}`;
  const body = hasProfile
    ? `节奏稳一点会更顺。适合把一件小事做完，让${z?.zh || "今天"}的能量保持温柔清晰。`
    : "今天适合温和推进。给自己挑一件小事完成就好，轻松一点。";
  return { headline, body, meta };
}

export function dimensionStars(scores: DailyScores): Array<{ key: string; zh: string; en: string; value: number }> {
  return [
    { key: "love", zh: "爱情", en: "Love", value: scores.love },
    { key: "career", zh: "事业", en: "Career", value: scores.career },
    { key: "wealth", zh: "财运", en: "Wealth", value: scores.wealth },
  ];
}
