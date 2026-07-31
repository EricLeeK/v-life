const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GAN_WX = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];
const ZHI_WX = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"];
const WX_KEYS = ["木", "火", "土", "金", "水"] as const;

export interface DayPillar {
  ganZh: string;
  zhiZh: string;
  label: string;
  wuxing: Array<{ element: string; count: number }>;
}

/** Julian day number at local noon-ish from ISO date. */
function julianDay(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  let year = y;
  let month = m;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    d +
    B -
    1524.5
  );
}

/**
 * Day pillar from date. Reference: 1984-02-02 is 甲子日 (common calendar anchor).
 * birth_hour is reserved for display hints; day pillar uses calendar date.
 */
export function dayPillarFromDate(isoDate: string, _birthHour?: number | null): DayPillar {
  const jd = julianDay(isoDate);
  const ref = julianDay("1984-02-02");
  const diff = Math.round(jd - ref);
  const ganIdx = ((diff % 10) + 10) % 10;
  const zhiIdx = ((diff % 12) + 12) % 12;
  const ganZh = GAN[ganIdx];
  const zhiZh = ZHI[zhiIdx];

  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  counts[GAN_WX[ganIdx]] += 1;
  counts[ZHI_WX[zhiIdx]] += 1;
  // soft weight from hour for chart flavor only
  if (_birthHour != null && _birthHour >= 0) {
    const hourZhi = Math.floor(((_birthHour + 1) % 24) / 2);
    counts[ZHI_WX[hourZhi]] += 1;
  }

  return {
    ganZh,
    zhiZh,
    label: `${ganZh}${zhiZh}`,
    wuxing: WX_KEYS.map((element) => ({ element, count: counts[element] })),
  };
}

export function baziRuleBlurb(pillar: DayPillar, lang: "zh" | "en"): string {
  const top = [...pillar.wuxing].sort((a, b) => b.count - a.count)[0];
  if (lang === "en") {
    return `Day pillar ${pillar.label}. Today's gentle cue leans ${top.element}. Keep one habit soft and steady.`;
  }
  return `今日日柱 ${pillar.label}。五行气息偏「${top.element}」，适合把一件小事温柔做完。`;
}
