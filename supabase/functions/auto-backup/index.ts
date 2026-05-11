import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "pantry_items", "belongings_daily", "belongings_durable",
  "schedule_events", "calorie_records", "finance_records",
  "todos", "thoughts", "learning_courses", "learning_notes", "settings"
];

const MAX_BACKUPS = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Export all data
    const exportData: Record<string, any> = {};
    for (const table of TABLES) {
      const { data, error } = await sb.from(table).select("*");
      if (error) {
        console.error(`Error reading ${table}:`, error);
        exportData[table] = [];
      } else {
        exportData[table] = data;
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup-${timestamp}.json`;
    const jsonBlob = JSON.stringify(exportData, null, 2);
    const encoder = new TextEncoder();
    const fileData = encoder.encode(jsonBlob);

    // Upload to storage
    const { error: uploadError } = await sb.storage
      .from("backups")
      .upload(fileName, fileData, {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // List existing backups and clean up old ones
    const { data: files } = await sb.storage.from("backups").list("", {
      sortBy: { column: "created_at", order: "desc" },
    });

    if (files && files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS).map((f) => f.name);
      if (toDelete.length > 0) {
        await sb.storage.from("backups").remove(toDelete);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        size: fileData.length,
        tablesExported: TABLES.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
