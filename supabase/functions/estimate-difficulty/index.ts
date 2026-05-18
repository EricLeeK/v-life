import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_URLS: Record<string, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  custom: "",
};

const SYSTEM_PROMPT = `You are a task difficulty estimator for a personal productivity app. Given a list of task titles, estimate each task's difficulty level.

## Output Format
Return a JSON object with a "results" array. Each element has:
- "title": the original task title
- "difficulty": one of "easy", "medium", "hard"

## Difficulty Tiers

**easy** (base_points: 10)
- Quick tasks under 15 minutes
- Low mental effort, routine actions
- Examples: "买牛奶", "洗碗", "回复邮件", "倒垃圾", "整理桌面"

**medium** (base_points: 20)
- Tasks requiring 15-60 minutes
- Moderate focus or planning needed
- Examples: "写一篇博客", "整理衣柜", "学习一章教材", "做饭", "去银行办事"

**hard** (base_points: 30)
- Tasks over 60 minutes or high cognitive load
- Complex, multi-step, or requiring deep focus
- Examples: "写论文初稿", "准备面试", "完成项目报告", "搬家打包", "学习新框架"

## Rules
1. Output ONLY valid JSON, no markdown, no explanation
2. If a title is ambiguous, lean toward the higher difficulty
3. Consider the verb + object pattern: research/write/prepare/build = harder; buy/clean/reply = easier
4. Cultural context matters: "做饭" in Chinese cooking is medium, "meal prep for the week" is hard

## Example
Input: ["买菜", "写周报", "回复消息"]
Output: {"results":[{"title":"买菜","difficulty":"easy"},{"title":"写周报","difficulty":"medium"},{"title":"回复消息","difficulty":"easy"}]}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { titles } = await req.json();
    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return new Response(
        JSON.stringify({ error: "titles array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "");
    const userSb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminSb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: settings } = await adminSb
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!settings?.ai_api_key) {
      return new Response(
        JSON.stringify({ error: "No AI API key configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platform = settings.ai_platform || "gemini";
    const model = settings.ai_model || "gemini-2.5-flash";
    const baseUrl = settings.ai_base_url || PLATFORM_URLS[platform] || PLATFORM_URLS.openai;
    const apiKey = settings.ai_api_key;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(titles) },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("LLM API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI call failed (${response.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

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

    if (!parsed?.results || !Array.isArray(parsed.results)) {
      return new Response(
        JSON.stringify({ error: "Invalid LLM response", raw: content }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-difficulty error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
