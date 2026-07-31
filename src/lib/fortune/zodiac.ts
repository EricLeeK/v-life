import type { ZodiacSign } from "./types";

const RANGES: Array<{ sign: ZodiacSign; start: [number, number]; end: [number, number] }> = [
  { sign: "capricorn", start: [12, 22], end: [1, 19] },
  { sign: "aquarius", start: [1, 20], end: [2, 18] },
  { sign: "pisces", start: [2, 19], end: [3, 20] },
  { sign: "aries", start: [3, 21], end: [4, 19] },
  { sign: "taurus", start: [4, 20], end: [5, 20] },
  { sign: "gemini", start: [5, 21], end: [6, 20] },
  { sign: "cancer", start: [6, 21], end: [7, 22] },
  { sign: "leo", start: [7, 23], end: [8, 22] },
  { sign: "virgo", start: [8, 23], end: [9, 22] },
  { sign: "libra", start: [9, 23], end: [10, 22] },
  { sign: "scorpio", start: [10, 23], end: [11, 21] },
  { sign: "sagittarius", start: [11, 22], end: [12, 21] },
];

export const ZODIAC_LABELS: Record<ZodiacSign, { zh: string; en: string }> = {
  aries: { zh: "白羊座", en: "Aries" },
  taurus: { zh: "金牛座", en: "Taurus" },
  gemini: { zh: "双子座", en: "Gemini" },
  cancer: { zh: "巨蟹座", en: "Cancer" },
  leo: { zh: "狮子座", en: "Leo" },
  virgo: { zh: "处女座", en: "Virgo" },
  libra: { zh: "天秤座", en: "Libra" },
  scorpio: { zh: "天蝎座", en: "Scorpio" },
  sagittarius: { zh: "射手座", en: "Sagittarius" },
  capricorn: { zh: "摩羯座", en: "Capricorn" },
  aquarius: { zh: "水瓶座", en: "Aquarius" },
  pisces: { zh: "双鱼座", en: "Pisces" },
};

export const ZODIAC_SIGNS = Object.keys(ZODIAC_LABELS) as ZodiacSign[];

function inRange(month: number, day: number, start: [number, number], end: [number, number]): boolean {
  const [sm, sd] = start;
  const [em, ed] = end;
  if (sm > em) {
    return (month === sm && day >= sd) || (month === em && day <= ed) || month > sm || month < em;
  }
  if (month === sm && month === em) return day >= sd && day <= ed;
  if (month === sm) return day >= sd;
  if (month === em) return day <= ed;
  return month > sm && month < em;
}

export function zodiacFromBirthDate(isoDate: string): ZodiacSign {
  const [, mStr, dStr] = isoDate.split("-");
  const month = Number(mStr);
  const day = Number(dStr);
  for (const r of RANGES) {
    if (inRange(month, day, r.start, r.end)) return r.sign;
  }
  return "capricorn";
}
