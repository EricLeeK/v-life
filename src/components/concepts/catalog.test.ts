import { describe, expect, it } from "vitest";
import { conceptCatalog } from "./catalog";

describe("module concept ownership", () => {
  it("does not reuse an illustration between functional areas", () => {
    const owners = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [area, { figure }] of Object.entries(conceptCatalog)) {
      const previous = owners.get(figure);
      if (previous) duplicates.push(`${previous} and ${area} share ${figure}`);
      owners.set(figure, area);
    }
    expect(duplicates).toEqual([]);
  });
});
