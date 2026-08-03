import { lunarFactsForDate } from "./lunarCalendar";
import type { Shengxiao } from "./types";

/** Gregorian date of 正月初一 for years used in CI cross-checks (HKO / research package). */
export const CNY_BOUNDARIES: Record<number, string> = {
  2010: "2010-02-14",
  2011: "2011-02-03",
  2012: "2012-01-23",
  2013: "2013-02-10",
  2014: "2014-01-31",
  2015: "2015-02-19",
  2016: "2016-02-08",
  2017: "2017-01-28",
  2018: "2018-02-16",
  2019: "2019-02-05",
  2020: "2020-01-25",
  2021: "2021-02-12",
  2022: "2022-02-01",
  2023: "2023-01-22",
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-03",
};

export const SHENGXIAO_ORDER: Shengxiao[] = [
  "rat",
  "ox",
  "tiger",
  "rabbit",
  "dragon",
  "snake",
  "horse",
  "goat",
  "monkey",
  "rooster",
  "dog",
  "pig",
];

export const SHENGXIAO_LABELS: Record<Shengxiao, { zh: string; en: string }> = {
  rat: { zh: "鼠", en: "Rat" },
  ox: { zh: "牛", en: "Ox" },
  tiger: { zh: "虎", en: "Tiger" },
  rabbit: { zh: "兔", en: "Rabbit" },
  dragon: { zh: "龙", en: "Dragon" },
  snake: { zh: "蛇", en: "Snake" },
  horse: { zh: "马", en: "Horse" },
  goat: { zh: "羊", en: "Goat" },
  monkey: { zh: "猴", en: "Monkey" },
  rooster: { zh: "鸡", en: "Rooster" },
  dog: { zh: "狗", en: "Dog" },
  pig: { zh: "猪", en: "Pig" },
};

const ZH_TO_ID: Record<string, Shengxiao> = Object.fromEntries(
  SHENGXIAO_ORDER.map((id) => [SHENGXIAO_LABELS[id].zh, id]),
) as Record<string, Shengxiao>;

/** 地支六冲 pairs (animal order = 子鼠…亥猪). */
export const CLASH_PAIRS: Array<[Shengxiao, Shengxiao]> = [
  ["rat", "horse"],
  ["ox", "goat"],
  ["tiger", "monkey"],
  ["rabbit", "rooster"],
  ["dragon", "dog"],
  ["snake", "pig"],
];

/**
 * Shengxiao from birth date using Chinese New Year boundary (not Jan 1, not 立春).
 * Delegates to lunar-javascript getYearShengXiao().
 */
export function shengxiaoFromBirthDate(isoDate: string): Shengxiao {
  const facts = lunarFactsForDate(isoDate);
  if (facts?.yearShengxiaoZh && ZH_TO_ID[facts.yearShengxiaoZh]) {
    return ZH_TO_ID[facts.yearShengxiaoZh];
  }
  // Fallback: table scan (should rarely trigger)
  const day = isoDate.slice(0, 10);
  let lunarYear = Number(day.slice(0, 4));
  const cny = CNY_BOUNDARIES[lunarYear];
  if (cny && day < cny) lunarYear -= 1;
  const idx = ((lunarYear - 1984) % 12 + 12) % 12;
  return SHENGXIAO_ORDER[idx];
}

export function shengxiaoClashOf(animal: Shengxiao): Shengxiao {
  for (const [a, b] of CLASH_PAIRS) {
    if (a === animal) return b;
    if (b === animal) return a;
  }
  return animal;
}
