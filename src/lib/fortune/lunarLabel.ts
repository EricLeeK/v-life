import { getLunarDayBundle } from "./lunarDay";
import { dayPillarFromDate } from "./bazi";

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Compact lunar + day-pillar label for the hub date strip.
 * Lunar month/day and day pillar from lunar-javascript via lunarDay bundle.
 */
export function lunarLabelForDate(isoDate: string, lang: "zh" | "en" = "zh"): string {
  const wd = weekdayIndex(isoDate);
  const bundle = getLunarDayBundle(isoDate);
  const pillar = bundle?.dayPillar || dayPillarFromDate(isoDate).label;

  if (lang === "en") {
    if (!bundle) return `${WEEKDAYS_EN[wd]} · ${pillar}`;
    const leap = bundle.isLeapMonth ? "leap " : "";
    return `${WEEKDAYS_EN[wd]} · lunar ${leap}${bundle.lunarMonthZh} ${bundle.lunarDayZh} · ${pillar}`;
  }

  if (!bundle) return `星期${WEEKDAYS_ZH[wd]} · ${pillar}日`;
  return `${bundle.lunarLabelZh} · ${pillar}日`;
}

export function festiveHint(isoDate: string): string {
  const bundle = getLunarDayBundle(isoDate);
  const hints = ["宜静心", "宜小成", "宜温柔", "宜专注"];
  const idx = bundle?.dayPillar
    ? Array.from(bundle.dayPillar).reduce((a, c) => a + c.charCodeAt(0), 0)
    : dayPillarFromDate(isoDate).index0;
  return hints[idx % hints.length];
}
