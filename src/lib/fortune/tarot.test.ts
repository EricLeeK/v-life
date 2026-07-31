import { describe, expect, it } from "vitest";
import { drawTarotSpread, TAROT_DECK } from "./tarot";

describe("drawTarotSpread", () => {
  it("has 78 cards", () => {
    expect(TAROT_DECK).toHaveLength(78);
  });
  it("reproduces cards from seed", () => {
    const a = drawTarotSpread("seed-1");
    const b = drawTarotSpread("seed-1");
    expect(a.cards).toEqual(b.cards);
    expect(a.cards).toHaveLength(3);
    expect(a.cards[0]).toHaveProperty("upright");
  });
});
