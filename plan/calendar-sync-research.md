# Research: Syncing v-life Schedule with Apple Calendar

Date: 2026-08-14
Goal: Sync `schedule_events` with the user's Apple Calendar (macOS / iOS).

## Current architecture (relevant facts from codebase)

- Data lives in Supabase table `schedule_events` (`src/integrations/supabase/types.ts:1059-1114`):
  `id uuid`, `title`, `start_time`/`end_time` (ISO TIMESTAMPTZ strings), `status`
  (`未开始 | 进行中 | 已完成 | 已取消`), `importance`, `color` (hex), `notes`,
  `recurrence` (custom JSON), `parent_event_id` (materialized series instances).
- Recurrence is NOT RRULE. A master row holds a JSON rule; concrete instances are
  materialized client-side, capped at 12 months / 5000 iterations
  (`src/pages/Schedule.tsx:52-113`). Every instance is a normal row → exporting each
  instance as a standalone `VEVENT` sidesteps RRULE translation entirely.
- No all-day flag; every event has explicit start/end timestamps.
- App is a Vite SPA on Vercel + Supabase backend. No server of our own, but
  **Supabase Edge Functions (Deno)** are the established pattern for holding secrets and
  proxying external APIs (`supabase/functions/ai-chat/index.ts:43-85` — "API keys never
  go to client", per-user credentials read from `settings` with the service-role key).
- All writes go through React Query hooks (`src/hooks/useData.ts:107-233`);
  after any external sync writes, invalidate the `["schedule"]` query key.
- Existing export = JSON backup only (`src/pages/Settings.tsx:143-158`). Zero ICS /
  CalDAV code anywhere today.
- Demo mode is in-memory (`DemoModeContext`) — sync features are for authenticated
  users only.

## Option A — ICS subscription feed (one-way: v-life → Apple Calendar) ✅ recommended

Apple Calendar can subscribe to any HTTPS URL serving iCalendar. It re-fetches on a
user-chosen auto-refresh interval (as often as **every 5 minutes** up to weekly).

### How it works

1. New Edge Function `calendar-feed` (GET) returns `Content-Type: text/calendar`.
2. Feed URL: `https://<project>.supabase.co/functions/v1/calendar-feed?token=<feed-token>`
   — Calendar apps send plain GETs with no headers, so auth must be an unguessable
   per-user token in the query string (random 32+ bytes, stored in `settings`,
   regenerable via a "reset feed link" button).
3. User: Calendar.app → File → New Calendar Subscription → paste URL → set auto-refresh
   to 5 min. Choose the **iCloud** location when subscribing so it propagates to
   iPhone/iPad; iOS can also subscribe directly (Settings → Calendar → Accounts →
   Add Subscribed Calendar).

### Field mapping

| v-life                        | iCalendar                                        |
|-------------------------------|--------------------------------------------------|
| `id`                          | `UID: <id>@v-life` (stable across edits)         |
| `title`                       | `SUMMARY`                                        |
| `start_time` / `end_time`     | `DTSTART` / `DTEND` (convert ISO → iCal UTC)     |
| `status = 已取消`             | `STATUS:CANCELLED`                               |
| `notes`                       | `DESCRIPTION`                                    |
| `importance`                  | `CATEGORIES` (or `DESCRIPTION` prefix)           |
| series instances              | individual `VEVENT`s (already materialized rows) |
| edits/deletes                 | keep UID, bump `SEQUENCE` + `DTSTAMP`            |

- Export window: e.g. −30 days → +12 months (matches instance materialization cap);
  exclude recurrence master rows (`parent_event_id IS NULL AND recurrence IS NOT NULL`
  is the master signature — verify exact filter against `Schedule.tsx:170-180`).
- Support `ETag` / `If-Modified-Since` so conditional re-fetches get cheap 304s.
- Alerts: embed `VALARM` (Apple Calendar generally honors them in subscriptions) or
  let users set a default alert on the subscription.

### Limitations

- Strictly one-way and read-only in Apple Calendar (edits there never flow back).
- Latency bounded by the auto-refresh interval (best case ~5 min).
- Per-event `color` cannot map — Apple colors the whole calendar. Mitigation: prefix
  emoji/tag by importance in `SUMMARY`, or provide multiple feeds by importance.

### Effort

~1–2 days: one edge function, token management in `settings`, a Settings UI card
("subscribe in Apple Calendar" + copy button). No Apple credentials needed at all.

## Option B — CalDAV two-way sync via iCloud (v-life ⇄ Apple Calendar)

True two-way sync against the user's iCloud calendar using CalDAV.

### Mechanics

- Library: **tsdav** (`npm:tsdav`) — JSON-based CalDAV client, explicitly supports
  **Deno** (works inside Supabase Edge Functions).
- Auth: Basic auth to `https://caldav.icloud.com` with **Apple ID + app-specific
  password** (regular passwords rejected; requires 2FA; generate at
  account.apple.com → Sign-In and Security → App-Specific Passwords).
- **CORS blocks all browser-side CalDAV** → must run in an Edge Function, mirroring
  the `ai-chat` secret pattern: app-specific password stored (encrypted) per-user in
  `settings`, read with the service-role key, never sent to the client.

### Sync design

- First run: `createCalendar` (MKCALENDAR) a dedicated **"V-Life" calendar** in iCloud
  so synced events never mix with the user's own calendars and can be wiped cleanly.
- Push: on `schedule_events` CRUD (debounced, or a "Sync now" button), upsert/delete
  `VEVENT`s via `createCalendarObject` / `updateCalendarObject` / `deleteCalendarObject`
  with `UID: <id>@v-life`.
- Pull: scheduled runs (Supabase `pg_cron` → invoke the function, e.g. every 15 min)
  diff etags (`fetchCalendarObjects`), or use tsdav's `syncCalDAVCollection` if the
  server supports RFC 6578 sync tokens. New VEVENTs → insert into `schedule_events`
  (status `未开始`); deletes → remove or mark `已取消`; then invalidate `["schedule"]`.
- Conflicts: last-write-wins comparing `updated_at` vs the VEVENT's `DTSTAMP`;
  document this — CalDAV gives no better primitive without heavy machinery.

### Risks

- Apple periodically tightens CalDAV auth (e.g., the 2025 eM Client "unauthorized"
  wave when app-specific-password enforcement hardened). Expect occasional re-auth;
  personal-scale usage is fine but it is best-effort, not an official server-to-server API.
- Storing the user's Apple credentials means: encrypt at rest, make revocation easy,
  and scope damage by using the dedicated calendar.
- Effort: push-only ~2–4 days; full two-way ~1–2 weeks including conflict handling
  and testing.

## Option C — one-time .ics export/import (fallback, not sync)

Generate a `VCALENDAR` blob client-side from `useScheduleByRange` data and download
it; user does File → Import in Calendar. Events become static copies — no updates.
Trivial (~half a day) but not a real sync; only useful as a stopgap.

## Recommendation

1. **Phase 1 — Option A (ICS feed).** Covers the most common real goal ("see my v-life
   schedule in Apple Calendar / iPhone widgets"), cheapest, zero credential risk.
2. **Phase 2 — CalDAV push-only (v-life → iCloud)** if one-way latency or read-only
   becomes limiting. Gets true writes into iCloud with bounded complexity.
3. **Phase 3 — full two-way** only if editing v-life events from Apple Calendar is a
   hard requirement.

Design rules that apply to all phases: stable `UID`s keyed on row id; never export
recurrence masters (instances already exist as rows); map `已取消` to
`STATUS:CANCELLED`; route all writes through `useCrudHooks` paths + query
invalidation; authenticated users only (demo mode is in-memory).

## Sources

- Apple: Subscribe to calendars on Mac — https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac
- Apple: App-specific passwords — https://support.apple.com/en-us/102654
- tsdav (CalDAV client for JS/Deno) — https://github.com/natelindev/tsdav , docs: https://tsdav.vercel.app/docs/
- iCloud CalDAV connection settings — https://cli.nylas.com/guides/icloud-caldav-settings
- ICS feeds vs real sync — https://calendarbridge.com/blog/ics-icalendar-feeds-vs-real-time-sync-whats-the-difference/
- eM Client iCloud auth enforcement incident — https://forum.emclient.com/t/caldav-and-carddav-icloud-server-suddenly-says-unauthorized-after-working-just-fine-for-years/46145
