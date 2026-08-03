import { hashStringToSeed, mulberry32 } from "./seededRandom";

/** King Wen sequence names (1-64). */
export const HEXAGRAM_NAMES: Array<{ n: number; zh: string; en: string }> = [
  { n: 1, zh: "乾", en: "Qian" }, { n: 2, zh: "坤", en: "Kun" },
  { n: 3, zh: "屯", en: "Zhun" }, { n: 4, zh: "蒙", en: "Meng" },
  { n: 5, zh: "需", en: "Xu" }, { n: 6, zh: "讼", en: "Song" },
  { n: 7, zh: "师", en: "Shi" }, { n: 8, zh: "比", en: "Bi" },
  { n: 9, zh: "小畜", en: "Xiao Xu" }, { n: 10, zh: "履", en: "Lu" },
  { n: 11, zh: "泰", en: "Tai" }, { n: 12, zh: "否", en: "Pi" },
  { n: 13, zh: "同人", en: "Tong Ren" }, { n: 14, zh: "大有", en: "Da You" },
  { n: 15, zh: "谦", en: "Qian" }, { n: 16, zh: "豫", en: "Yu" },
  { n: 17, zh: "随", en: "Sui" }, { n: 18, zh: "蛊", en: "Gu" },
  { n: 19, zh: "临", en: "Lin" }, { n: 20, zh: "观", en: "Guan" },
  { n: 21, zh: "噬嗑", en: "Shi He" }, { n: 22, zh: "贲", en: "Bi" },
  { n: 23, zh: "剥", en: "Bo" }, { n: 24, zh: "复", en: "Fu" },
  { n: 25, zh: "无妄", en: "Wu Wang" }, { n: 26, zh: "大畜", en: "Da Xu" },
  { n: 27, zh: "颐", en: "Yi" }, { n: 28, zh: "大过", en: "Da Guo" },
  { n: 29, zh: "坎", en: "Kan" }, { n: 30, zh: "离", en: "Li" },
  { n: 31, zh: "咸", en: "Xian" }, { n: 32, zh: "恒", en: "Heng" },
  { n: 33, zh: "遁", en: "Dun" }, { n: 34, zh: "大壮", en: "Da Zhuang" },
  { n: 35, zh: "晋", en: "Jin" }, { n: 36, zh: "明夷", en: "Ming Yi" },
  { n: 37, zh: "家人", en: "Jia Ren" }, { n: 38, zh: "睽", en: "Kui" },
  { n: 39, zh: "蹇", en: "Jian" }, { n: 40, zh: "解", en: "Xie" },
  { n: 41, zh: "损", en: "Sun" }, { n: 42, zh: "益", en: "Yi" },
  { n: 43, zh: "夬", en: "Guai" }, { n: 44, zh: "姤", en: "Gou" },
  { n: 45, zh: "萃", en: "Cui" }, { n: 46, zh: "升", en: "Sheng" },
  { n: 47, zh: "困", en: "Kun" }, { n: 48, zh: "井", en: "Jing" },
  { n: 49, zh: "革", en: "Ge" }, { n: 50, zh: "鼎", en: "Ding" },
  { n: 51, zh: "震", en: "Zhen" }, { n: 52, zh: "艮", en: "Gen" },
  { n: 53, zh: "渐", en: "Jian" }, { n: 54, zh: "归妹", en: "Gui Mei" },
  { n: 55, zh: "丰", en: "Feng" }, { n: 56, zh: "旅", en: "Lu" },
  { n: 57, zh: "巽", en: "Xun" }, { n: 58, zh: "兑", en: "Dui" },
  { n: 59, zh: "涣", en: "Huan" }, { n: 60, zh: "节", en: "Jie" },
  { n: 61, zh: "中孚", en: "Zhong Fu" }, { n: 62, zh: "小过", en: "Xiao Guo" },
  { n: 63, zh: "既济", en: "Ji Ji" }, { n: 64, zh: "未济", en: "Wei Ji" },
];

/**
 * binary_int (bit0 = bottom line, yang=1) → King Wen number.
 * Source: Wikipedia Hexagram (I Ching) lookup; OEIS A102241.
 */
