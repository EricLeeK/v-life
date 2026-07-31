# 运势中枢（中西合璧）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 V-Life 中落地「今日运势中枢 + 中西式互动占卜」，规则底稿稳定可复现，AI 润色可降级，档案在设置页默认收起。

**架构：** `settings.fortune_profile` 存生日档案；`lib/fortune/*` 纯函数产出黄历/月相/星级/牌卦；`useFortune` 读写 `fortune_daily_cache` 与 `fortune_readings`；`ai-chat` 新增 `mode: "fortune"` 走独立 system prompt 与纯文本响应（不走现有 JSON operations 协议）。

**技术栈：** React + Vite + Supabase（Postgres RLS + Edge Functions）+ TanStack Query + Vitest + 现有 `useLang` / `AppLayout` / shadcn UI。

**规格：** `docs/superpowers/specs/2026-07-31-fortune-hub-design.md`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `supabase/migrations/20260731_fortune_hub.sql` | `fortune_profile` 列 + `fortune_daily_cache` + `fortune_readings` + RLS |
| `src/integrations/supabase/types.ts` | 手工补齐新表/新字段类型 |
| `src/data/demoSeed.ts` | demo 默认 `fortune_profile` / 空 readings |
| `src/lib/fortune/types.ts` | 共享类型：`FortuneProfile`、`DailyScores`、`DrawnCard` 等 |
| `src/lib/fortune/seededRandom.ts` | mulberry32 + `hashString` |
| `src/lib/fortune/zodiac.ts` | 公历生日 → 西式星座 |
| `src/lib/fortune/shengxiao.ts` | 公历生日 → 生肖（简化：按春节近似或公历年，见任务内约定） |
| `src/lib/fortune/scores.ts` | 同日确定性星级 |
| `src/lib/fortune/moon.ts` | 月相名 + 轻解读 |
| `src/lib/fortune/almanac.ts` | 宜忌（确定性模板池） |
| `src/lib/fortune/lunarLabel.ts` | 农历简写标签（轻量算法或模板） |
| `src/lib/fortune/tarot.ts` | 78 张韦特 + 抽三张 |
| `src/lib/fortune/iching.ts` | 铜钱起卦 |
| `src/lib/fortune/lot.ts` | 签池 |
| `src/lib/fortune/bazi.ts` | 日柱 + 五行简图 |
| `src/lib/fortune/ruleCopy.ts` | 规则底稿文案（总览/降级用） |
| `src/lib/fortune/aiReading.ts` | 调用 `ai-chat` `mode:"fortune"` + `messageFromAiInvoke` |
| `src/hooks/useFortune.ts` | profile 派生、cache upsert、readings CRUD |
| `src/components/fortune/*` | DailyHero、AlmanacCard、MoonCard、ToolGrid、StarRow、SaveReadingButton 等 |
| `src/pages/fortune/*.tsx` | 各路由页面 |
| `src/pages/Settings.tsx` | 运势档案 Collapsible（默认收起）+ hidden_features 项 |
| `src/components/AppSidebar.tsx` / `MobileNav.tsx` | 导航入口 |
| `src/App.tsx` | lazy routes |
| `supabase/functions/ai-chat/index.ts` | `mode === "fortune"` 分支 |
| `src/lib/fortune/*.test.ts` | 纯函数单测 |

---

### 任务 1：数据库 Migration + 类型

**文件：**
- 创建：`supabase/migrations/20260731_fortune_hub.sql`
- 修改：`src/integrations/supabase/types.ts`（`settings` 与新表）
- 修改：`src/data/demoSeed.ts`

- [ ] **步骤 1：编写 migration**

