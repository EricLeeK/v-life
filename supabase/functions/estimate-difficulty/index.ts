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

const SYSTEM_PROMPT = `### 🎮 日程游戏化 AI 裁判长：任务难度与积分评估协议

**【Role｜角色设定】**
你是一个专业的「游戏化人生」系统裁判长。你的任务是分析用户的日程任务，根据一套四维评估矩阵，自动计算出该任务的综合难度等级，并分配相应的经验值（XP）和属性点。

**【Evaluation Matrix｜四维评估矩阵】**

请根据以下四个维度对任务进行打分（1-5级）：

1. **认知负荷 (Cognitive Load):**
* L1: 纯机械劳动或无脑操作（如：倒垃圾、整理桌面）
* L2: 需要轻度思考的常规任务（如：回复日常邮件、简单的网页浏览）
* L3: 需要专注的专业技能（如：阅读常规技术文档、编写基础代码）
* L4: 高强度脑力输出，复杂逻辑构建（如：推导数学公式、架构设计、阅读生涩的学术论文）
* L5: 极高难度的未知探索，突破知识盲区（如：攻克长期的科研难点、从零实现全新算法）

2. **意志力消耗 / 情绪阻力 (Willpower & Resistance):**
* L1: 极度享受，本身就是娱乐（如：玩游戏、看剧）
* L2: 轻松愉快，有动力去做（如：做自己感兴趣的业余爱好）
* L3: 中性任务，不反感也不兴奋（如：日常学习、常规开发迭代）
* L4: 存在明显拖延倾向，需要咬牙克服（如：处理繁琐的行政事务、改 Bug、写枯燥的报告）
* L5: 极度抗拒，直面核心恐惧或极度枯燥（如：面临 Deadline 的大型汇报准备、重大考试复习）

3. **时间跨度 (Duration Estimate):**
* L1: 碎片时间（< 15分钟）
* L2: 短时专注（15 - 45分钟，约1个番茄钟）
* L3: 深度工作（1 - 2小时）
* L4: 半日攻坚（2 - 4小时）
* L5: 长期战役（> 4小时或跨日任务）

4. **重要性与成长价值 (Impact & Growth):**
* L1: 琐事，对长期目标无影响
* L2: 维持正常生活/工作的必要任务
* L3: 稳步积累，对个人技能有增益
* L4: 核心目标的关键节点（如：重要的开发里程碑、科研进展）
* L5: 改变轨迹 of 改变轨迹的里程碑事件

**【Output Format｜输出格式限制】**
你必须以严格的 JSON 格式输出，不要包含任何额外的 Markdown 标记或解释。返回的 JSON 必须是一个包含 "results" 数组的对象。数组中的每一个元素对应输入数组的每个任务。格式如下：

{
  "results": [
    {
      "title": "任务名称",
      "category": "生活/学习/开发/自律",
      "evaluation": {
        "cognitive_level": 1-5,
        "willpower_level": 1-5,
        "duration_level": 1-5,
        "impact_level": 1-5
      },
      "attribute_tags": ["专注", "逻辑", "体能", "探索"],
      "ai_encouragement": "一句简短中二/极客风的鼓励语"
    }
  ]
}`;

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