export const BINARY_INT_TO_KING_WEN: readonly number[] = [
  2, 24, 7, 19, 15, 36, 46, 11, 16, 51, 40, 54, 62, 55, 32, 34, 8, 3, 29, 60, 39, 63, 48, 5, 45, 17,
  47, 58, 31, 49, 28, 43, 23, 27, 4, 41, 52, 22, 18, 26, 35, 21, 64, 38, 56, 30, 50, 14, 20, 42, 59,
  61, 53, 37, 57, 9, 12, 25, 6, 10, 33, 13, 44, 1,
];

export interface IchingLine {
  /** 6=old yin changing, 7=young yang, 8=young yin, 9=old yang changing */
  value: 6 | 7 | 8 | 9;
  yang: boolean;
  changing: boolean;
}

export interface IchingCast {
  seed: string;
  lines: IchingLine[];
  hexagramNumber: number;
  nameZh: string;
  nameEn: string;
  changingLines: number[];
  relatingHexagramNumber: number | null;
  relatingNameZh: string | null;
  relatingNameEn: string | null;
  binaryBottomToTop: string;
}

export function binaryIntFromYangFlags(yangBottomToTop: boolean[]): number {
  let v = 0;
  for (let i = 0; i < 6; i++) {
    if (yangBottomToTop[i]) v |= 1 << i;
  }
  return v;
}

export function kingWenFromYangFlags(yangBottomToTop: boolean[]): number {
  return BINARY_INT_TO_KING_WEN[binaryIntFromYangFlags(yangBottomToTop)] ?? 1;
}

function coinLine(rng: () => number): IchingLine {
  // three coins: heads=3 tails=2 → sum 6..9 (product convention)
  const sum =
    (rng() < 0.5 ? 2 : 3) +
    (rng() < 0.5 ? 2 : 3) +
    (rng() < 0.5 ? 2 : 3);
  const value = sum as 6 | 7 | 8 | 9;
  const yang = value === 7 || value === 9;
  const changing = value === 6 || value === 9;
  return { value, yang, changing };
}

export function castHexagram(seed: string): IchingCast {
  const rng = mulberry32(hashStringToSeed(`iching:${seed}`));
  const lines: IchingLine[] = [];
  for (let i = 0; i < 6; i++) lines.push(coinLine(rng));

  const primaryFlags = lines.map((l) => l.yang);
  const hexagramNumber = kingWenFromYangFlags(primaryFlags);
  const meta = HEXAGRAM_NAMES[hexagramNumber - 1];
  const changingLines = lines.map((l, i) => (l.changing ? i + 1 : 0)).filter(Boolean);

  let relatingHexagramNumber: number | null = null;
  let relatingNameZh: string | null = null;
  let relatingNameEn: string | null = null;
  if (changingLines.length > 0) {
    const relatingFlags = lines.map((l) => (l.changing ? !l.yang : l.yang));
    relatingHexagramNumber = kingWenFromYangFlags(relatingFlags);
    const rmeta = HEXAGRAM_NAMES[relatingHexagramNumber - 1];
    relatingNameZh = rmeta.zh;
    relatingNameEn = rmeta.en;
  }

  return {
    seed,
    lines,
    hexagramNumber,
    nameZh: meta.zh,
    nameEn: meta.en,
    changingLines,
    relatingHexagramNumber,
    relatingNameZh,
    relatingNameEn,
    binaryBottomToTop: primaryFlags.map((y) => (y ? "1" : "0")).join(""),
  };
}

export function ichingRuleBlurb(cast: IchingCast, lang: "zh" | "en"): string {
  if (lang === "en") {
    const rel = cast.relatingNameEn ? ` Relating: ${cast.relatingNameEn}.` : "";
    return `Hexagram ${cast.hexagramNumber} ${cast.nameEn}. Changing lines: ${
      cast.changingLines.join(", ") || "none"
    }.${rel} Stay patient and take one clear step.`;
  }
  const rel = cast.relatingNameZh ? `之卦：${cast.relatingNameZh}。` : "";
  return `得卦：${cast.nameZh}（第 ${cast.hexagramNumber} 卦）。变爻：${
    cast.changingLines.length ? cast.changingLines.join("、") : "无"
  }。${rel}先稳住呼吸，把眼前一步做清楚。`;
}
