-- Calendar subscription feed (Apple Calendar / any ICS client).
-- Per-user secret token that authenticates the calendar-feed edge function
-- (calendar apps send plain GETs with no headers, so the token lives in the URL).
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS calendar_feed_token text;

CREATE UNIQUE INDEX IF NOT EXISTS settings_calendar_feed_token_key
  ON settings (calendar_feed_token)
  WHERE calendar_feed_token IS NOT NULL;
