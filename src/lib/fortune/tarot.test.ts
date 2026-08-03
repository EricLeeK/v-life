import { describe, expect, it } from "vitest";
import { cardKeywords, drawTarotSpread, TAROT_DECK } from "./tarot";

describe("tarot deck", () => {
  it("has 78 cards with PD keywords", () => {
    expect(TAROT_DECK).toHaveLength(78);
    const fool = TAROT_DECK.find((c) => c.id === "fool");
    expect(fool?.keywordsEn.toLowerCase()).toContain("folly");
    expect(fool?.keywordsReversedEn).toBeTruthy();
  });
});

describe("drawTarotSpread", () => {
  it("draws 3 unique cards deterministically", () => {
    const a = drawTarotSpread("seed-1");
    const b = drawTarotSpread("seed-1");
    expect(a.cards).toHaveLength(3);
    expect(a).toEqual(b);
    const ids = a.cards.map((c) => c.card.id);
    expect(new Set(ids).size).toBe(3);
    expect(cardKeywords(a.cards[0].card, a.cards[0].upright, "en").length).toBeGreaterThan(0);
  });
});
