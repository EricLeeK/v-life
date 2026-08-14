// ICS subscription feed for Apple Calendar / any iCalendar client.
// Auth: per-user feed token in the URL query (calendar apps send plain GETs
// with no headers), resolved to its owner via the service-role client.
// Deploy with --no-verify-jwt: callers are calendar apps, not logged-in users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCalendar, isExportableEvent } from "../_shared/icsCalendar.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

const DAY_MS = 24 * 60 * 60 * 1000;

function respond(body: string, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, { status, headers: { ...corsHeaders, ...extra } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return respond("method not allowed", 405, { Allow: "GET, HEAD" });
  }

  try {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
      return respond("calendar feed not found", 404);
    }

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings, error: settingsError } = await adminSb
      .from("settings")
      .select("user_id")
      .eq("calendar_feed_token", token)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.user_id) {
      return respond("calendar feed not found", 404);
    }

    // Past month for context, one year ahead — recurrence instances are
    // materialized at most 12 months out, so this covers every stored event.
    const now = new Date();
    const from = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    const to = new Date(now.getTime() + 366 * DAY_MS).toISOString();

    const { data: events, error: eventsError } = await adminSb
      .from("schedule_events")
      .select(
        "id, title, start_time, end_time, status, importance, notes, recurrence, parent_event_id, updated_at",
      )
      .eq("user_id", settings.user_id)
      .gte("end_time", from)
      .lte("start_time", to)
      .order("start_time", { ascending: true })
      .limit(5000);
    if (eventsError) throw eventsError;

    const exportable = (events ?? []).filter((e: any) =>
      isExportableEvent({ recurrence: e.recurrence, parent_event_id: e.parent_event_id })
    );

    // Any create/update/delete in the window changes count or max(updated_at),
    // so this pair is a sufficient validator for conditional refreshes.
    let maxUpdated = "";
    for (const e of exportable) {
      if (String(e.updated_at) > maxUpdated) maxUpdated = String(e.updated_at);
    }
    const etag = `"vlife-${exportable.length}-${maxUpdated}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ...corsHeaders, ETag: etag } });
    }

    const ics = buildCalendar(exportable, { name: "V-Life Schedule" });
    return respond(ics, 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="v-life.ics"',
      "Cache-Control": "public, max-age=300",
      ETag: etag,
    });
  } catch (e) {
    console.error("calendar-feed error:", e);
    return respond("calendar feed error", 500);
  }
});
