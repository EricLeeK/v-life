import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  buildVeventLines,
  escapeIcalText,
  isExportableEvent,
  toIcalUtc,
} from "./icsCalendar";

const NOW = "2026-08-14T00:00:00.000Z";

describe("escapeIcalText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeIcalText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("normalizes CRLF and CR to the literal \\n escape", () => {
    expect(escapeIcalText("a\r\nb\rc")).toBe("a\\nb\\nc");
  });

  it("returns empty string for null-ish input", () => {
    expect(escapeIcalText(null as any)).toBe("");
    expect(escapeIcalText(undefined as any)).toBe("");
  });
});

describe("toIcalUtc", () => {
  it("converts a UTC ISO timestamp to iCal basic format", () => {
    expect(toIcalUtc("2026-08-14T09:05:00.000Z")).toBe("20260814T090500Z");
  });

  it("converts an offset timestamp to UTC", () => {
    expect(toIcalUtc("2026-08-14T17:00:00+08:00")).toBe("20260814T090000Z");
  });

  it("returns null for invalid timestamps", () => {
    expect(toIcalUtc("not-a-date")).toBeNull();
    expect(toIcalUtc("")).toBeNull();
  });
});

describe("isExportableEvent", () => {
  it("keeps normal events and series instances", () => {
    expect(isExportableEvent({ recurrence: null, parent_event_id: null })).toBe(true);
    expect(isExportableEvent({ recurrence: { type: "weekly" }, parent_event_id: "master-1" })).toBe(true);
  });

  it("drops recurrence masters (mirrors the Schedule page filter)", () => {
    expect(isExportableEvent({ recurrence: { type: "weekly", interval: 1 }, parent_event_id: null })).toBe(false);
  });

  it("keeps events whose recurrence rule is none", () => {
    expect(isExportableEvent({ recurrence: { type: "none" }, parent_event_id: null })).toBe(true);
  });
});

describe("buildVeventLines", () => {
  const base = {
    id: "6f0c8e9a",
    title: "团队周会",
    start_time: "2026-08-14T09:00:00.000Z",
    end_time: "2026-08-14T10:00:00.000Z",
    status: "未开始",
    importance: "重要",
    notes: "带笔记本",
    updated_at: "2026-08-13T08:00:00.000Z",
  };

  it("emits a complete unfolded VEVENT", () => {
    expect(buildVeventLines(base, NOW)).toEqual([
      "BEGIN:VEVENT",
      "UID:6f0c8e9a@v-life",
      "DTSTAMP:20260813T080000Z",
      "DTSTART:20260814T090000Z",
      "DTEND:20260814T100000Z",
      "SUMMARY:团队周会",
      "STATUS:CONFIRMED",
      "CATEGORIES:重要",
      "DESCRIPTION:带笔记本",
      "END:VEVENT",
    ]);
  });

  it("maps 已取消 to STATUS:CANCELLED", () => {
    const lines = buildVeventLines({ ...base, status: "已取消" }, NOW);
    expect(lines).toContain("STATUS:CANCELLED");
  });

  it("falls back to now for DTSTAMP when updated_at is unusable", () => {
    const lines = buildVeventLines({ ...base, updated_at: null }, NOW);
    expect(lines).toContain(`DTSTAMP:${toIcalUtc(NOW)}`);
  });

  it("escapes text fields", () => {
    const lines = buildVeventLines({ ...base, title: "a,b;c" }, NOW);
    expect(lines).toContain("SUMMARY:a\\,b\\;c");
  });
});

describe("buildCalendar", () => {
  const events = [
    {
      id: "ev-1",
      title: "晨跑",
      start_time: "2026-08-14T01:00:00.000Z",
      end_time: "2026-08-14T01:30:00.000Z",
      status: "未开始",
    },
    {
      id: "ev-2",
      title: "过期占位,不重要",
      start_time: "2026-08-01T01:00:00.000Z",
      end_time: "2026-08-01T02:00:00.000Z",
      status: "已取消",
      updated_at: "2026-07-30T00:00:00.000Z",
    },
  ];

  it("wraps events in a VCALENDAR envelope with CRLF line endings", () => {
    const ics = buildCalendar(events, { nowIso: NOW });
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("PRODID:-//V-Life//Schedule Feed//EN");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("SUMMARY:晨跑");
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });

  it("folds long lines at 75 octets without splitting multibyte characters", () => {
    const longTitle = "超".repeat(60); // 180 UTF-8 bytes — forces folding
    const ics = buildCalendar(
      [{ id: "ev-long", title: longTitle, start_time: "2026-08-14T01:00:00Z", end_time: "2026-08-14T02:00:00Z" }],
      { nowIso: NOW },
    );
    const encoded = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoded.encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.split("\r\n ").join("").split("\r\n");
    expect(unfolded).toContain(`SUMMARY:${longTitle}`);
  });

  it("skips events with invalid timestamps", () => {
    const ics = buildCalendar(
      [
        { id: "bad", title: "x", start_time: "oops", end_time: "2026-08-14T02:00:00Z" },
        { id: "good", title: "y", start_time: "2026-08-14T01:00:00Z", end_time: "2026-08-14T02:00:00Z" },
      ],
      { nowIso: NOW },
    );
    expect(ics).toContain("UID:good@v-life");
    expect(ics).not.toContain("UID:bad@v-life");
  });
});
