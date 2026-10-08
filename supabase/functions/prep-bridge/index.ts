import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { submitPrepAttempt } from "../_shared/prepService.ts";
export async function hashToken(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function handleRequest(req: Request) {
  const reply = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const token =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!/^prep_live_[0-9a-f]{64}$/.test(token))
      return reply({ error: "INVALID_CONNECTION" }, 401);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: userId, error } = await admin.rpc("prep_connection_resolve", {
      p_hash: await hashToken(token),
    });
    if (error || !userId) return reply({ error: "CONNECTION_REVOKED" }, 401);
    const raw = await req.text();
    if (raw.length > 2_000_000)
      return reply({ error: "REQUEST_TOO_LARGE" }, 413);
    const { action, input = {} } = JSON.parse(raw);
    const check = (r: any) => {
      if (r.error) throw new Error(r.error.message);
      return r.data;
    };
    if (action === "submit_attempt")
      return reply({ data: await submitPrepAttempt(admin, userId, input) });
    if (action === "edit_question")
      return reply({
        data: check(
          await admin.rpc("prep_bridge_edit", {
            p_user_id: userId,
            p_id: input.id,
            p_revision: input.expected_revision,
            p_patch: input.record,
          }),
        ),
      });
    const assetUrl = async (a: any) => {
      if (a.storage_path) {
        if (!a.storage_path.startsWith(`${userId}/`))
          throw new Error("INVALID_ASSET_OWNER");
        const result = check(
          await admin.storage
            .from("prep-assets")
            .createSignedUrl(a.storage_path, 3600),
        );
        return { id: a.id, url: result.signedUrl };
      }
      return { id: a.id, url: a.url };
    };
    if (action === "asset_url")
      return reply({
        data: await assetUrl(
          check(
            await admin
              .from("prep_assets")
              .select("*")
              .eq("id", input.id)
              .eq("user_id", userId)
              .single(),
          ),
        ),
      });
    if (action === "snapshot") {
      // Stable order and explicit pagination prevent silently truncating a large library.
      const readAll = async (table: string) => {
        const rows: any[] = [];
        for (let offset = 0; ; offset += 500) {
          const page = check(
            await admin
              .from(table)
              .select("*")
              .eq("user_id", userId)
              .order("id")
              .range(offset, offset + 499),
          );
          rows.push(...page);
          if (page.length < 500) break;
        }
        return rows;
      };
      const [questions, materials, states, assets, noteLinks] =
        await Promise.all(
          [
            "prep_questions",
            "prep_materials",
            "prep_review_states",
            "prep_assets",
            "prep_note_links",
          ].map(readAll),
        );
      return reply({
        data: {
          questions,
          materials,
          states,
          assets: await Promise.all(assets.map(assetUrl)),
          noteLinks,
        },
      });
    }
    return reply({ error: "ACTION_NOT_ALLOWED" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "BRIDGE_UNAVAILABLE";
    const conflict = /revision conflict|CONFLICT/.test(message);
    return reply(
      { error: message, code: conflict ? "CONTENT_CONFLICT" : "BRIDGE_ERROR" },
      conflict ? 409 : 400,
    );
  }
}
if (import.meta.main) Deno.serve(handleRequest);