```sql
-- supabase/migrations/20260731_fortune_hub.sql
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS fortune_profile jsonb DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.fortune_daily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_date)
);

CREATE TABLE IF NOT EXISTS public.fortune_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  question text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reading text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fortune_readings_user_created_idx
  ON public.fortune_readings (user_id, created_at DESC);

ALTER TABLE public.fortune_daily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortune_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fortune_daily_cache_select_own" ON public.fortune_daily_cache
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fortune_daily_cache_insert_own" ON public.fortune_daily_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fortune_daily_cache_update_own" ON public.fortune_daily_cache
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fortune_daily_cache_delete_own" ON public.fortune_daily_cache
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "fortune_readings_select_own" ON public.fortune_readings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fortune_readings_insert_own" ON public.fortune_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fortune_readings_update_own" ON public.fortune_readings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fortune_readings_delete_own" ON public.fortune_readings
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **步骤 2：更新 `types.ts`**

在 `settings.Row` / `Insert` / `Update` 增加：

```ts
fortune_profile: Json | null
```

在 `Tables` 中增加 `fortune_daily_cache` 与 `fortune_readings`，字段与 migration 一致（参照现有 `civil_exams` 条目写法）。

- [ ] **步骤 3：更新 demoSeed**

在 `demoData.settings` 增加 `fortune_profile: null`；可选空数组占位无需表数据（demo 模式由 hook 走内存）。

- [ ] **步骤 4：Commit**

```bash
git add supabase/migrations/20260731_fortune_hub.sql \
  src/integrations/supabase/types.ts src/data/demoSeed.ts
git commit -m "$(cat <<'EOF'
feat(运势): 添加 fortune 表结构与 settings.fortune_profile

EOF
)"
```

---

### 任务 2：规则引擎核心（生日派生 + 星级 + 随机种子）

**文件：**
- 创建：`src/lib/fortune/types.ts`
- 创建：`src/lib/fortune/seededRandom.ts`
- 创建：`src/lib/fortune/zodiac.ts`
- 创建：`src/lib/fortune/shengxiao.ts`
- 创建：`src/lib/fortune/scores.ts`
- 测试：`src/lib/fortune/zodiac.test.ts`、`shengxiao.test.ts`、`scores.test.ts`、`seededRandom.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
// src/lib/fortune/zodiac.test.ts
import { describe, expect, it } from "vitest";
import { zodiacFromBirthDate } from "./zodiac";

describe("zodiacFromBirthDate", () => {
  it("maps Aug 20 to virgo", () => {
    expect(zodiacFromBirthDate("1998-08-20")).toBe("virgo");
  });
  it("maps Dec 25 to capricorn", () => {
    expect(zodiacFromBirthDate("2000-12-25")).toBe("capricorn");
  });
});
```

```ts
// src/lib/fortune/shengxiao.test.ts
import { describe, expect, it } from "vitest";
import { shengxiaoFromBirthDate } from "./shengxiao";

describe("shengxiaoFromBirthDate", () => {
  // 约定：首版用公历年推属相（文档注明非精确春节分界，可后续升级）
  it("1998 -> tiger", () => {
    expect(shengxiaoFromBirthDate("1998-08-20")).toBe("tiger");
  });
});
```

```ts
// src/lib/fortune/scores.test.ts
import { describe, expect, it } from "vitest";
import { dailyScores } from "./scores";

describe("dailyScores", () => {
  it("is stable for same inputs", () => {
    const a = dailyScores({ date: "2026-07-31", zodiac: "virgo", shengxiao: "tiger" });
    const b = dailyScores({ date: "2026-07-31", zodiac: "virgo", shengxiao: "tiger" });
    expect(a).toEqual(b);
    expect(a.overall).toBeGreaterThanOrEqual(1);
    expect(a.overall).toBeLessThanOrEqual(5);
  });
});
```

```ts
// src/lib/fortune/seededRandom.test.ts
import { describe, expect, it } from "vitest";
import { mulberry32, hashStringToSeed } from "./seededRandom";

