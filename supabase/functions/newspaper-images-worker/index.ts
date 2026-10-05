import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processNewspaperImageJobs } from "../_shared/newspaperImageWorker.ts";

function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const expected = Deno.env.get("NEWSPAPER_WORKER_SECRET");
  if (
    !expected || expected.length < 24 ||
    !sameSecret(req.headers.get("x-newspaper-worker-secret") || "", expected)
  ) return new Response("Unauthorized", { status: 401 });
  try {
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Missing worker configuration");
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stats = await processNewspaperImageJobs(admin);
    return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Image worker unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
});
