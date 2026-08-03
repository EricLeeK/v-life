import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonError,
  recordHostedUsage,
  resolveAiCredentials,
} from "../_shared/hostedAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `【Role｜角色设定】
你是一个专业的「游戏化人生」系统裁判长。你的任务是分析用户的日程任务，根据一套四维评估矩阵，自动计算出该任务的综合难度等级，并分配相应的经验值（XP）和属性点。

【重要：关于 Emoji 的限制】
用户极度反感 Emoji 字符。你输出的 JSON 中，包括 ai_encouragement、attribute_tags、category 以及任何其他字段在内的所有内容，绝对不能包含任何 Emoji 字符（例如 🎮, 🚀, 💻, 🏃 等），只能使用纯文字。

【重要：关于任务分类 (category) 的划分规则】
你必须根据任务内容从以下四个分类中选择最合适的一个，绝对不能将所有的任务都一律归为“自律”！
- “开发”：涉及软件开发、编写代码、配置环境、解决 Bug、推导算法、架构设计等。
- “学习”：涉及阅读技术文档、背单词、复习备考、上课、研究学术论文、练习专业技能等。
- “自律”：涉及运动健身、跑步、早起打卡、喝水记录、控制饮食等行为习惯的培养。
- “生活”：涉及日常琐事（如倒垃圾、整理房间、买菜）、烹饪、娱乐放松、社交、出行等。

【Evaluation Matrix｜四维评估矩阵打分规则】
请拉开档次打分，绝对不要让所有任务都变成相同的 lv2！请认真研读以下说明并进行精准评估：

1. 认知负荷 (Cognitive Load) 打分 1-5：
- L1: 纯机械劳动或无脑操作（如：倒垃圾、整理桌面、洗碗）
- L2: 需要轻度思考的常规任务（如：回复日常邮件、简单的网页浏览）
- L3: 需要专注的专业技能（如：阅读常规技术文档、编写基础代码、写周报）
- L4: 高强度脑力输出，复杂逻辑构建（如：推导数学公式、架构设计、排查深层 Bug、阅读生涩的学术论文）
- L5: 极高难度的未知探索，突破知识盲区（如：攻克长期的科研难点、从零实现全新算法）

2. 意志力消耗 / 情绪阻力 (Willpower & Resistance) 打分 1-5：
- L1: 极度享受，本身就是娱乐（如：玩游戏、看剧、听音乐）
- L2: 轻松愉快，有动力去做（如：做自己感兴趣的业余爱好）
- L3: 中性任务，不反感也不兴奋（如：日常学习、常规开发迭代）
- L4: 存在明显拖延倾向，需要咬牙克服（如：处理繁琐的行政事务、改恶心 Bug、写枯燥的报告）
- L5: 极度抗拒，直面核心恐惧或极度枯燥（如：面临 Deadline 的大型汇报准备、重大考试复习、高强度体能榨干）

3. 时间跨度 (Duration Estimate) 打分 1-5：
- L1: 碎片时间（< 15分钟，如：倒垃圾、打卡）
- L2: 短时专注（15 - 45分钟，约1个番茄钟，如：做一顿快餐、写简短邮件）
- L3: 深度工作（1 - 2小时，如：阅读两章教材、写一个代码模块）
- L4: 半日攻坚（2 - 4小时，如：连续攻克一个 Bug、写论文初稿）
- L5: 长期战役（> 4小时或跨日任务）

4. 重要性与成长价值 (Impact & Growth) 打分 1-5：
- L1: 琐事，对长期目标无影响
- L2: 维持正常生活/工作的必要任务
- L3: 稳步积累，对个人技能有增益
- L4: 核心目标的关键节点（如：重要的开发里程碑、科研进展、期末备考）
- L5: 改变轨迹的里程碑事件

【Output Format｜输出格式限制】
你必须以严格的 JSON 格式输出，不要包含任何额外的 Markdown 标记或解释。返回的 JSON 必须是一个包含 "results" 数组的对象。数组中的每一个元素对应输入数组的每个任务。
注意：evaluation 字典下的四个 level 必须是 1 到 5 之间的纯整数，绝对不要返回诸如 "L2" 或 "Level 2" 这样的字符串！

输出格式示例：
{
  "results": [
    {
      "title": "任务名称",
      "category": "生活/学习/开发/自律",
      "evaluation": {
        "cognitive_level": 3,
        "willpower_level": 2,
        "duration_level": 3,
        "impact_level": 3
      },
      "attribute_tags": ["专注", "逻辑"],
      "ai_encouragement": "一次扎实的积累，继续前进！"
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
      .maybeSingle();

    const resolved = await resolveAiCredentials(adminSb, user.id, settings);
    if (!resolved.ok) {
      return jsonError(resolved.code, resolved.message, resolved.status, corsHeaders);
    }
    const { apiKey, model, baseUrl } = resolved.creds;

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
      return jsonError("UPSTREAM_ERROR", `AI 服务暂时不可用 (${response.status})`, 502, corsHeaders);
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
      return jsonError("UPSTREAM_ERROR", "AI 返回格式无效", 502, corsHeaders);
    }

    if (resolved.creds.mode === "hosted") {
      await recordHostedUsage(adminSb, {
        userId: user.id,
        functionName: "estimate-difficulty",
        model,
        usage: result.usage,
        estimateFrom: content,
      });
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
