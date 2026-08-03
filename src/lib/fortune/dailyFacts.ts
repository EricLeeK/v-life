import type { AlmanacDay } from "./almanac";
import type { HoroscopeDay } from "./horoscope";
import type { MoonPhaseInfo } from "./moon";
import { scoresToPercents } from "./percentScore";
import { FORTUNE_RULE_VERSION } from "./ruleVersion";
import { shengxiaoRelationScore } from "./scores";
import { SHENGXIAO_LABELS } from "./shengxiao";
import type { DailyScores, FortuneProfile } from "./types";
import { ZODIAC_LABELS } from "./zodiac";
import { weekdayLabel, lunarLabelForDate } from "./lunarLabel";
import { dayPillarFromDate } from "./bazi";

/** Full daily context for fortune AI — zodiac + almanac + moon + profile. */
export function buildDailyFortuneFacts(input: {
  date: string;
  lang: "zh" | "en";
  scores: DailyScores;
  profile: FortuneProfile | null;
  almanac: AlmanacDay;
  moon: MoonPhaseInfo;
  horoscope: HoroscopeDay | null;
  ruleBody: string;
}): Record<string, unknown> {
  const { date, lang, scores, profile, almanac, moon, horoscope, ruleBody } = input;
  const pillar = dayPillarFromDate(date);
  const relation = shengxiaoRelationScore(profile?.shengxiao, pillar.zhiZh);
  const relationKind =
    relation < 0 ? "clash" : relation > 0 ? "harmony" : "neutral";
  const percents = scoresToPercents(
    scores,
    `${date}|${profile?.zodiac_sign || "g"}|${profile?.shengxiao || "g"}`,
  );

  return {
    date,
    weekday: weekdayLabel(date, lang),
    lunarLabel: lunarLabelForDate(date, lang),
    scores,
    percents,
    profile: profile?.birth_date
      ? {
          birth_date: profile.birth_date,
          birth_hour: profile.birth_hour ?? null,
          zodiac: profile.zodiac_sign
            ? {
                id: profile.zodiac_sign,
                label: lang === "zh"
                  ? ZODIAC_LABELS[profile.zodiac_sign].zh
                  : ZODIAC_LABELS[profile.zodiac_sign].en,
              }
            : null,
          shengxiao: profile.shengxiao
            ? {
                id: profile.shengxiao,
                label:
                  lang === "zh"
                    ? `属${SHENGXIAO_LABELS[profile.shengxiao].zh}`
                    : SHENGXIAO_LABELS[profile.shengxiao].en,
              }
            : null,
        }
      : null,
    shengxiaoVsToday: {
      relation: relationKind,
      dayBranch: pillar.zhiZh,
      dayPillar: pillar.label,
    },
    almanac: {
      dayPillar: almanac.dayPillar,
      zhiXing: almanac.zhiXing,
      chongsha: almanac.chongsha,
      yi: almanac.yi,
      ji: almanac.ji,
      pengZu: almanac.pengZu,
    },
    moon: {
      phase: lang === "zh" ? moon.phaseZh : moon.phaseEn,
      phaseKey: moon.phase,
      illumination: Math.round(moon.illumination * 100),
      blurb: lang === "zh" ? moon.blurbZh : moon.blurbEn,
      elongationDeg: Math.round(moon.elongationDeg * 10) / 10,
    },
    zodiacHoroscope: horoscope
      ? {
          sign: horoscope.sign,
          signLabel: lang === "zh"
            ? ZODIAC_LABELS[horoscope.sign].zh
            : ZODIAC_LABELS[horoscope.sign].en,
          date: horoscope.date,
          text: horoscope.text,
          percents: scoresToPercents(horoscope.stars, `${horoscope.date}|${horoscope.sign}`),
        }
      : null,
    draftHint: ruleBody,
    instruction:
      lang === "zh"
        ? "facts 是参考材料，请自行组织文案，不必逐项写进正文。"
        : "facts are reference material; write freely, no need to mention every field.",
    ruleVersion: FORTUNE_RULE_VERSION,
  };
}
