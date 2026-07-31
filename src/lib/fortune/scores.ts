import { hashStringToSeed, mulberry32 } from "./seededRandom";
import type { DailyScores, Shengxiao, ZodiacSign } from "./types";

function starFromSeed(seedKey: string): number {
  const rng = mulberry32(hashStringToSeed(seedKey));
  return 1 + Math.floor(rng() * 5);
}

export function dailyScores(input: {
  date: string;
  zodiac?: ZodiacSign | null;
  shengxiao?: Shengxiao | null;
}): DailyScores {
  const z = input.zodiac || "generic";
  const s = input.shengxiao || "generic";
  const base = `${input.date}|${z}|${s}`;
  return {
    overall: starFromSeed(`${base}|overall`),
    love: starFromSeed(`${base}|love`),
    career: starFromSeed(`${base}|career`),
    wealth: starFromSeed(`${base}|wealth`),
  };
}
