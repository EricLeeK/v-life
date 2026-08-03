const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GAN_WX = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];
const ZHI_WX = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"];
const WX_KEYS = ["木", "火", "土", "金", "水"] as const;

/** Verified civil-midnight anchor: 1984-01-31 = 甲子. NOT 1984-02-02. */
export const DAY_PILLAR_ANCHOR_ISO = "1984-01-31";

export type DayBoundaryMode = "civil_midnight" | "zi_23";

export interface DayPillar {
  ganZh: string;
  zhiZh: string;
  label: string;
  index0: number;
  dayBoundaryMode: DayBoundaryMode;
  wuxing: Array<{ element: string; count: number }>;
}

/** Integer civil day number (UTC date components, no ms-day drift). */
export function civilDayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Day pillar from civil date.
 * index = (civilDay(date) - civilDay(1984-01-31)) mod 60
 * Default day boundary: civil_midnight (aligned with displayed Gregorian date).
 */
export function dayPillarFromDate(
  isoDate: string,
  _birthHour?: number | null,
  dayBoundaryMode: DayBoundaryMode = "civil_midnight",
): DayPillar {
  const index0 = ((civilDayNumber(isoDate) - civilDayNumber(DAY_PILLAR_ANCHOR_ISO)) % 60 + 60) % 60;
  const ganIdx = index0 % 10;
  const zhiIdx = index0 % 12;
  const ganZh = GAN[ganIdx];
  const zhiZh = ZHI[zhiIdx];

  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  counts[GAN_WX[ganIdx]] += 1;
  counts[ZHI_WX[zhiIdx]] += 1;
  // soft weight from hour for chart flavor only (not a full hour pillar)
  if (_birthHour != null && _birthHour >= 0) {
    const hourZhi = Math.floor(((_birthHour + 1) % 24) / 2);
    counts[ZHI_WX[hourZhi]] += 1;
  }

  return {
    ganZh,
    zhiZh,
    label: `${ganZh}${zhiZh}`,
    index0,
    dayBoundaryMode,
    wuxing: WX_KEYS.map((element) => ({ element, count: counts[element] })),
  };
}

/** Clash earthly branch opposite the day branch (六冲). */
export function clashZhiFromDayZhi(zhiZh: string): string {
  const i = ZHI.indexOf(zhiZh);
  if (i < 0) return "";
  return ZHI[(i + 6) % 12];
}

export function baziRuleBlurb(pillar: DayPillar, lang: "zh" | "en"): string {
  const top = [...pillar.wuxing].sort((a, b) => b.count - a.count)[0];
  if (lang === "en") {
    return `Day pillar ${pillar.label}. Today's gentle cue leans ${top.element}. Keep one habit soft and steady.`;
  }
  return `今日日柱 ${pillar.label}。五行气息偏「${top.element}」，适合把一件小事温柔做完。`;
}
