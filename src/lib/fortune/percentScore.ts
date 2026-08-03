import { hashStringToSeed } from "./seededRandom";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Map 1–5 stars → percent 40–99.
 * Tens come from star band; ones digit is a stable daily hash so the number
 * visibly wiggles day-to-day without jumping whole tiers.
 */
export function starsToDailyPercent(stars: number, seedKey: string): number {
  const s = clamp(Math.round(stars), 1, 5);
  const tens = 4 + (s - 1); // 4..8 → 40s..80s
  const ones = hashStringToSeed(`pct|${seedKey}`) % 10;
  return clamp(tens * 10 + ones, 40, 89);
}

export function scoresToPercents(
  scores: { overall: number; love: number; career: number; wealth: number },
  seedBase: string,
): { overall: number; love: number; career: number; wealth: number } {
  return {
    overall: starsToDailyPercent(scores.overall, `${seedBase}|overall`),
    love: starsToDailyPercent(scores.love, `${seedBase}|love`),
    career: starsToDailyPercent(scores.career, `${seedBase}|career`),
    wealth: starsToDailyPercent(scores.wealth, `${seedBase}|wealth`),
  };
}
