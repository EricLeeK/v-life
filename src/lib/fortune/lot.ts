import { hashStringToSeed, mulberry32 } from "./seededRandom";
import { FORTUNE_RULE_VERSION } from "./ruleVersion";

export type LotRank = "上上" | "上吉" | "中吉" | "中平" | "下平";

export interface LotResult {
  seed: string;
  id: number;
  rankZh: LotRank;
  rankEn: string;
  verseZh: string;
  verseEn: string;
  traditionalSystemClaim: false;
  ruleVersion: string;
}

/** V-Life product corpus — NOT temple Guanyin/Yue Lao lots. */
const POOL: Array<Omit<LotResult, "seed" | "traditionalSystemClaim" | "ruleVersion">> = [
  { id: 1, rankZh: "上上", rankEn: "Excellent", verseZh: "第1签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 1 · 启程: A door opens when you take the first quiet step." },
  { id: 2, rankZh: "上上", rankEn: "Excellent", verseZh: "第2签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 2 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 3, rankZh: "上上", rankEn: "Excellent", verseZh: "第3签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 3 · 沟通: A soft word today can clear a long fog." },
  { id: 4, rankZh: "上上", rankEn: "Excellent", verseZh: "第4签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 4 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 5, rankZh: "上上", rankEn: "Excellent", verseZh: "第5签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 5 · 信任: Trust yourself enough to ask for a little help." },
  { id: 6, rankZh: "上上", rankEn: "Excellent", verseZh: "第6签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 6 · 整理: Clear one small corner and the room feels larger." },
  { id: 7, rankZh: "上上", rankEn: "Excellent", verseZh: "第7签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 7 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 8, rankZh: "上上", rankEn: "Excellent", verseZh: "第8签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 8 · 边界: A kind boundary protects both hearts." },
  { id: 9, rankZh: "上上", rankEn: "Excellent", verseZh: "第9签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 9 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 10, rankZh: "上上", rankEn: "Excellent", verseZh: "第10签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 10 · 勇气: Courage can be as small as sending the message." },
  { id: 11, rankZh: "上上", rankEn: "Excellent", verseZh: "第11签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 11 · 启程: A door opens when you take the first quiet step." },
  { id: 12, rankZh: "上上", rankEn: "Excellent", verseZh: "第12签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 12 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 13, rankZh: "上上", rankEn: "Excellent", verseZh: "第13签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 13 · 沟通: A soft word today can clear a long fog." },
  { id: 14, rankZh: "上上", rankEn: "Excellent", verseZh: "第14签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 14 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 15, rankZh: "上上", rankEn: "Excellent", verseZh: "第15签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 15 · 信任: Trust yourself enough to ask for a little help." },
  { id: 16, rankZh: "上吉", rankEn: "Great", verseZh: "第16签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 16 · 整理: Clear one small corner and the room feels larger." },
  { id: 17, rankZh: "上吉", rankEn: "Great", verseZh: "第17签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 17 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 18, rankZh: "上吉", rankEn: "Great", verseZh: "第18签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 18 · 边界: A kind boundary protects both hearts." },
  { id: 19, rankZh: "上吉", rankEn: "Great", verseZh: "第19签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 19 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 20, rankZh: "上吉", rankEn: "Great", verseZh: "第20签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 20 · 勇气: Courage can be as small as sending the message." },
  { id: 21, rankZh: "上吉", rankEn: "Great", verseZh: "第21签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 21 · 启程: A door opens when you take the first quiet step." },
  { id: 22, rankZh: "上吉", rankEn: "Great", verseZh: "第22签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 22 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 23, rankZh: "上吉", rankEn: "Great", verseZh: "第23签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 23 · 沟通: A soft word today can clear a long fog." },
  { id: 24, rankZh: "上吉", rankEn: "Great", verseZh: "第24签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 24 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 25, rankZh: "上吉", rankEn: "Great", verseZh: "第25签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 25 · 信任: Trust yourself enough to ask for a little help." },
  { id: 26, rankZh: "上吉", rankEn: "Great", verseZh: "第26签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 26 · 整理: Clear one small corner and the room feels larger." },
  { id: 27, rankZh: "上吉", rankEn: "Great", verseZh: "第27签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 27 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 28, rankZh: "上吉", rankEn: "Great", verseZh: "第28签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 28 · 边界: A kind boundary protects both hearts." },
  { id: 29, rankZh: "上吉", rankEn: "Great", verseZh: "第29签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 29 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 30, rankZh: "上吉", rankEn: "Great", verseZh: "第30签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 30 · 勇气: Courage can be as small as sending the message." },
  { id: 31, rankZh: "上吉", rankEn: "Great", verseZh: "第31签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 31 · 启程: A door opens when you take the first quiet step." },
  { id: 32, rankZh: "上吉", rankEn: "Great", verseZh: "第32签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 32 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 33, rankZh: "上吉", rankEn: "Great", verseZh: "第33签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 33 · 沟通: A soft word today can clear a long fog." },
  { id: 34, rankZh: "上吉", rankEn: "Great", verseZh: "第34签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 34 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 35, rankZh: "上吉", rankEn: "Great", verseZh: "第35签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 35 · 信任: Trust yourself enough to ask for a little help." },
  { id: 36, rankZh: "上吉", rankEn: "Great", verseZh: "第36签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 36 · 整理: Clear one small corner and the room feels larger." },
  { id: 37, rankZh: "上吉", rankEn: "Great", verseZh: "第37签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 37 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 38, rankZh: "上吉", rankEn: "Great", verseZh: "第38签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 38 · 边界: A kind boundary protects both hearts." },
  { id: 39, rankZh: "上吉", rankEn: "Great", verseZh: "第39签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 39 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 40, rankZh: "上吉", rankEn: "Great", verseZh: "第40签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 40 · 勇气: Courage can be as small as sending the message." },
  { id: 41, rankZh: "中吉", rankEn: "Good", verseZh: "第41签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 41 · 启程: A door opens when you take the first quiet step." },
  { id: 42, rankZh: "中吉", rankEn: "Good", verseZh: "第42签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 42 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 43, rankZh: "中吉", rankEn: "Good", verseZh: "第43签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 43 · 沟通: A soft word today can clear a long fog." },
  { id: 44, rankZh: "中吉", rankEn: "Good", verseZh: "第44签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 44 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 45, rankZh: "中吉", rankEn: "Good", verseZh: "第45签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 45 · 信任: Trust yourself enough to ask for a little help." },
  { id: 46, rankZh: "中吉", rankEn: "Good", verseZh: "第46签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 46 · 整理: Clear one small corner and the room feels larger." },
  { id: 47, rankZh: "中吉", rankEn: "Good", verseZh: "第47签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 47 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 48, rankZh: "中吉", rankEn: "Good", verseZh: "第48签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 48 · 边界: A kind boundary protects both hearts." },
  { id: 49, rankZh: "中吉", rankEn: "Good", verseZh: "第49签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 49 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 50, rankZh: "中吉", rankEn: "Good", verseZh: "第50签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 50 · 勇气: Courage can be as small as sending the message." },
  { id: 51, rankZh: "中吉", rankEn: "Good", verseZh: "第51签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 51 · 启程: A door opens when you take the first quiet step." },
  { id: 52, rankZh: "中吉", rankEn: "Good", verseZh: "第52签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 52 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 53, rankZh: "中吉", rankEn: "Good", verseZh: "第53签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 53 · 沟通: A soft word today can clear a long fog." },
  { id: 54, rankZh: "中吉", rankEn: "Good", verseZh: "第54签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 54 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 55, rankZh: "中吉", rankEn: "Good", verseZh: "第55签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 55 · 信任: Trust yourself enough to ask for a little help." },
  { id: 56, rankZh: "中吉", rankEn: "Good", verseZh: "第56签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 56 · 整理: Clear one small corner and the room feels larger." },
  { id: 57, rankZh: "中吉", rankEn: "Good", verseZh: "第57签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 57 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 58, rankZh: "中吉", rankEn: "Good", verseZh: "第58签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 58 · 边界: A kind boundary protects both hearts." },
  { id: 59, rankZh: "中吉", rankEn: "Good", verseZh: "第59签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 59 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 60, rankZh: "中吉", rankEn: "Good", verseZh: "第60签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 60 · 勇气: Courage can be as small as sending the message." },
  { id: 61, rankZh: "中吉", rankEn: "Good", verseZh: "第61签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 61 · 启程: A door opens when you take the first quiet step." },
  { id: 62, rankZh: "中吉", rankEn: "Good", verseZh: "第62签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 62 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 63, rankZh: "中吉", rankEn: "Good", verseZh: "第63签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 63 · 沟通: A soft word today can clear a long fog." },
  { id: 64, rankZh: "中吉", rankEn: "Good", verseZh: "第64签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 64 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 65, rankZh: "中吉", rankEn: "Good", verseZh: "第65签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 65 · 信任: Trust yourself enough to ask for a little help." },
  { id: 66, rankZh: "中吉", rankEn: "Good", verseZh: "第66签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 66 · 整理: Clear one small corner and the room feels larger." },
  { id: 67, rankZh: "中吉", rankEn: "Good", verseZh: "第67签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 67 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 68, rankZh: "中吉", rankEn: "Good", verseZh: "第68签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 68 · 边界: A kind boundary protects both hearts." },
  { id: 69, rankZh: "中吉", rankEn: "Good", verseZh: "第69签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 69 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 70, rankZh: "中吉", rankEn: "Good", verseZh: "第70签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 70 · 勇气: Courage can be as small as sending the message." },
  { id: 71, rankZh: "中吉", rankEn: "Good", verseZh: "第71签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 71 · 启程: A door opens when you take the first quiet step." },
  { id: 72, rankZh: "中吉", rankEn: "Good", verseZh: "第72签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 72 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 73, rankZh: "中吉", rankEn: "Good", verseZh: "第73签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 73 · 沟通: A soft word today can clear a long fog." },
  { id: 74, rankZh: "中吉", rankEn: "Good", verseZh: "第74签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 74 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 75, rankZh: "中吉", rankEn: "Good", verseZh: "第75签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 75 · 信任: Trust yourself enough to ask for a little help." },
  { id: 76, rankZh: "中平", rankEn: "Fair", verseZh: "第76签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 76 · 整理: Clear one small corner and the room feels larger." },
  { id: 77, rankZh: "中平", rankEn: "Fair", verseZh: "第77签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 77 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 78, rankZh: "中平", rankEn: "Fair", verseZh: "第78签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 78 · 边界: A kind boundary protects both hearts." },
  { id: 79, rankZh: "中平", rankEn: "Fair", verseZh: "第79签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 79 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 80, rankZh: "中平", rankEn: "Fair", verseZh: "第80签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 80 · 勇气: Courage can be as small as sending the message." },
  { id: 81, rankZh: "中平", rankEn: "Fair", verseZh: "第81签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 81 · 启程: A door opens when you take the first quiet step." },
  { id: 82, rankZh: "中平", rankEn: "Fair", verseZh: "第82签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 82 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 83, rankZh: "中平", rankEn: "Fair", verseZh: "第83签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 83 · 沟通: A soft word today can clear a long fog." },
  { id: 84, rankZh: "中平", rankEn: "Fair", verseZh: "第84签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 84 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 85, rankZh: "中平", rankEn: "Fair", verseZh: "第85签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 85 · 信任: Trust yourself enough to ask for a little help." },
  { id: 86, rankZh: "中平", rankEn: "Fair", verseZh: "第86签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 86 · 整理: Clear one small corner and the room feels larger." },
  { id: 87, rankZh: "中平", rankEn: "Fair", verseZh: "第87签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 87 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 88, rankZh: "中平", rankEn: "Fair", verseZh: "第88签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 88 · 边界: A kind boundary protects both hearts." },
  { id: 89, rankZh: "中平", rankEn: "Fair", verseZh: "第89签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 89 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 90, rankZh: "中平", rankEn: "Fair", verseZh: "第90签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 90 · 勇气: Courage can be as small as sending the message." },
  { id: 91, rankZh: "下平", rankEn: "Gentle", verseZh: "第91签·启程：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 91 · 启程: A door opens when you take the first quiet step." },
  { id: 92, rankZh: "下平", rankEn: "Gentle", verseZh: "第92签·耐心：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 92 · 耐心: What ripens slowly often keeps its sweetness." },
  { id: 93, rankZh: "下平", rankEn: "Gentle", verseZh: "第93签·沟通：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 93 · 沟通: A soft word today can clear a long fog." },
  { id: 94, rankZh: "下平", rankEn: "Gentle", verseZh: "第94签·休息：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 94 · 休息: Rest is not retreat; it prepares tomorrow's strength." },
  { id: 95, rankZh: "下平", rankEn: "Gentle", verseZh: "第95签·信任：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 95 · 信任: Trust yourself enough to ask for a little help." },
  { id: 96, rankZh: "下平", rankEn: "Gentle", verseZh: "第96签·整理：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 96 · 整理: Clear one small corner and the room feels larger." },
  { id: 97, rankZh: "下平", rankEn: "Gentle", verseZh: "第97签·学习：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 97 · 学习: Curiosity is a lantern; keep it lit." },
  { id: 98, rankZh: "下平", rankEn: "Gentle", verseZh: "第98签·边界：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 98 · 边界: A kind boundary protects both hearts." },
  { id: 99, rankZh: "下平", rankEn: "Gentle", verseZh: "第99签·感恩：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 99 · 感恩: Name one ordinary gift and the day brightens." },
  { id: 100, rankZh: "下平", rankEn: "Gentle", verseZh: "第100签·勇气：愿你以温柔的步子靠近今日的光。", verseEn: "Lot 100 · 勇气: Courage can be as small as sending the message." },
];

export function drawLot(seed: string): LotResult {
  const rng = mulberry32(hashStringToSeed(`lot:${FORTUNE_RULE_VERSION}:${seed}`));
  const item = POOL[Math.floor(rng() * POOL.length)];
  return {
    seed,
    ...item,
    traditionalSystemClaim: false,
    ruleVersion: FORTUNE_RULE_VERSION,
  };
}

export const LOT_POOL_SIZE = POOL.length;
