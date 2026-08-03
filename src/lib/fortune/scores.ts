import { getAlmanacForDate } from "./almanac";
import { dayPillarFromDate } from "./bazi";
import { hashStringToSeed, mulberry32 } from "./seededRandom";
import { CLASH_PAIRS, SHENGXIAO_ORDER } from "./shengxiao";
import { FORTUNE_RULE_VERSION } from "./ruleVersion";
import type { DailyScores, Shengxiao, ZodiacSign } from "./types";

const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Shengxiao vs day branch: clash / six-harmony → [-1, 1]. */
export function shengxiaoRelationScore(profile: Shengxiao | null | undefined, dayZhi: string): number {
  if (!profile) return 0;
  const dayAnimal = SHENGXIAO_ORDER[ZHI.indexOf(dayZhi)];
  if (!dayAnimal) return 0;
  for (const [a, b] of CLASH_PAIRS) {
    if ((a === profile && b === dayAnimal) || (b === profile && a === dayAnimal)) return -1;
  }
  const harmonies: Array<[Shengxiao, Shengxiao]> = [
    ["rat", "ox"],
    ["tiger", "pig"],
    ["rabbit", "dog"],
    ["dragon", "rooster"],
    ["snake", "monkey"],
    ["horse", "goat"],
  ];
  for (const [a, b] of harmonies) {
    if ((a === profile && b === dayAnimal) || (b === profile && a === dayAnimal)) return 1;
  }
  return 0;
}

/** Almanac balance from yi/ji counts → roughly [-1, 1]. */
export function almanacBalanceScore(isoDate: string): number {
  const a = getAlmanacForDate(isoDate);
  const yi = a.yi.length;
  const ji = a.ji.length;
  if (yi + ji === 0) return 0;
  return clamp((yi - ji) / 12, -1, 1);
}

function starsFromRaw(raw: number): number {
  return Math.round(clamp(raw, 1, 5));
}

/**
 * Daily scores from interpretable signals:
 * H = almanac yi/ji balance, S = shengxiao vs day branch, Z = optional zodiac API score [-1,1] or 1–5.
 */
export function dailyScores(input: {
  date: string;
  zodiac?: ZodiacSign | null;
  shengxiao?: Shengxiao | null;
  /** Optional zodiac day factor in [-1, 1] (use zodiacFactorFromStars for API overall). */
  zodiacFactor?: number | null;
}): DailyScores {
  const pillar = dayPillarFromDate(input.date);
  const H = almanacBalanceScore(input.date);
  const S = shengxiaoRelationScore(input.shengxiao, pillar.zhiZh);

  let Z = 0;
  if (input.zodiacFactor != null && Number.isFinite(input.zodiacFactor)) {
    Z = clamp(input.zodiacFactor, -1, 1);
  }

  const zKey = input.zodiac || "generic";
  const sKey = input.shengxiao || "generic";
  const jitter = (dim: string) => {
    const rng = mulberry32(hashStringToSeed(`${input.date}|${zKey}|${sKey}|${dim}|${FORTUNE_RULE_VERSION}`));
    return (rng() * 2 - 1) * 0.15;
  };

  const base = 3 + H * 0.85 + S * 0.9 + Z * 1.35;
  return {
    overall: starsFromRaw(base + jitter("overall")),
    love: starsFromRaw(base + S * 0.1 + Z * 0.15 + jitter("love")),
    career: starsFromRaw(base + H * 0.15 + jitter("career")),
    wealth: starsFromRaw(base + H * 0.1 + Z * 0.1 + jitter("wealth")),
  };
}
