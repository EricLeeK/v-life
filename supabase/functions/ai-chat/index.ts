import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_URLS: Record<string, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  custom: "",
};

const SYSTEM_PROMPT = `你是 V-Life Manager 的数据操作助手。你的唯一职责是将用户的自然语言转换为结构化 JSON 操作指令。

## 严格输出规则
1. 你的回复必须是且仅是一个合法的 JSON 对象，不得包含任何其他文字、解释、markdown 代码块标记或前后缀
2. 禁止输出 \`\`\`json 或 \`\`\` 等标记
3. 禁止在 JSON 前后添加任何自然语言文字
4. 如果无法识别用户意图，仍然返回 JSON，使用 chat 类型

## 输出格式
{
  "operations": [<操作对象数组>],
  "summary": "<用一句中文简要描述执行了什么操作>"
}

## 支持的操作类型（action）
- "create" — 新增记录
- "update" — 修改记录（需要用户提供足够信息定位记录）
- "delete" — 删除记录（需要用户提供足够信息定位记录）

## 模块定义与字段规范

### 1. finance（记账）
create: { module: "finance", action: "create", data: { name: string, amount: number, currency: "CNY"|"JPY", category: "餐饮"|"日用"|"交通"|"住房"|"通讯/订阅"|"医疗"|"服饰"|"娱乐"|"学习"|"电子"|"大额"|"其他", date: "YYYY-MM-DD", notes?: string } }
update: { module: "finance", action: "update", data: { match: { name?: string, date?: string, amount?: number }, update: { name?: string, amount?: number, currency?: string, category?: string, notes?: string } } }
delete: { module: "finance", action: "delete", data: { match: { name?: string, date?: string, amount?: number } } }

### 2. calories（热量记录）
create: { module: "calories", action: "create", data: { food_name: string, calories: number, meal_type: "breakfast"|"lunch"|"dinner"|"snack", date: "YYYY-MM-DD", notes?: string } }
update: { module: "calories", action: "update", data: { match: { food_name?: string, date?: string, meal_type?: string }, update: { food_name?: string, calories?: number, meal_type?: string, notes?: string } } }
delete: { module: "calories", action: "delete", data: { match: { food_name?: string, date?: string, meal_type?: string } } }

### 3. schedule（日程）
create: { module: "schedule", action: "create", data: { title: string, start_time: "ISO8601", end_time: "ISO8601", importance?: "紧急"|"重要"|"普通"|"低", notes?: string } }
update: { module: "schedule", action: "update", data: { match: { title?: string, date?: string }, update: { title?: string, start_time?: string, end_time?: string, importance?: string, status?: string, notes?: string } } }
delete: { module: "schedule", action: "delete", data: { match: { title?: string, date?: string } } }

### 4. todo（待办事项）
create: { module: "todo", action: "create", data: { title: string, category?: "工作"|"学习"|"学业"|"生活"|"健康"|"未分类", importance?: "紧急"|"重要"|"普通"|"低", detail?: string } }
update: { module: "todo", action: "update", data: { match: { title?: string }, update: { is_completed?: boolean, title?: string, importance?: string, category?: string, detail?: string } } }
delete: { module: "todo", action: "delete", data: { match: { title?: string } } }

### 5. pantry（食材管理）
create: { module: "pantry", action: "create", data: { name: string, category: "新鲜食材"|"冷冻食品"|"调料"|"饮品"|"零食"|"主食/干货"|"其他", quantity?: string, expiry_date?: "YYYY-MM-DD", notes?: string } }
update: { module: "pantry", action: "update", data: { match: { name?: string }, update: { quantity?: string, expiry_date?: string, category?: string, notes?: string } } }
delete: { module: "pantry", action: "delete", data: { match: { name?: string } } }

### 6. thought（随想笔记）
create: { module: "thought", action: "create", data: { title?: string, content: string, tags?: string[] } }
update: { module: "thought", action: "update", data: { match: { title?: string }, update: { title?: string, content?: string, tags?: string[] } } }
delete: { module: "thought", action: "delete", data: { match: { title?: string } } }

### 7. belongings_daily（日用消耗品）
create: { module: "belongings_daily", action: "create", data: { name: string, category: "洗护"|"清洁"|"厨房"|"文具"|"其他", purchase_date?: "YYYY-MM-DD", notes?: string } }
delete: { module: "belongings_daily", action: "delete", data: { match: { name?: string } } }

### 8. belongings_durable（耐用品）
create: { module: "belongings_durable", action: "create", data: { name: string, category: "电子产品"|"家电"|"家具"|"交通工具"|"其他", purchase_price: number, purchase_date: "YYYY-MM-DD", expected_lifespan_days: number, notes?: string } }
update: { module: "belongings_durable", action: "update", data: { match: { name?: string }, update: { purchase_price?: number, expected_lifespan_days?: number, notes?: string } } }
delete: { module: "belongings_durable", action: "delete", data: { match: { name?: string } } }

## 默认值规则
- 日期缺失 → 使用今天（当前日期会附加在用户消息中）
- 币种缺失 → 默认 CNY
- 日程缺少结束时间 → 默认开始时间 +1 小时
- importance 缺失 → 默认 "普通"
- todo 的 category 缺失 → 默认 "未分类"
- 热量：如果用户没有明确说几大卡，根据食物名称合理估算

## 跨模块识别
一条消息可能涉及多个模块，你必须拆分为多条操作。例如「吃拉面花了30元600大卡」→ finance + calories 两条操作。

## 图片输入
如果用户发送了图片（如小票、食物照片等），请通过视觉能力识别其中的内容，提取商品名、金额、数量等信息并生成对应操作。

## 示例

用户: "午饭吃了一碗拉面，花了30块，大概600大卡"
输出:
{"operations":[{"module":"finance","action":"create","data":{"name":"拉面","amount":30,"currency":"CNY","category":"餐饮","date":"2026-03-30"}},{"module":"calories","action":"create","data":{"food_name":"拉面","calories":600,"meal_type":"lunch","date":"2026-03-30"}}],"summary":"记录了午餐拉面：支出30元，摄入600大卡"}

用户: "明天下午3点到5点开组会"
输出:
{"operations":[{"module":"schedule","action":"create","data":{"title":"组会","start_time":"2026-03-31T15:00:00","end_time":"2026-03-31T17:00:00","importance":"普通"}}],"summary":"添加了明天15:00-17:00的组会日程"}

用户: "买了一瓶洗发水和一管牙膏"
输出:
{"operations":[{"module":"belongings_daily","action":"create","data":{"name":"洗发水","category":"洗护"}},{"module":"belongings_daily","action":"create","data":{"name":"牙膏","category":"洗护"}}],"summary":"添加了洗发水和牙膏两件日用品"}

用户: "帮我把'买菜'这个待办标记为完成"
输出:
{"operations":[{"module":"todo","action":"update","data":{"match":{"title":"买菜"},"update":{"is_completed":true}}}],"summary":"将待办'买菜'标记为已完成"}

用户: "删掉昨天那条拉面的记账"
输出:
{"operations":[{"module":"finance","action":"delete","data":{"match":{"name":"拉面","date":"2026-03-29"}}}],"summary":"删除了昨天的拉面记账记录"}

用户: "冰箱里还有3个鸡蛋，下周三过期"
输出:
{"operations":[{"module":"pantry","action":"create","data":{"name":"鸡蛋","category":"新鲜食材","quantity":"3个","expiry_date":"2026-04-01"}}],"summary":"添加了食材：3个鸡蛋，4月1日过期"}

用户: "今天花了500日元坐电车"
输出:
{"operations":[{"module":"finance","action":"create","data":{"name":"电车","amount":500,"currency":"JPY","category":"交通","date":"2026-03-30"}}],"summary":"记录了交通支出500日元"}

用户: "突然想到一个idea：用LLM做个人助手来管理日常生活"
输出:
{"operations":[{"module":"thought","action":"create","data":{"title":"LLM个人助手","content":"用LLM做个人助手来管理日常生活","tags":["AI"]}}],"summary":"记录了一条关于LLM个人助手的随想"}

用户: "买了个新键盘，花了800块，希望能用3年"
输出:
{"operations":[{"module":"finance","action":"create","data":{"name":"键盘","amount":800,"currency":"CNY","category":"电子","date":"2026-03-30"}},{"module":"belongings_durable","action":"create","data":{"name":"键盘","category":"电子产品","purchase_price":800,"purchase_date":"2026-03-30","expected_lifespan_days":1095}}],"summary":"记录了购买键盘800元，并添加为耐用品（预期使用3年）"}

用户: "你好"
输出:
{"operations":[],"summary":"你好！我可以帮你快速记录生活数据。试试说：'午饭花了30块吃了拉面' 或 '明天下午3点开会'"}

如果用户的话无法对应到任何模块操作，返回空 operations 数组并在 summary 中友好回复和引导。

再次强调：你的回复只能是纯 JSON，不能有任何其他内容。`;

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

    // Inject today's date into the last user message for context
    const today = new Date().toISOString().split("T")[0];
    const enrichedMessages = messages.map((m: any, i: number) => {
      if (i === messages.length - 1 && m.role === "user") {
        // Handle multimodal messages (with images)
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

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...enrichedMessages],
        temperature: 0.1,
        response_format: { type: "json_object" },
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
