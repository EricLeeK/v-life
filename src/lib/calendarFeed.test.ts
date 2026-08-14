import { describe, expect, it } from "vitest";
import { buildFeedUrl, buildWebcalUrl, generateFeedToken } from "@/lib/calendarFeed";

describe("generateFeedToken", () => {
  it("produces a 43-char base64url token (32 bytes of entropy)", () => {
    const token = generateFeedToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces a different token on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateFeedToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("buildFeedUrl", () => {
  it("builds the calendar-feed function URL with the token", () => {
    expect(buildFeedUrl("https://abcdefgh.supabase.co", "tok123")).toBe(
      "https://abcdefgh.supabase.co/functions/v1/calendar-feed?token=tok123",
    );
  });

  it("tolerates a trailing slash on the base URL", () => {
    expect(buildFeedUrl("https://abcdefgh.supabase.co/", "tok123")).toBe(
      "https://abcdefgh.supabase.co/functions/v1/calendar-feed?token=tok123",
    );
  });
});

describe("buildWebcalUrl", () => {
  it("converts an https feed URL to the webcal scheme so Apple devices auto-open Calendar", () => {
    expect(
      buildWebcalUrl("https://abcdefgh.supabase.co/functions/v1/calendar-feed?token=tok123"),
    ).toBe("webcal://abcdefgh.supabase.co/functions/v1/calendar-feed?token=tok123");
  });

  it("returns non-https URLs unchanged", () => {
    expect(buildWebcalUrl("webcal://x.example.com/feed")).toBe("webcal://x.example.com/feed");
    expect(buildWebcalUrl("http://x.example.com/feed")).toBe("http://x.example.com/feed");
  });
});
