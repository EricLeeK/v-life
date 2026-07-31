import { hashStringToSeed, mulberry32 } from "./seededRandom";

export type LotRank = "上上" | "上吉" | "中吉" | "中平" | "下下";

export interface LotResult {
  seed: string;
  id: number;
  rankZh: LotRank;
  rankEn: string;
  verseZh: string;
  verseEn: string;
}

const POOL: Array<Omit<LotResult, "seed">> = [
  { id: 1, rankZh: "上上", rankEn: "Excellent", verseZh: "云开见月明，所求皆可成。", verseEn: "Clouds part; what you seek can bloom." },
  { id: 2, rankZh: "上上", rankEn: "Excellent", verseZh: "春风入怀来，万事皆舒泰。", verseEn: "Spring breeze arrives; ease follows." },
  { id: 3, rankZh: "上吉", rankEn: "Great", verseZh: "积小流成江，稳步自生光。", verseEn: "Small streams become rivers." },
  { id: 4, rankZh: "上吉", rankEn: "Great", verseZh: "贵人暗中助，心诚事可成。", verseEn: "Quiet help appears when sincere." },
  { id: 5, rankZh: "上吉", rankEn: "Great", verseZh: "花开自有时，不必苦相催。", verseEn: "Flowers bloom in their time." },
  { id: 6, rankZh: "中吉", rankEn: "Good", verseZh: "半晴半雨天，耐心最值钱。", verseEn: "Half sun, half rain—patience wins." },
  { id: 7, rankZh: "中吉", rankEn: "Good", verseZh: "路远心不远，一步一安然。", verseEn: "Far road, calm heart." },
  { id: 8, rankZh: "中吉", rankEn: "Good", verseZh: "凡事留余地，日后好相见。", verseEn: "Leave room; meet kindly later." },
  { id: 9, rankZh: "中吉", rankEn: "Good", verseZh: "轻舟已过礁，回望亦从容。", verseEn: "Past the reef—look back gently." },
  { id: 10, rankZh: "中平", rankEn: "Fair", verseZh: "平波不起浪，守常亦是福。", verseEn: "Still water is also a blessing." },
  { id: 11, rankZh: "中平", rankEn: "Fair", verseZh: "今日宜收藏，明日再张扬。", verseEn: "Gather today; shine tomorrow." },
  { id: 12, rankZh: "中平", rankEn: "Fair", verseZh: "问心已足够，外求且放缓。", verseEn: "Ask your heart; slow outer chase." },
  { id: 13, rankZh: "中平", rankEn: "Fair", verseZh: "茶杯半满时，知足味更长。", verseEn: "Half-full cup tastes longer." },
  { id: 14, rankZh: "中平", rankEn: "Fair", verseZh: "暂避锋芒好，养锐待春风。", verseEn: "Rest the blade; wait for spring." },
  { id: 15, rankZh: "下下", rankEn: "Rough", verseZh: "风雨有时歇，先把自己安顿好。", verseEn: "Storms pause—settle yourself first." },
  { id: 16, rankZh: "下下", rankEn: "Rough", verseZh: "莫急于求成，且把脚步放慢。", verseEn: "Don't rush; slow your steps." },
  { id: 17, rankZh: "下下", rankEn: "Rough", verseZh: "今日宜静不宜动，好好休息。", verseEn: "Better rest than force today." },
  { id: 18, rankZh: "上吉", rankEn: "Great", verseZh: "一念慈悲起，百事皆生暖。", verseEn: "One kind thought warms many things." },
  { id: 19, rankZh: "中吉", rankEn: "Good", verseZh: "旧友重相见，话语自生香。", verseEn: "Old friends bring soft words." },
  { id: 20, rankZh: "上上", rankEn: "Excellent", verseZh: "心灯既已亮，暗处亦有路。", verseEn: "With an inner lamp, paths appear." },
  { id: 21, rankZh: "中吉", rankEn: "Good", verseZh: "学而后知不足，进一寸是进。", verseEn: "Learning an inch still counts." },
  { id: 22, rankZh: "中平", rankEn: "Fair", verseZh: "放下比较心，日子自清甜。", verseEn: "Drop comparison; days sweeten." },
  { id: 23, rankZh: "上吉", rankEn: "Great", verseZh: "所言若真诚，所遇多善意。", verseEn: "Sincere words meet goodwill." },
  { id: 24, rankZh: "中吉", rankEn: "Good", verseZh: "整理旧物时，会遇见新念头。", verseEn: "Tidying invites new ideas." },
];

export function drawLot(seed: string): LotResult {
  const rng = mulberry32(hashStringToSeed(`lot:${seed}`));
  const item = POOL[Math.floor(rng() * POOL.length)];
  return { seed, ...item };
}
