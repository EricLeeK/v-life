import { hashStringToSeed, mulberry32, pickN } from "./seededRandom";

const YI = [
  "学习", "会友", "整理", "运动", "写作", "规划", "散步", "烹饪",
  "休息", "阅读", "沟通", "小憩", "复盘", "理财记账", "早睡", "喝茶",
  "散步晒太阳", "整理桌面", "温和表达", "专注一件事",
];

const JI = [
  "冲动决策", "熬夜", "过度比较", "空耗刷手机", "逞强争论",
  "大额冲动消费", "拖延关键事", "忽视休息", "闷着不说", "同时开太多任务",
];

export interface AlmanacDay {
  yi: string[];
  ji: string[];
  chongsha: string;
}

export function getAlmanacForDate(isoDate: string): AlmanacDay {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { yi: ["平日行事"], ji: ["无"], chongsha: "" };
  }
  const rng = mulberry32(hashStringToSeed(`almanac:${isoDate}`));
  const yiCount = 2 + Math.floor(rng() * 2);
  const jiCount = 1 + Math.floor(rng() * 2);
  const yi = pickN(YI, yiCount, rng);
  const ji = pickN(JI, jiCount, rng);
  if (yi.length === 0) return { yi: ["平日行事"], ji: ["无"], chongsha: "" };
  const animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
  const chong = animals[Math.floor(rng() * animals.length)];
  return {
    yi,
    ji,
    chongsha: `冲${chong}`,
  };
}
