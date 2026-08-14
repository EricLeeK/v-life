// RFC 5545 (iCalendar) serialization for the schedule feed.
// Pure module — zero imports — shared by the calendar-feed Supabase Edge
// Function (Deno) and the web client's vitest suite.

export type IcsFeedEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status?: string | null;
  importance?: string | null;
  notes?: string | null;
  updated_at?: string | null;
};

const encoder = new TextEncoder();

export function escapeIcalText(text: string | null | undefined): string {
  if (text == null) return "";
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([\\;,])/g, "\\$1")
    .replace(/\n/g, "\\n");
}

export function toIcalUtc(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split(".")[0].replace(/[:-]/g, "") + "Z";
}

// Mirror of the Schedule page display filter (Schedule.tsx displayEvents):
// recurrence masters are represented by their materialized instances.
export function isExportableEvent(e: { recurrence?: unknown; parent_event_id?: string | null }): boolean {
  const rec = e.recurrence as { type?: string } | null;
  if (rec && !e.parent_event_id && rec.type !== "none") return false;
  return true;
}

export function buildVeventLines(e: IcsFeedEvent, nowIso: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${e.id}@v-life`,
    `DTSTAMP:${toIcalUtc(e.updated_at) ?? toIcalUtc(nowIso) ?? ""}`,
    `DTSTART:${toIcalUtc(e.start_time)}`,
    `DTEND:${toIcalUtc(e.end_time)}`,
    `SUMMARY:${escapeIcalText(e.title)}`,
    `STATUS:${e.status === "已取消" ? "CANCELLED" : "CONFIRMED"}`,
  ];
  if (e.importance) lines.push(`CATEGORIES:${escapeIcalText(e.importance)}`);
  if (e.notes) lines.push(`DESCRIPTION:${escapeIcalText(e.notes)}`);
  lines.push("END:VEVENT");
  return lines;
}

// RFC 5545 §3.1: fold at 75 octets; continuation lines start with one space,
// which counts toward their own limit. Fold on code-point boundaries so
// multibyte (Chinese) characters are never split.
function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (currentBytes + size > 75) {
      out.push(current);
      current = " ";
      currentBytes = 1;
    }
    current += ch;
    currentBytes += size;
  }
  out.push(current);
  return out.join("\r\n");
}

export function buildCalendar(
  events: IcsFeedEvent[],
  opts: { nowIso?: string; name?: string } = {},
): string {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//V-Life//Schedule Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(opts.name ?? "V-Life Schedule")}`,
    "X-WR-CALDESC:V-Life schedule feed (read-only)",
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M",
  ];
  const body = events
    .filter((e) => toIcalUtc(e.start_time) && toIcalUtc(e.end_time))
    .flatMap((e) => buildVeventLines(e, nowIso));
  return [...header, ...body, "END:VCALENDAR"].map(foldLine).join("\r\n");
}
