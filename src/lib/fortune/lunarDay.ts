import { Solar } from "lunar-javascript";
import { FORTUNE_RULE_SOURCES, FORTUNE_RULE_VERSION } from "./ruleVersion";

export const LUNAR_JS_SOURCE = FORTUNE_RULE_SOURCES.calendarLib;

export interface LunarDayBundle {
  isoDate: string;
  yi: string[];
  ji: string[];
  dayPillar: string;
  dayGanZh: string;
  dayZhiZh: string;
  chongsha: string;
  clashZhi: string;
  zhiXing: string;
  pengZu: string[];
  lunarLabelZh: string;
  lunarMonthZh: string;
  lunarDayZh: string;
  isLeapMonth: boolean;
  yearShengxiaoZh: string;
  naYin: string;
  ruleVersion: string;
  source: string;
}

function parseIso(isoDate: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** Single source of truth for Chinese civil-day almanac facts (lunar-javascript). */
export function getLunarDayBundle(isoDate: string): LunarDayBundle | null {
  const parts = parseIso(isoDate);
  if (!parts) return null;
  try {
    const lunar = Solar.fromYmd(parts.y, parts.m, parts.d).getLunar();
    const dayPillar = String(lunar.getDayInGanZhi() || "");
    const dayGanZh = dayPillar.slice(0, 1);
    const dayZhiZh = dayPillar.slice(1, 2);
    const clashZhi = String(lunar.getDayChong() || "");
    const chongAnimal = String(lunar.getDayChongShengXiao() || "");
    const yi = ((lunar.getDayYi() || []) as string[]).map(String);
    const ji = ((lunar.getDayJi() || []) as string[]).map(String);
    const pengZu = [String(lunar.getPengZuGan() || ""), String(lunar.getPengZuZhi() || "")].filter(Boolean);
    const leap = lunar.getMonth() < 0;
    const monthZh = String(lunar.getMonthInChinese());
    const dayZh = String(lunar.getDayInChinese());

    return {
      isoDate,
      yi,
      ji,
      dayPillar,
      dayGanZh,
      dayZhiZh,
      chongsha: chongAnimal ? `冲${chongAnimal}` : "",
      clashZhi,
      zhiXing: String(lunar.getZhiXing() || ""),
      pengZu,
      lunarLabelZh: `农历${leap ? "闰" : ""}${monthZh}${dayZh}`,
      lunarMonthZh: monthZh,
      lunarDayZh: dayZh,
      isLeapMonth: leap,
      yearShengxiaoZh: String(lunar.getYearShengXiao() || ""),
      naYin: String(lunar.getDayNaYin() || ""),
      ruleVersion: FORTUNE_RULE_VERSION,
      source: LUNAR_JS_SOURCE,
    };
  } catch {
    return null;
  }
}
