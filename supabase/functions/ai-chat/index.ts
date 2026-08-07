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
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
create: { module: "finance", action: "create", data: { name: string, amount: number, currency: "CNY"|"JPY", category: "餐饮"|"日用"|"交通"|"住房"|"通讯/订阅"|"医疗"|"服饰"|"娱乐"|"学习"|"电子"|"大额"|"税费"|"其他", date: "YYYY-MM-DD", notes?: string } }
**【严格约束】category 必须且只能是上述枚举值之一，禁止使用任何同义词、近义词或自创分类（如"购物"、"食品"、"超市"等均不合法）。如果无法确定分类，使用"其他"。税费/消費税/tax 统一归入"税费"。**
update: { module: "finance", action: "update", data: { match: { name?: string, date?: string, amount?: number }, update: { name?: string, amount?: number, currency?: string, category?: string, notes?: string } } }
delete: { module: "finance", action: "delete", data: { match: { name?: string, date?: string, amount?: number } } }

### 2. calories（热量记录）
create: { module: "calories", action: "create", data: { food_name: string, calories: number, meal_type: "breakfast"|"lunch"|"dinner"|"snack"|"exercise", date: "YYYY-MM-DD", notes?: string } }
update: { module: "calories", action: "update", data: { match: { food_name?: string, date?: string, meal_type?: string }, update: { food_name?: string, calories?: number, meal_type?: string, notes?: string } } }
delete: { module: "calories", action: "delete", data: { match: { food_name?: string, date?: string, meal_type?: string } } }

**运动类（meal_type="exercise"）**：当用户提到运动/锻炼时，使用 meal_type="exercise"，calories 填写消耗的热量。food_name 填运动名称（如"跑步30分钟"）。你需要根据运动类型和时长自行估算消耗的大卡数。

### 3. schedule（日程）
create: { module: "schedule", action: "create", data: { title: string, start_time: "ISO8601", end_time: "ISO8601", importance?: "紧急"|"重要"|"普通"|"低", notes?: string } }
update: { module: "schedule", action: "update", data: { match: { title?: string, date?: string }, update: { title?: string, start_time?: string, end_time?: string, importance?: string, status?: string, notes?: string } } }
delete: { module: "schedule", action: "delete", data: { match: { title?: string, date?: string } } }

### 4. todo（待办事项）
create: { module: "todo", action: "create", data: { title: string, category?: "工作"|"学习"|"学业"|"生活"|"健康"|"考公"|"未分类", importance?: "紧急"|"重要"|"普通"|"低", detail?: string } }
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

### 9. weight（体重记录）
create: { module: "weight", action: "create", data: { weight: number, date?: "YYYY-MM-DD", notes?: string } }
delete: { module: "weight", action: "delete", data: { match: { date?: string } } }

### 10. measurement（围度记录）
create: { module: "measurement", action: "create", data: { waist?: number, hip?: number, chest?: number, arm?: number, thigh?: number, date?: "YYYY-MM-DD", notes?: string } }
delete: { module: "measurement", action: "delete", data: { match: { date?: string } } }

**围度单位为 cm，体重单位为 kg。同一天重复记录会覆盖（upsert）。**

### 11. goal（目标管理）
create: { module: "goal", action: "create", data: { title: string, type: "week"|"month"|"year", period_start: "YYYY-MM-DD" } }
update: { module: "goal", action: "update", data: { match: { title?: string, type?: string }, update: { title?: string, is_completed?: boolean } } }
delete: { module: "goal", action: "delete", data: { match: { title?: string, type?: string } } }

**目标分为周目标、月目标、年目标。period_start 为该目标周期的起始日期（周目标用周一日期，月目标用当月1号，年目标用当年1月1日）。**

### 12. project（项目管理）
create: { module: "project", action: "create", data: { name: string, description?: string, status?: "planning"|"active"|"paused"|"completed"|"archived", priority?: "high"|"medium"|"low", target_date?: "YYYY-MM-DD" } }
update: { module: "project", action: "update", data: { match: { name?: string }, update: { name?: string, description?: string, status?: string, priority?: string, target_date?: string } } }
delete: { module: "project", action: "delete", data: { match: { name?: string } } }

**项目状态：planning=规划中, active=进行中, paused=暂停中, completed=已完成, archived=已归档。默认 status="planning", priority="medium"。**

