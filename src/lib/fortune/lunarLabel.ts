import { getLunarDayBundle } from "./lunarDay";
import { dayPillarFromDate } from "./bazi";

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday for a civil YYYY-MM-DD in local calendar sense (not UTC midnight trap). */
export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Noon local avoids DST edge cases; for China dates this matches the civil weekday.
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

export function weekdayLabel(isoDate: string, lang: "zh" | "en" = "zh"): string {
  const wd = weekdayIndex(isoDate);
  return lang === "zh" ? `星期${WEEKDAYS_ZH[wd]}` : WEEKDAYS_EN[wd];
}

/**
 * Compact lunar + day-pillar label for the hub date strip.
 */
export function lunarLabelForDate(isoDate: string, lang: "zh" | "en" = "zh"): string {
  const wd = weekdayLabel(isoDate, lang);
  const bundle = getLunarDayBundle(isoDate);
  const pillar = bundle?.dayPillar || dayPillarFromDate(isoDate).label;

  if (lang === "en") {
    if (!bundle) return `${wd} · ${pillar}`;
    const leap = bundle.isLeapMonth ? "leap " : "";
    return `${wd} · lunar ${leap}${bundle.lunarMonthZh} ${bundle.lunarDayZh} · ${pillar}`;
  }

  if (!bundle) return `${wd} · ${pillar}日`;
  return `${wd} · ${bundle.lunarLabelZh} · ${pillar}日`;
}

export function festiveHint(isoDate: string): string {
  const bundle = getLunarDayBundle(isoDate);
  const hints = ["宜静心", "宜小成", "宜温柔", "宜专注"];
  const idx = bundle?.dayPillar
    ? Array.from(bundle.dayPillar).reduce((a, c) => a + c.charCodeAt(0), 0)
    : dayPillarFromDate(isoDate).index0;
  return hints[idx % hints.length];
}
