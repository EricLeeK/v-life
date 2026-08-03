import { Solar } from "lunar-javascript";

export interface LunarDateFacts {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  monthZh: string;
  dayZh: string;
  yearShengxiaoZh: string;
  dayGanZhiZh: string;
}

/** Calendar facts via lunar-javascript (pinned in package.json). Cross-check with HKO samples in research fixtures. */
export function lunarFactsForDate(isoDate: string): LunarDateFacts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  try {
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return {
      lunarYear: lunar.getYear(),
      lunarMonth: Math.abs(lunar.getMonth()),
      lunarDay: lunar.getDay(),
      isLeapMonth: lunar.getMonth() < 0,
      monthZh: lunar.getMonthInChinese(),
      dayZh: lunar.getDayInChinese(),
      // 春节换年（非立春）
      yearShengxiaoZh: lunar.getYearShengXiao(),
      dayGanZhiZh: lunar.getDayInGanZhi(),
    };
  } catch {
    return null;
  }
}