### 13. project_task（项目子任务/习惯/里程碑）
create: { module: "project_task", action: "create", data: { project_name: string, title: string, type?: "task"|"habit"|"milestone", status?: "todo"|"this_week"|"in_progress"|"waiting"|"done", description?: string, due_date?: "YYYY-MM-DD", weight?: number } }
update: { module: "project_task", action: "update", data: { match: { title?: string, project_name?: string }, update: { title?: string, status?: string, description?: string, due_date?: string, weight?: number } } }
delete: { module: "project_task", action: "delete", data: { match: { title?: string, project_name?: string } } }

**project_task 必须通过 project_name 关联到一个已存在的项目。type 可以是 task(任务)、habit(习惯)、milestone(里程碑)，默认 task。status 可以是 todo(待办)、this_week(本周)、in_progress(进行中)、waiting(等待中)、done(已完成)，默认 todo。weight 是权重(影响项目进度计算)，默认 1。**

### 14. civil_exam（考公考试倒计时）
create: { module: "civil_exam", action: "create", data: { name: string, exam_date: "YYYY-MM-DD", exam_type?: "国考"|"省考"|"事业编"|"自定义", is_primary?: boolean, notes?: string } }
update: { module: "civil_exam", action: "update", data: { match: { name?: string }, update: { name?: string, exam_date?: string, exam_type?: string, is_primary?: boolean, is_archived?: boolean, notes?: string } } }
delete: { module: "civil_exam", action: "delete", data: { match: { name?: string } } }

### 15. civil_plan（考公学习计划）
create: { module: "civil_plan", action: "create", data: { title: string, plan_date?: "YYYY-MM-DD", subject_group?: "xingce"|"shenlun"|"mianshi"|"general", subject_tag?: string, detail?: string, start_time?: "ISO8601", end_time?: "ISO8601", source?: "plan"|"daily_extra" } }
update: { module: "civil_plan", action: "update", data: { match: { title?: string, plan_date?: string }, update: { title?: string, is_completed?: boolean, plan_date?: string, subject_group?: string, subject_tag?: string, detail?: string, start_time?: string, end_time?: string } } }
delete: { module: "civil_plan", action: "delete", data: { match: { title?: string, plan_date?: string } } }

**subject_tag 常用：套卷、言语理解、资料分析、图形推理、定义类比、逻辑推理、数量关系、时政常识、综应、申论、理论学习、素材积累、热点剖析。**

### 16. civil_checkin（考公每日打卡）
create: { module: "civil_checkin", action: "create", data: { studied_minutes: number, date?: "YYYY-MM-DD", note?: string } }

**同一天重复打卡会覆盖（upsert）。**

### 17. civil_wrong（考公错题）
create: { module: "civil_wrong", action: "create", data: { title: string, subject_group: "xingce"|"shenlun"|"mianshi", subject_tag?: string, content?: string（题干，可含 LaTeX）, wrong_reason?: string, knowledge_point?: string, source_date?: "YYYY-MM-DD", review_status?: "pending"|"mastered", question_type?: "choice"|"judgement"|"text", options?: [{key: string, text: string}], correct_answer?: string, user_answer?: string, image_required?: boolean } }
update: { module: "civil_wrong", action: "update", data: { match: { title?: string }, update: { title?: string, review_status?: string, wrong_reason?: string, knowledge_point?: string, subject_tag?: string, question_type?: string, options?: [{key: string, text: string}], correct_answer?: string, user_answer?: string, image_required?: boolean } } }
delete: { module: "civil_wrong", action: "delete", data: { match: { title?: string } } }

**识别错题图片时，用 civil_wrong create 返回草稿字段（含 question_type/options/correct_answer/user_answer/image_required）；用户确认后再落库。新建 pending 错题会自动安排复习日期。image_required=true 表示图形推理/带图题等必须看图；纯文字题给 false。**

### 18. civil_xingce_paper（行测套卷）
create: { module: "civil_xingce_paper", action: "create", data: { taken_date?: "YYYY-MM-DD", source: string, is_mock?: boolean, verbal_total?: number, verbal_correct?: number, data_total?: number, data_correct?: number, graphic_total?: number, graphic_correct?: number, logic_total?: number, logic_correct?: number, analogy_total?: number, analogy_correct?: number, quantity_total?: number, quantity_correct?: number, common_total?: number, common_correct?: number, duration_minutes?: number, total_score?: number, beat_rate?: number, notes?: string } }
update: { module: "civil_xingce_paper", action: "update", data: { match: { source?: string, taken_date?: string }, update: { source?: string, total_score?: number, beat_rate?: number, notes?: string, is_mock?: boolean } } }
delete: { module: "civil_xingce_paper", action: "delete", data: { match: { source?: string, taken_date?: string } } }

**言语=verbal，资料=data，图推=graphic，逻辑=logic，定义类比=analogy，数量=quantity，常识=common。*_total 为题量，*_correct 为正确数。**

