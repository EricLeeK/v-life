import type { Shengxiao } from "./types";

/** Gregorian-year approximation (not precise Chinese New Year boundary). */
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

export function shengxiaoFromBirthDate(isoDate: string): Shengxiao {
  const year = Number(isoDate.slice(0, 4));
  const idx = ((year - 4) % 12 + 12) % 12;
  return SHENGXIAO_ORDER[idx];
}
