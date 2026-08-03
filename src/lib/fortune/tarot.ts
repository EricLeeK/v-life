import { FORTUNE_RULE_VERSION } from "./ruleVersion";
import { hashStringToSeed, mulberry32 } from "./seededRandom";
import { TAROT_CARD_DATA, type TarotCardData } from "./tarotDeckData";

export type TarotCardDef = TarotCardData;

export interface DrawnCard {
  card: TarotCardDef;
  upright: boolean;
  position: "past" | "present" | "advice";
}

export const TAROT_DECK: TarotCardDef[] = TAROT_CARD_DATA;

const POSITIONS: DrawnCard["position"][] = ["past", "present", "advice"];

export function drawTarotSpread(seed: string): { seed: string; cards: DrawnCard[]; ruleVersion: string } {
  const rng = mulberry32(hashStringToSeed(`tarot:${FORTUNE_RULE_VERSION}:${seed}`));
  const indices = TAROT_DECK.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const cards = POSITIONS.map((position, i) => ({
    card: TAROT_DECK[indices[i]],
    upright: rng() >= 0.5,
    position,
  }));
  return { seed, cards, ruleVersion: FORTUNE_RULE_VERSION };
}

export function cardKeywords(card: TarotCardDef, upright: boolean, lang: "zh" | "en"): string {
  if (lang === "en") return upright ? card.keywordsEn : card.keywordsReversedEn;
  return upright ? card.keywordsZh : card.keywordsReversedZh;
}

export function tarotRuleBlurb(cards: DrawnCard[], lang: "zh" | "en"): string {
  if (lang === "en") {
    return (
      cards
        .map(
          (c) =>
            `${c.card.nameEn} (${c.upright ? "upright" : "reversed"}: ${cardKeywords(c.card, c.upright, "en")})`,
        )
        .join(" · ") + ". Take one gentle next step."
    );
  }
  return (
    cards
      .map(
        (c) =>
          `${c.card.nameZh}${c.upright ? "正位" : "逆位"}（${cardKeywords(c.card, c.upright, "zh")}）`,
      )
      .join(" · ") + "。先把今天能做的一小步做完就好。"
  );
}
