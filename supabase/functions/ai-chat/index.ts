import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonError,
  recordHostedUsage,
  resolveAiCredentials,
} from "../_shared/hostedAi.ts";
import { buildSystemPrompt, moduleByKey } from "../_shared/moduleRegistry.ts";
import { listModuleRecords, getTodayPlan, MODULE_KEYS } from "../_shared/dataReader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = buildSystemPrompt();

const FORTUNE_SYSTEM_PROMPT = `你是温柔的生活向运势助手。用户消息里的 facts 是今日参考资料（星座日运、黄历、月相、生肖关系、分数等），供你理解今日氛围后再自己组织文案。
请据此自由写 80–150 字鼓励向短文；不必逐项点名或罗列资料里的字段，读起来像一段自然的话即可。
禁止恐吓、诅咒、绝对化断言。不做医疗或投资建议。用用户消息指定的语言回复。
结尾可加「仅供娱乐」或 “For entertainment only”。
只输出纯文本，不要 JSON，不要 markdown 代码块。`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, session_id, mode } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFortune = mode === "fortune";
    const isNote = mode === "note";
    const isPlainText = isFortune || isNote;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the user via their JWT
    const authHeader = req.headers.get("authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "");
    const userSb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "未授权，请先登录" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to read settings / entitlements (API keys never go to client)
    const adminSb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: settings } = await adminSb
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const hasImage = messages.some((m: any) =>
      Array.isArray(m.content) &&
      m.content.some((part: any) =>
        part.type === "image_url" || part.type === "image" || part.type === "input_image"
      )
    );

    const resolved = await resolveAiCredentials(adminSb, user.id, settings, hasImage);
    if (!resolved.ok) {
      return jsonError(resolved.code, resolved.message, resolved.status, corsHeaders);
    }
    const { apiKey, model, baseUrl } = resolved.creds;

    // Inject today's date into the last user message for context (agent/fortune only)
    const today = new Date().toISOString().split("T")[0];
    const enrichedMessages = isNote
      ? messages
      : messages.map((m: any, i: number) => {
          if (i === messages.length - 1 && m.role === "user") {
            if (Array.isArray(m.content)) {
              const parts = m.content.map((part: any, pi: number) => {
                if (part.type === "text" && pi === 0) {
                  return { ...part, text: `[当前日期: ${today}] ${part.text}` };
                }
                return part;
              });
              return { ...m, content: parts };
            }
            return { ...m, content: `[当前日期: ${today}] ${m.content}` };
          }
          return m;
        });

    const systemPrompt = isFortune ? FORTUNE_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const dayStartHour = Number(settings?.day_start_hour) || 0;

    // ── ReAct tools (non-fortune only) ──────────────────────────────
    const agentTools = isPlainText ? null : [
      {
        type: "function" as const,
        function: {
          name: "read_data",
          description: "读取用户的生活数据（任意模块）。需要查询/统计/核对/推荐/匹配待办时调用。返回 JSON 数组。",
          parameters: {
            type: "object",
            required: ["module"],
            properties: {
              module: { type: "string", enum: MODULE_KEYS, description: "模块 key（见系统提示模块定义）" },
              date_from: { type: "string", description: "起始日期 YYYY-MM-DD" },
              date_to: { type: "string", description: "结束日期 YYYY-MM-DD" },
              filters: { type: "object", description: "字段→值模糊匹配，如 {category:'餐饮','is_completed':false}" },
              limit: { type: "number", description: "返回条数，默认50，最大200" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_today_plan",
          description: "读取今天已规划的任务（今日待办，含标题），用于查看今日安排/避免重复加入。",
          parameters: { type: "object", properties: {} },
        },
      },
    ];

    // Execute a single tool call server-side (RLS-scoped via userSb).
    async function runTool(name: string, args: any): Promise<string> {
      try {
        if (name === "read_data") {
          const r = await listModuleRecords(userSb, args.module, {
            date_from: args.date_from, date_to: args.date_to, filters: args.filters, limit: args.limit,
          });
          return r.error ? JSON.stringify({ error: r.error }) : JSON.stringify(r.data);
        }
        if (name === "get_today_plan") {
          const r = await getTodayPlan(userSb, dayStartHour);
          return r.error ? JSON.stringify({ error: r.error }) : JSON.stringify(r.data);
        }
        return JSON.stringify({ error: `unknown tool: ${name}` });
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
      }
    }

    // One LLM turn. withTools controls whether tools (and response_format) are sent.
    async function chatOnce(msgs: any[], withTools: boolean): Promise<any> {
      const body: Record<string, unknown> = {
        model,
        messages: msgs,
        temperature: isFortune ? 0.7 : 0.1,
      };
      if (withTools && agentTools) {
        body.tools = agentTools;
      } else if (!isPlainText) {
        // force JSON only on agent turns — some providers reject tools+response_format together
        body.response_format = { type: "json_object" };
      }
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error("LLM API error:", resp.status, errText);
        const e: any = new Error(`UPSTREAM ${resp.status}`);
        e.status = resp.status;
        e.upstream = errText;
        throw e;
      }
      return await resp.json();
    }

    const baseMessages = isNote
      ? [...enrichedMessages]
      : [{ role: "system", content: systemPrompt }, ...enrichedMessages];

    let result: any;
    if (isPlainText) {
      result = await chatOnce(baseMessages, false);
    } else {
      // ── Agent loop (max 6 turns; last turn forced without tools) ──
      const agentMessages = [...baseMessages];
      result = null;
      let forceSingleShot = false;
      try {
        for (let step = 0; step < 6; step++) {
          const forceFinal = step === 5;
          const r = await chatOnce(agentMessages, !forceFinal);
          result = r;
          const msg = r.choices?.[0]?.message;
          const toolCalls = msg?.tool_calls;
          if (toolCalls && toolCalls.length > 0 && !forceFinal) {
            agentMessages.push(msg); // assistant turn carrying tool_calls
            for (const tc of toolCalls) {
              const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
              agentMessages.push({ role: "tool", tool_call_id: tc.id, content: await runTool(tc.function?.name, args) });
            }
            continue;
          }
          break; // final answer
        }
      } catch (e: any) {
        // Graceful degrade: if the provider rejected the tools payload, retry once
        // as a plain single-shot JSON turn (drops any tool messages).
        if (agentTools && !forceSingleShot && (e?.status === 400 || e?.status === 404)) {
          console.warn("agent tools rejected by upstream; degrading to single-shot JSON");
          forceSingleShot = true;
          result = await chatOnce(baseMessages, false);
        } else {
          return jsonError("UPSTREAM_ERROR", `AI 服务暂时不可用 (${e?.status ?? "error"})`, 502, corsHeaders);
        }
      }
    }

    let content = result?.choices?.[0]?.message?.content || "";

    if (resolved.creds.mode === "hosted") {
      await recordHostedUsage(adminSb, {
        userId: user.id,
        functionName: isNote ? "ai-chat-note" : isFortune ? "ai-chat-fortune" : "ai-chat",
        model,
        usage: result.usage,
        estimateFrom: content,
      });
    }

    if (isFortune || isNote) {
      return new Response(JSON.stringify({ content, mode: isNote ? "note" : "fortune" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content.trim());
    } catch {
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        }
      } catch { /* ignore */ }
    }

    if (!parsed || typeof parsed !== "object") {
      parsed = { operations: [], summary: content.slice(0, 500) };
    }

    if (!Array.isArray(parsed.operations)) {
      parsed.operations = [];
    }

    // ── Read-op rescue ──────────────────────────────────────────────
    // Some models misroute data reads into the operations array (action:"read_data"
    // / module:"read_data") instead of calling the read tools. When that happens,
    // fulfill those reads server-side and re-prompt once so the model can answer
    // with REAL data. Works regardless of whether the model tool-calls reliably.
    if (!isFortune) {
      const READ_ACTIONS = new Set(["read", "read_data", "list", "query", "search", "get", "fetch", "find"]);
      const readOps = (parsed.operations || []).filter((op: any) =>
        READ_ACTIONS.has(String(op?.action || "").toLowerCase()) ||
        op?.module === "read_data" || op?.module === "get_today_plan"
      );
      if (readOps.length > 0) {
        const findings: string[] = [];
        for (const op of readOps) {
          try {
            if (op.module === "get_today_plan") {
              const r = await getTodayPlan(userSb, dayStartHour);
              findings.push(`get_today_plan → ${r.error ? "error: " + r.error : JSON.stringify(r.data)}`);
            } else {
              const mod = op.data?.module || op.module;
              if (mod && moduleByKey[mod]) {
                const r = await listModuleRecords(userSb, mod, op.data || {});
                findings.push(`read_data(${mod}) → ${r.error ? "error: " + r.error : JSON.stringify(r.data)}`);
              }
            }
          } catch (e) {
            findings.push(`read error: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        try {
          const r2 = await chatOnce(
            [
              ...baseMessages,
              { role: "assistant", content },
              {
                role: "user",
                content:
                  "你刚才把「读取数据」放进了 operations（系统不支持把读取当操作执行）。已代你读取到以下真实数据：\n" +
                  findings.join("\n") +
                  "\n\n请基于这些真实数据重新回答用户：查询/统计/推荐类把答案写在 summary（operations 留空数组 []）；只有真正要新增/修改/删除记录时才输出 create/update/delete 操作。仍只输出纯 JSON。",
              },
            ],
            false,
          );
          const c2 = r2?.choices?.[0]?.message?.content || "";
          let p2: any = null;
          try {
            p2 = JSON.parse(c2.trim());
          } catch {
            const m = c2.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (m) p2 = JSON.parse(m[1].trim());
          }
          if (p2 && typeof p2 === "object") {
            parsed = p2;
            if (!Array.isArray(parsed.operations)) parsed.operations = [];
            content = c2; // reflect the corrected answer in raw
          }
        } catch {
          // keep the original parsed answer if the rescue turn fails
        }
      }
    }

    return new Response(JSON.stringify({ result: parsed, raw: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