describe("seededRandom", () => {
  it("same seed yields same sequence", () => {
    const a = mulberry32(hashStringToSeed("abc"));
    const b = mulberry32(hashStringToSeed("abc"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- src/lib/fortune/zodiac.test.ts src/lib/fortune/shengxiao.test.ts src/lib/fortune/scores.test.ts src/lib/fortune/seededRandom.test.ts
```

预期：FAIL（模块不存在）

- [ ] **步骤 3：实现最少代码**

```ts
// types.ts — FortuneProfile, ZodiacSign, Shengxiao, DailyScores
// seededRandom.ts — hashStringToSeed, mulberry32(): () => number in [0,1)
// zodiac.ts — 标准日期边界表
// shengxiao.ts — (year - 4) % 12 映射 rat…pig，导出英文 key + zhLabel 映射
// scores.ts — hash date|zodiac|shengxiao|dimension → 1..5
```

星座英文 key：`aries`…`pisces`。生肖：`rat`…`pig`。UI 用 `t()` 或本地 `LABELS_ZH/EN`。

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- src/lib/fortune/
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/lib/fortune/
git commit -m "$(cat <<'EOF'
feat(运势): 添加星座生肖派生与确定性星级引擎

EOF
)"
```

---

### 任务 3：黄历 · 月相 · 农历标签 · 规则底稿

**文件：**
- 创建：`src/lib/fortune/almanac.ts`、`moon.ts`、`lunarLabel.ts`、`ruleCopy.ts`
- 测试：对应 `*.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
// almanac.test.ts
import { describe, expect, it } from "vitest";
import { getAlmanacForDate } from "./almanac";

describe("getAlmanacForDate", () => {
  it("returns yi/ji arrays and is stable", () => {
    const a = getAlmanacForDate("2026-07-31");
    const b = getAlmanacForDate("2026-07-31");
    expect(a.yi.length).toBeGreaterThan(0);
    expect(a.yi.length).toBeLessThanOrEqual(3);
    expect(a).toEqual(b);
  });
  it("falls back safely for any date", () => {
    const a = getAlmanacForDate("1900-01-01");
    expect(a.yi.length).toBeGreaterThan(0);
  });
});
```

```ts
// moon.test.ts
import { describe, expect, it } from "vitest";
import { getMoonPhase } from "./moon";

describe("getMoonPhase", () => {
  it("returns a named phase", () => {
    const m = getMoonPhase("2026-07-31");
    expect(m.phase).toBeTruthy();
    expect(m.blurbZh).toBeTruthy();
  });
});
```

```ts
// ruleCopy.test.ts
import { describe, expect, it } from "vitest";
import { buildDailyRuleCopy } from "./ruleCopy";

describe("buildDailyRuleCopy", () => {
  it("builds generic copy without profile", () => {
    const c = buildDailyRuleCopy({
      date: "2026-07-31",
      scores: { overall: 4, love: 3, career: 4, wealth: 3 },
      profile: null,
      lang: "zh",
    });
    expect(c.headline.length).toBeGreaterThan(0);
  });
});
```

- [ ] **步骤 2：运行确认失败 → 实现 → 再跑通过**

实现要点：
- `almanac`：宜/忌各备 ~20 条短语，用 `hashStringToSeed(date)` 抽 2–3 条；缺数据时返回「宜：平日行事 / 忌：无」
- `moon`：用已知新月纪元 + 29.530588853 日周期算 illumination，映射 8 相
- `lunarLabel`：可用简化干支日或「农历约估」文案；若引入依赖需写进本任务 commit message。优先无依赖：展示「星期X · 宜忌日」也能过 UI，但规格要农历简写——实现一个最小干支日标签即可（不必完整农历月日库）
- `ruleCopy`：按星级拼 1–2 句鼓励向中文/英文

- [ ] **步骤 3：Commit**

```bash
git add src/lib/fortune/
git commit -m "$(cat <<'EOF'
feat(运势): 添加黄历月相与规则底稿文案

EOF
)"
```

---

### 任务 4：`ai-chat` 运势模式 + 前端 `aiReading` 封装

**文件：**
- 修改：`supabase/functions/ai-chat/index.ts`
- 创建：`src/lib/fortune/aiReading.ts`
- 测试：`src/lib/fortune/aiReading.test.ts`（mock `supabase.functions.invoke` 可选；至少测 prompt 组装纯函数）

- [ ] **步骤 1：扩展 ai-chat**

在 `serve` 内解析：

```ts
const { messages, session_id, mode } = await req.json();
```

当 `mode === "fortune"`：
- system 使用 `FORTUNE_SYSTEM_PROMPT`（轻快、鼓励、禁止恐吓、非医疗/非投资、可加「仅供娱乐」、**输出纯文本而非 JSON**）
- **不要**设置 `response_format: { type: "json_object" }`
- temperature 提到 `0.7`
- 响应体保持与现有一致字段方便前端：`{ content: string }` 或现有解析路径返回的文本字段；若现有成功体是 JSON operations，fortune 分支改为：

```ts
return new Response(JSON.stringify({ content: text, mode: "fortune" }), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
```

现有默认分支行为不变。

`FORTUNE_SYSTEM_PROMPT` 示例要点（写入文件）：

```
你是温柔的生活向运势助手。根据用户给出的结构化事实（牌面/卦象/星级等）写简短鼓励向解读。
禁止恐吓、诅咒、绝对化断言。不做医疗或投资建议。用用户消息的语言回复。结尾可加「仅供娱乐」。
只输出纯文本解读，不要 JSON。
```

- [ ] **步骤 2：实现 `aiReading.ts`**

```ts
import { supabase } from "@/integrations/supabase/client";
import { messageFromAiInvoke } from "@/lib/aiErrors";

export async function requestFortuneReading(userPrompt: string): Promise<
  { ok: true; text: string } | { ok: false; error: string }
> {
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: {
      mode: "fortune",
      messages: [{ role: "user", content: userPrompt }],
    },
  });
  const invokeMsg = await messageFromAiInvoke(data, error);
  if (invokeMsg) return { ok: false, error: invokeMsg };
  const text = (data as any)?.content?.trim?.() || "";
  if (!text) return { ok: false, error: "empty fortune reading" };
  return { ok: true, text };
}

export function buildFortuneUserPrompt(input: {
  kind: string;
  facts: Record<string, unknown>;
  question?: string;
  lang: "zh" | "en";
}): string {
  return [
    `kind: ${input.kind}`,
    `lang: ${input.lang}`,
    input.question ? `question: ${input.question}` : "",
    `facts: ${JSON.stringify(input.facts)}`,
    "请根据 facts 写 80-150 字温柔解读。",
  ]
    .filter(Boolean)
    .join("\n");
}
```

- [ ] **步骤 3：为 `buildFortuneUserPrompt` 写单测并跑通**

```bash
npm test -- src/lib/fortune/aiReading.test.ts
```

- [ ] **步骤 4：Commit**

```bash
git add supabase/functions/ai-chat/index.ts src/lib/fortune/aiReading.ts src/lib/fortune/aiReading.test.ts
git commit -m "$(cat <<'EOF'
feat(运势): ai-chat 支持 fortune 纯文本解读模式

EOF
)"
```

---

### 任务 5：`useFortune` Hook

**文件：**
- 创建：`src/hooks/useFortune.ts`

- [ ] **步骤 1：实现 hook API**

```ts
// 依赖 useSettings / useUpdateSettings / useAuth / useDemoMode / useQuery / useMutation

export function useFortuneProfile() {
  // 从 settings.fortune_profile 读取；提供 derived zodiac/shengxiao
}

export function useFortuneDailyCache(date: string) {
  // queryKey: ["fortune_daily_cache", date]
  // demo: 内存 null
}

export function useUpsertFortuneDailyCache() {
  // upsert on (user_id, cache_date)
}

export function useFortuneReadings() {
  // queryKey: ["fortune_readings"] order created_at desc limit 50
}

export function useSaveFortuneReading() {
  // insert fortune_readings
}

export function useDeleteFortuneReading() {
  // optional for history page
}
```

Demo 模式：cache/readings 用 `useState` 或 `demoData` 扩展字段；最小实现可让 readings 仅会话内内存（刷新丢失可接受，或写入 demoSeed）。

- [ ] **步骤 2：手动类型检查**

```bash
npx tsc --noEmit
```

预期：无与 fortune 相关的类型错误（若项目已有无关错误，只修本任务引入的）

- [ ] **步骤 3：Commit**

```bash
git add src/hooks/useFortune.ts src/data/demoSeed.ts
git commit -m "$(cat <<'EOF'
feat(运势): 添加 useFortune 数据钩子

EOF
)"
```

---

### 任务 6：设置页档案（默认收起）+ 导航入口 + 路由骨架 + 今日中枢（规则）

**文件：**
- 修改：`src/pages/Settings.tsx`、`AppSidebar.tsx`、`MobileNav.tsx`、`App.tsx`
- 创建：`src/pages/fortune/FortuneHome.tsx`
- 创建：`src/components/fortune/DailyHero.tsx`、`AlmanacCard.tsx`、`MoonCard.tsx`、`ToolGrid.tsx`、`StarRow.tsx`

- [ ] **步骤 1：Settings 折叠档案**

在 Account 相关 Card 之后插入（使用 `@/components/ui/collapsible`）：

```tsx
<Collapsible defaultOpen={false}>
  <Card>
    <CardHeader className="py-3">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between text-left">
          <CardTitle className="text-base">{t("运势档案", "Fortune Profile")}</CardTitle>
          <span className="text-sm text-muted-foreground">{t("展开", "Expand")}</span>
        </button>
      </CollapsibleTrigger>
    </CardHeader>
    <CollapsibleContent>
      <CardContent className="space-y-3">
        {/* birth_date Input type=date */}
        {/* birth_hour Select 0-23 或时辰 */}
        {/* birth_place Input 可选 */}
        {/* 显示派生星座/生肖；允许 Select 覆盖 zodiac_sign / shengxiao */}
        {/* onChange → update("fortune_profile", { ...draft.fortune_profile, ... }) */}
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
```

生日变更时自动重算 `zodiac_sign` / `shengxiao`（除非用户已手动覆盖——可用 `zodiac_locked` / `shengxiao_locked` 布尔，或更简：每次改生日都重算，覆盖用单独「自定义」开关。首版：**改生日即重算派生字段**）。

在 `hidden_features` 列表加 `{ id: "fortune", name: t("运势", "Fortune") }`。

- [ ] **步骤 2：导航**

`AppSidebar` `mainItems` 增加：

```ts
{ title: t("运势", "Fortune"), url: "/fortune", icon: Sparkles }
```

`MobileNav` 的 `moreItems` 同步增加。`focusMode === "civil_service"` 时不显示（与现有非考公项一致）。

- [ ] **步骤 3：路由**

```tsx
const FortuneHome = lazy(() => import("./pages/fortune/FortuneHome"));
// 先只挂首页，子页在后续任务加
<Route path="/fortune" element={<ProtectedRoute><FortuneHome /></ProtectedRoute>} />
```

- [ ] **步骤 4：实现 FortuneHome（仅规则，不调 AI）**

布局按规格：日期条 → DailyHero（无档案则 CTA `navigate("/settings")`）→ Almanac+Moon → ToolGrid（链接先指向后续路由，未实现页可用占位 Route 或暂时 `Coming soon` 页——**本任务 ToolGrid 只渲染链接，子页任务 7+ 再补**）。

- [ ] **步骤 5：本地验证**

```bash
npm run dev
```

检查：侧栏可见「运势」；设置里档案默认收起；填写生日后首页显示专属星级与宜忌。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/Settings.tsx src/components/AppSidebar.tsx src/components/MobileNav.tsx \
  src/App.tsx src/pages/fortune/ src/components/fortune/
git commit -m "$(cat <<'EOF'
feat(运势): 落地今日中枢、档案折叠与导航入口

EOF
)"
```

---

### 任务 7：星座 / 生肖详解 + 今日 AI 缓存

**文件：**
- 创建：`src/pages/fortune/ZodiacPage.tsx`、`ShengxiaoPage.tsx`
- 修改：`FortuneHome.tsx`（进入时尝试 AI 扩写并 upsert cache）
- 修改：`App.tsx` 加路由

- [ ] **步骤 1：路由**

```tsx
<Route path="/fortune/zodiac" element={<ProtectedRoute><ZodiacPage /></ProtectedRoute>} />
<Route path="/fortune/shengxiao" element={<ProtectedRoute><ShengxiaoPage /></ProtectedRoute>} />
```

- [ ] **步骤 2：详解页**

- 默认选中档案星座/生肖，可切换浏览（不写回档案）
- 先展示 `ruleCopy` 段落
- 按钮「AI 润色」或进入自动请求：`requestFortuneReading(buildFortuneUserPrompt(...))`
- 失败：toast + 保留底稿

- [ ] **步骤 3：首页当日缓存**

在 `FortuneHome`：

```
if cache miss for today:
  show rule copy immediately
  fire requestFortuneReading once
  on success upsert fortune_daily_cache
else:
  show cache.payload.headline / body
```

用 ref/flag 防止 React StrictMode 双请求（或依赖 upsert 幂等 +「已有 AI 文案则跳过」）。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/fortune/ZodiacPage.tsx src/pages/fortune/ShengxiaoPage.tsx \
  src/pages/fortune/FortuneHome.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(运势): 星座生肖详解与今日 AI 缓存

EOF
)"
```

---

### 任务 8：塔罗

**文件：**
- 创建：`src/lib/fortune/tarot.ts`、`tarot.test.ts`
- 创建：`src/pages/fortune/TarotPage.tsx`
- 创建：`src/components/fortune/TarotDeck.tsx`、`SaveReadingButton.tsx`
- 修改：`App.tsx`

- [ ] **步骤 1：失败测试 — seed 可复现**

```ts
import { describe, expect, it } from "vitest";
import { drawTarotSpread } from "./tarot";

describe("drawTarotSpread", () => {
  it("reproduces cards from seed", () => {
    const a = drawTarotSpread("seed-1");
    const b = drawTarotSpread("seed-1");
    expect(a.cards).toEqual(b.cards);
    expect(a.cards).toHaveLength(3);
    expect(a.cards[0]).toHaveProperty("upright");
  });
});
```

- [ ] **步骤 2：实现 `tarot.ts`**

- 导出 `TAROT_DECK`：大阿卡纳 22 + 小阿卡纳 56（id、nameZh、nameEn、suit）
- `drawTarotSpread(seed: string)`：洗牌抽 3 张，每张 `upright: rng() > 0.5`，位置 `past|present|advice`

- [ ] **步骤 3：TarotPage UI**

深色氛围容器（局部，不改全局主题）：
1. 选题 chips + 自定义 input  
2. 抽牌按钮 → `seed = crypto.randomUUID()` → `drawTarotSpread(seed)`  
3. 展示三张 + `requestFortuneReading`  
4. `SaveReadingButton` → `useSaveFortuneReading`，`type:"tarot"`，payload 含 seed/cards  

AI 失败仍展示牌面 + 规则短句（每张牌可用静态 keywords 表）。

- [ ] **步骤 4：测试 + Commit**

```bash
npm test -- src/lib/fortune/tarot.test.ts
git add src/lib/fortune/tarot.ts src/lib/fortune/tarot.test.ts \
  src/pages/fortune/TarotPage.tsx src/components/fortune/TarotDeck.tsx \
  src/components/fortune/SaveReadingButton.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(运势): 塔罗三牌阵与可复现抽牌

EOF
)"
```

---

### 任务 9：求签 + 易经起卦

**文件：**
- 创建：`src/lib/fortune/lot.ts`、`iching.ts` + 测试
- 创建：`src/pages/fortune/LotPage.tsx`、`IchingPage.tsx`
- 修改：`App.tsx`

- [ ] **步骤 1：测试**

```ts
// lot.test.ts
import { describe, expect, it } from "vitest";
import { drawLot } from "./lot";

describe("drawLot", () => {
  it("reproduces from seed", () => {
    expect(drawLot("s1")).toEqual(drawLot("s1"));
    expect(["上上", "上吉", "中吉", "中平", "下下"]).toContain(drawLot("s1").rankZh);
  });
});
```

```ts
// iching.test.ts
import { describe, expect, it } from "vitest";
import { castHexagram } from "./iching";

describe("castHexagram", () => {
  it("returns hexagram with six lines from seed", () => {
    const a = castHexagram("s1");
    expect(a.lines).toHaveLength(6);
    expect(a).toEqual(castHexagram("s1"));
    expect(a.hexagramNumber).toBeGreaterThanOrEqual(1);
    expect(a.hexagramNumber).toBeLessThanOrEqual(64);
  });
});
```

- [ ] **步骤 2：实现**

- `lot`：签池 ≥ 24 条，含 rank、verseZh、verseEn  
- `iching`：三枚铜钱法生成 6 爻；变爻标记；卦序用文王卦序表（可内嵌 64 名称中英）；不必全文《周易》  
- 页面：问题输入 → 动画（CSS 即可）→ 结果 → AI → 保存 `type: "lot"|"iching"`

- [ ] **步骤 3：Commit**

```bash
npm test -- src/lib/fortune/lot.test.ts src/lib/fortune/iching.test.ts
git add src/lib/fortune/lot.ts src/lib/fortune/iching.ts \
  src/lib/fortune/lot.test.ts src/lib/fortune/iching.test.ts \
  src/pages/fortune/LotPage.tsx src/pages/fortune/IchingPage.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(运势): 求签与易经起卦互动页

EOF
)"
```

---

### 任务 10：八字日柱 + 历史页

**文件：**
- 创建：`src/lib/fortune/bazi.ts`、`bazi.test.ts`
- 创建：`src/pages/fortune/BaziPage.tsx`、`HistoryPage.tsx`
- 修改：`App.tsx`、`ToolGrid` 确保全部链接有效

- [ ] **步骤 1：日柱测试**

```ts
import { describe, expect, it } from "vitest";
import { dayPillarFromDate } from "./bazi";

describe("dayPillarFromDate", () => {
  it("returns gan-zhi pair", () => {
    const p = dayPillarFromDate("1998-08-20", 9);
    expect(p.ganZh).toBeTruthy();
    expect(p.zhiZh).toBeTruthy();
    expect(p.wuxing).toHaveLength(5); // 五维计数或占比
  });
});
```

实现：用已知儒略日 / 甲子日起算法计算日柱；时辰影响「时柱」可标为可选展示，日柱为主。五行简图用天干地支五行映射计数。

- [ ] **步骤 2：BaziPage**

无档案生日 → CTA 去设置。有则展示日柱 + 简单条形五行 + AI 今日提醒 + 可保存。

- [ ] **步骤 3：HistoryPage**

`useFortuneReadings` 列表；点击 Dialog/子路由展示 `question`、`payload` 摘要、`reading`；支持删除。

- [ ] **步骤 4：Commit**

```bash
npm test -- src/lib/fortune/bazi.test.ts
git add src/lib/fortune/bazi.ts src/lib/fortune/bazi.test.ts \
  src/pages/fortune/BaziPage.tsx src/pages/fortune/HistoryPage.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(运势): 八字日柱简析与占卜历史

EOF
)"
```

---

### 任务 11：端到端打磨与回归

**文件：** 按需修前述文件

- [ ] **步骤 1：跑全量单测**

```bash
npm test
```

预期：全部 PASS（含既有测试）

- [ ] **步骤 2：跑 build**

```bash
npm run build
```

预期：成功

- [ ] **步骤 3：手工检查清单**

- [ ] 设置「运势档案」默认收起  
- [ ] 填生日 → 首页专属；清空 → 通用 + CTA  
- [ ] 隐藏 `fortune` 后侧栏/移动导航消失  
- [ ] 同日二次进首页不重复成功打 AI（有 cache）  
- [ ] 塔罗同 seed 复现（单测已覆盖；UI 保存后再从历史核对 payload.seed）  
- [ ] 断网/无 Key 时工具页仍显示规则底稿  
- [ ] 中英文 `t()` 切换无明显硬编码漏网（运势主要文案）

- [ ] **步骤 4：最终 Commit（若有修复）**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(运势): 打磨降级文案与导航边界情况

EOF
)"
```

---

## 自检（对照规格）

| 规格需求 | 任务 |
|----------|------|
| 今日中枢布局 | 6 |
| 黄历/月相/星级 | 2–3、6 |
| 塔罗/星座/月相 | 3、7、8（月相嵌首页） |
| 易经/求签/生肖/八字 | 7、9、10 |
| 档案默认收起 | 6 |
| 规则+AI 混合与降级 | 4、7–10 |
| daily cache / readings | 1、5、7、10 |
| hidden_features | 6 |
| 轻快语气 prompt | 4 |
| 测试要点 | 2、3、8、9、10、11 |

**占位符扫描：** 无 TODO/待定步骤。生肖春节分界与完整农历月日刻意简化并在任务 2/3 写明约定。

**类型名一致性：** `FortuneProfile`、`dailyScores`、`drawTarotSpread`、`castHexagram`、`drawLot`、`requestFortuneReading`、`mode: "fortune"` 贯穿任务 2–10。
