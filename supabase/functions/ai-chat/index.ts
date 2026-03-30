import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map platform names to base URLs
const PLATFORM_URLS: Record<string, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  custom: "",
};

const SYSTEM_PROMPT = `你是 V-Life Manager 的 AI 助手。用户会用自然语言描述他们想要记录的内容，你需要识别意图并返回结构化的操作指令。

支持的模块和操作：
1. **finance** - 记账：{ module: "finance", action: "create", data: { name, amount, currency("CNY"|"JPY"), category("餐饮"|"交通"|"购物"|"住房"|"娱乐"|"医疗"|"教育"|"其他"), date(YYYY-MM-DD), notes? } }
2. **calories** - 热量：{ module: "calories", action: "create", data: { food_name, calories(number), meal_type("breakfast"|"lunch"|"dinner"|"snack"), date(YYYY-MM-DD), notes? } }
3. **schedule** - 日程：{ module: "schedule", action: "create", data: { title, start_time(ISO), end_time(ISO), importance?("紧急"|"重要"|"普通"|"低"), notes? } }
4. **todo** - 待办：{ module: "todo", action: "create", data: { title, category?("工作"|"学习"|"生活"|"健康"|"未分类"), importance?("紧急"|"重要"|"普通"|"低"), detail? } }
5. **pantry** - 食材：{ module: "pantry", action: "create", data: { name, category("新鲜食材"|"冷冻食品"|"调味料"|"饮品"|"零食"|"主食"|"其他"), quantity?, expiry_date?(YYYY-MM-DD), notes? } }
6. **thought** - 随想：{ module: "thought", action: "create", data: { title?, content, tags?[] } }
7. **belongings_daily** - 日用品：{ module: "belongings_daily", action: "create", data: { name, category("洗护"|"清洁"|"厨房"|"文具"|"其他"), notes? } }
8. **belongings_durable** - 耐用品：{ module: "belongings_durable", action: "create", data: { name, category("电子产品"|"家具"|"厨具"|"服饰"|"其他"), purchase_price, purchase_date(YYYY-MM-DD), expected_lifespan_days, notes? } }

规则：
- 一条消息可能包含多个操作（例如"午饭花了30元吃了拉面600卡"→ finance + calories）
- 如果缺少日期，默认使用今天
- 如果缺少时间，日程默认 1 小时
- 金额如果没说币种，默认 CNY
- 回复必须是有效的 JSON 数组，每个元素是一个操作
- 如果无法识别意图，返回 { "type": "chat", "message": "你的回复" }

回复格式：
\`\`\`json
{
  "operations": [...操作数组],
  "summary": "简短的操作摘要，用自然语言描述"
}
\`\`\``;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, session_id } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's AI settings from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await sb.from("settings").select("*").limit(1).single();
    if (!settings?.ai_api_key) {
      return new Response(
        JSON.stringify({ error: "请先在设置页面配置 AI API Key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platform = settings.ai_platform || "gemini";
    const model = settings.ai_model || "gemini-2.5-flash";
    const baseUrl = settings.ai_base_url || PLATFORM_URLS[platform] || PLATFORM_URLS.openai;
    const apiKey = settings.ai_api_key;

    // Call the LLM
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("LLM API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI 调用失败 (${response.status}): ${errText.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let parsed: any = null;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { operations: [], summary: content };
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
