import { hashStringToSeed, mulberry32 } from "./seededRandom";

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Lightweight 干支日 label (entertainment approx, not professional calendar). */
export function lunarLabelForDate(isoDate: string, lang: "zh" | "en" = "zh"): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const wd = d.getDay();
  const dayIndex = Math.floor(d.getTime() / 86400000);
  const ganzhi = `${GAN[((dayIndex % 10) + 10) % 10]}${ZHI[((dayIndex % 12) + 12) % 12]}`;
  if (lang === "en") {
    return `${WEEKDAYS_EN[wd]} · ${ganzhi}`;
  }
  return `星期${WEEKDAYS_ZH[wd]} · ${ganzhi}日`;
}

export function festiveHint(isoDate: string): string {
  const rng = mulberry32(hashStringToSeed(`fest:${isoDate}`));
  const hints = ["宜静心", "宜小成", "宜温柔", "宜专注"];
  return hints[Math.floor(rng() * hints.length)];
}