## 默认值规则
- 日期缺失 → 使用今天（当前日期会附加在用户消息中）
- 币种缺失 → 默认 CNY
- 日程缺少结束时间 → 默认开始时间 +1 小时
- importance 缺失 → 默认 "普通"
- todo 的 category 缺失 → 默认 "未分类"
- 热量：如果用户没有明确说几大卡，根据食物名称和份量合理估算热量（kcal）
- 运动：如果用户提到了运动但没说消耗多少，根据运动类型和时长自行估算消耗热量
- 项目 status 缺失 → 默认 "planning"，priority 缺失 → 默认 "medium"
- 项目子任务 type 缺失 → 默认 "task"，status 缺失 → 默认 "todo"
- civil_plan subject_group 缺失 → 默认 "xingce"；civil_checkin 同一天 upsert
- civil_wrong review_status 缺失 → 默认 "pending"

## 跨模块识别
一条消息可能涉及多个模块，你必须拆分为多条操作。例如「吃拉面花了30元600大卡」→ finance + calories 两条操作。

## 图片输入
如果用户发送了图片（如小票、食物照片等），请通过视觉能力识别其中的内容，提取商品名、金额、数量等信息并生成对应操作。

### 购物小票特别规则
1. 小票上的每一个商品必须分别生成独立的 finance 记账条目，不要合并
2. 税费（消費税/tax）必须单独一条记账条目，分类使用"税费"
3. 如果商品属于食材类（蔬菜、水果、肉类、蛋奶、调料、主食等），除了生成 finance 记账条目外，还要同时生成 pantry 食材管理条目
4. 如果商品原名是日文，翻译为中文后，条目名称格式为「中文名（原日文名）」，例如「牛奶（牛乳）」「鸡胸肉（鶏むね肉）」
5. 小票上的折扣/优惠如有，可作为负数金额的独立条目或在 notes 中备注

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

用户: "创建一个项目叫'毕业论文'，优先级高，目标5月底完成"
输出:
{"operations":[{"module":"project","action":"create","data":{"name":"毕业论文","status":"active","priority":"high","target_date":"2026-05-31"}}],"summary":"创建了项目'毕业论文'，优先级高，目标5月31日完成"}

用户: "在毕业论文项目里加一个任务'完成文献综述'，还有一个习惯'每天写500字'"
输出:
{"operations":[{"module":"project_task","action":"create","data":{"project_name":"毕业论文","title":"完成文献综述","type":"task","status":"todo"}},{"module":"project_task","action":"create","data":{"project_name":"毕业论文","title":"每天写500字","type":"habit","status":"todo"}}],"summary":"在'毕业论文'项目中添加了任务'完成文献综述'和习惯'每天写500字'"}

用户: "把毕业论文项目里的'完成文献综述'标记为完成"
输出:
{"operations":[{"module":"project_task","action":"update","data":{"match":{"title":"完成文献综述","project_name":"毕业论文"},"update":{"status":"done"}}}],"summary":"将'毕业论文'项目中的'完成文献综述'标记为已完成"}

用户: "你好"
输出:
{"operations":[],"summary":"你好！我可以帮你快速记录生活数据。试试说：'午饭花了30块吃了拉面' 或 '明天下午3点开会' 或 '创建一个新项目'"}

如果用户的话无法对应到任何模块操作，返回空 operations 数组并在 summary 中友好回复和引导。

再次强调：你的回复只能是纯 JSON，不能有任何其他内容。`;

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

    const resolved = await resolveAiCredentials(adminSb, user.id, settings);
    if (!resolved.ok) {
      return jsonError(resolved.code, resolved.message, resolved.status, corsHeaders);
    }
    const { apiKey, model, baseUrl } = resolved.creds;

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

    const systemPrompt = isFortune ? FORTUNE_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "system", content: systemPrompt }, ...enrichedMessages],
      temperature: isFortune ? 0.7 : 0.1,
    };
    if (!isFortune) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("LLM API error:", response.status, errText);
      return jsonError(
        "UPSTREAM_ERROR",
        `AI 服务暂时不可用 (${response.status})`,
        502,
        corsHeaders,
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    if (resolved.creds.mode === "hosted") {
      await recordHostedUsage(adminSb, {
        userId: user.id,
        functionName: isFortune ? "ai-chat-fortune" : "ai-chat",
        model,
        usage: result.usage,
        estimateFrom: content,
      });
    }

    if (isFortune) {
      return new Response(JSON.stringify({ content, mode: "fortune" }), {
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
