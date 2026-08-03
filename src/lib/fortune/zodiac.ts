import * as Astronomy from "astronomy-engine";
import type { ZodiacSign } from "./types";

/** Tropical civil-date table (Wikipedia Astrological sign approximate dates). */
const RANGES: Array<{ sign: ZodiacSign; start: [number, number]; end: [number, number] }> = [
  { sign: "capricorn", start: [12, 22], end: [1, 20] },
  { sign: "aquarius", start: [1, 21], end: [2, 19] },
  { sign: "pisces", start: [2, 20], end: [3, 20] },
  { sign: "aries", start: [3, 21], end: [4, 20] },
  { sign: "taurus", start: [4, 21], end: [5, 21] },
  { sign: "gemini", start: [5, 22], end: [6, 21] },
  { sign: "cancer", start: [6, 22], end: [7, 23] },
  { sign: "leo", start: [7, 24], end: [8, 23] },
  { sign: "virgo", start: [8, 24], end: [9, 23] },
  { sign: "libra", start: [9, 24], end: [10, 23] },
  { sign: "scorpio", start: [10, 24], end: [11, 22] },
  { sign: "sagittarius", start: [11, 23], end: [12, 21] },
];

/** 30° ecliptic bands: a ≤ λ < b (Wikipedia). */
const LONGITUDE_BANDS: Array<{ sign: ZodiacSign; a: number; b: number }> = [
  { sign: "aries", a: 0, b: 30 },
  { sign: "taurus", a: 30, b: 60 },
  { sign: "gemini", a: 60, b: 90 },
  { sign: "cancer", a: 90, b: 120 },
  { sign: "leo", a: 120, b: 150 },
  { sign: "virgo", a: 150, b: 180 },
  { sign: "libra", a: 180, b: 210 },
  { sign: "scorpio", a: 210, b: 240 },
  { sign: "sagittarius", a: 240, b: 270 },
  { sign: "capricorn", a: 270, b: 300 },
  { sign: "aquarius", a: 300, b: 330 },
  { sign: "pisces", a: 330, b: 360 },
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

export interface ZodiacResult {
  sign: ZodiacSign;
  cuspSensitive: boolean;
  method: "tropical_civil_date_table" | "tropical_ecliptic_longitude";
  sunLongitudeDeg?: number;
}

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

function isBoundaryDay(month: number, day: number): boolean {
  return RANGES.some(
    (r) =>
      (month === r.start[0] && day === r.start[1]) || (month === r.end[0] && day === r.end[1]),
  );
}

function signFromLongitude(lon: number): ZodiacSign {
  const λ = ((lon % 360) + 360) % 360;
  for (const band of LONGITUDE_BANDS) {
    if (λ >= band.a && λ < band.b) return band.sign;
  }
  return "pisces";
}

/** Default profile helper: tropical civil-date table. */
export function zodiacFromBirthDate(isoDate: string): ZodiacSign {
  return zodiacDetailsFromBirthDate(isoDate).sign;
}

export function zodiacDetailsFromBirthDate(isoDate: string): ZodiacResult {
  const [, mStr, dStr] = isoDate.split("-");
  const month = Number(mStr);
  const day = Number(dStr);
  const cuspSensitive = isBoundaryDay(month, day);
  for (const r of RANGES) {
    if (inRange(month, day, r.start, r.end)) {
      return { sign: r.sign, cuspSensitive, method: "tropical_civil_date_table" };
    }
  }
  return { sign: "capricorn", cuspSensitive, method: "tropical_civil_date_table" };
}

/**
 * Precise tropical sign from Sun ecliptic longitude (Astronomy Engine).
 * birthHour: 0–23 local civil hour; defaults to 12 when omitted.
 */
export function zodiacFromSunLongitude(
  isoDate: string,
  birthHour: number | null | undefined = 12,
): ZodiacResult {
  const [y, m, d] = isoDate.split("-").map(Number);
  const hour = birthHour == null || birthHour < 0 ? 12 : birthHour;
  const date = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  const sun = Astronomy.SunPosition(date);
  const sign = signFromLongitude(sun.elon);
  const civil = zodiacDetailsFromBirthDate(isoDate);
  return {
    sign,
    cuspSensitive: civil.cuspSensitive || civil.sign !== sign,
    method: "tropical_ecliptic_longitude",
    sunLongitudeDeg: sun.elon,
  };
}
