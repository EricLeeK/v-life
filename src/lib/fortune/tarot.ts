import { hashStringToSeed, mulberry32 } from "./seededRandom";

export interface TarotCardDef {
  id: string;
  nameZh: string;
  nameEn: string;
  suit: string;
  keywordsZh: string;
  keywordsEn: string;
}

export interface DrawnCard {
  card: TarotCardDef;
  upright: boolean;
  position: "past" | "present" | "advice";
}

const MAJORS: Array<[string, string, string]> = [
  ["fool", "愚者", "The Fool"],
  ["magician", "魔术师", "The Magician"],
  ["high_priestess", "女祭司", "The High Priestess"],
  ["empress", "女皇", "The Empress"],
  ["emperor", "皇帝", "The Emperor"],
  ["hierophant", "教皇", "The Hierophant"],
  ["lovers", "恋人", "The Lovers"],
  ["chariot", "战车", "The Chariot"],
  ["strength", "力量", "Strength"],
  ["hermit", "隐者", "The Hermit"],
  ["wheel", "命运之轮", "Wheel of Fortune"],
  ["justice", "正义", "Justice"],
  ["hanged", "倒吊人", "The Hanged Man"],
  ["death", "死神", "Death"],
  ["temperance", "节制", "Temperance"],
  ["devil", "恶魔", "The Devil"],
  ["tower", "高塔", "The Tower"],
  ["star", "星星", "The Star"],
  ["moon", "月亮", "The Moon"],
  ["sun", "太阳", "The Sun"],
  ["judgement", "审判", "Judgement"],
  ["world", "世界", "The World"],
];

const MINOR_RANKS: Array<[string, string, string]> = [
  ["ace", "王牌", "Ace"],
  ["2", "二", "Two"],
  ["3", "三", "Three"],
  ["4", "四", "Four"],
  ["5", "五", "Five"],
  ["6", "六", "Six"],
  ["7", "七", "Seven"],
  ["8", "八", "Eight"],
  ["9", "九", "Nine"],
  ["10", "十", "Ten"],
  ["page", "侍从", "Page"],
  ["knight", "骑士", "Knight"],
  ["queen", "王后", "Queen"],
  ["king", "国王", "King"],
];

const SUITS: Array<[string, string, string]> = [
  ["wands", "权杖", "Wands"],
  ["cups", "圣杯", "Cups"],
  ["swords", "宝剑", "Swords"],
  ["pentacles", "星币", "Pentacles"],
];

function buildDeck(): TarotCardDef[] {
  const deck: TarotCardDef[] = MAJORS.map(([id, zh, en]) => ({
    id,
    nameZh: zh,
    nameEn: en,
    suit: "major",
    keywordsZh: "转折与启示",
    keywordsEn: "turning point",
  }));
  for (const [sid, szh, sen] of SUITS) {
    for (const [rid, rzh, ren] of MINOR_RANKS) {
      deck.push({
        id: `${sid}_${rid}`,
        nameZh: `${szh}${rzh}`,
        nameEn: `${ren} of ${sen}`,
        suit: sid,
        keywordsZh: "日常节奏",
        keywordsEn: "daily rhythm",
      });
    }
  }
  return deck;
}

export const TAROT_DECK = buildDeck();

const POSITIONS: DrawnCard["position"][] = ["past", "present", "advice"];

export function drawTarotSpread(seed: string): { seed: string; cards: DrawnCard[] } {
  const rng = mulberry32(hashStringToSeed(`tarot:${seed}`));
  const indices = TAROT_DECK.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const cards = POSITIONS.map((position, i) => ({
    card: TAROT_DECK[indices[i]],
    upright: rng() > 0.5,
    position,
  }));
  return { seed, cards };
}

export function tarotRuleBlurb(cards: DrawnCard[], lang: "zh" | "en"): string {
  if (lang === "en") {
    return cards
      .map((c) => `${c.card.nameEn} (${c.upright ? "upright" : "reversed"})`)
      .join(" · ") + ". Take one gentle next step.";
  }
  return (
    cards.map((c) => `${c.card.nameZh}${c.upright ? "正位" : "逆位"}`).join(" · ") +
    "。先把今天能做的一小步做完就好。"
  );
}
