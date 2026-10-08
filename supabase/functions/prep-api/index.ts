import { hashToken } from "../prep-bridge/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executePrepOperation } from "../_shared/prepOperations.ts";
export async function handleRequest(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = (
    Deno.env.get("PREP_ALLOWED_ORIGINS") ||
    "https://shenghuo.homes,http://localhost:5173,http://localhost:8080"
  ).split(",");
  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin)
      ? origin
      : allowed[0],
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Cache-Control": "no-store",
  };
  const response = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  if (origin && !allowed.includes(origin))
    return response({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const authorization = req.headers.get("authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await db.auth.getClaims(
      authorization.replace(/^Bearer\s+/i, ""),
    );
    if (error || !data?.claims?.sub || data.claims.client_id)
      return response({ error: "请使用网页登录账户" }, 401);
    const raw = await req.text();
    if (raw.length > 15_000_000) return response({ error: "请求过大" }, 413);
    const body = JSON.parse(raw);
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (body.action === "connection_create") {
      const token =
        "prep_live_" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      const saved = await admin.rpc("prep_connection_create", {
        p_user_id: data.claims.sub,
        p_hash: await hashToken(token),
      });
      if (saved.error) throw new Error(saved.error.message);
      return response({ data: { token, id: saved.data } });
    }
    const result = await executePrepOperation(
      {
        db,
        admin,
        userId: data.claims.sub,
        permissions: { read: true, write: true, delete: false },
      },
      body.action,
      body.input || {},
    );
    return response({ data: result });
  } catch (e) {
    return response(
      { error: e instanceof Error ? e.message : "操作失败" },
      400,
    );
  }
}
if (import.meta.main) Deno.serve(handleRequest);
