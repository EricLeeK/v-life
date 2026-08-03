# 托管 AI 混合模式（一期）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 BYOK 之上增加平台托管 AI：有权益走服务端 Key（`gemini-3.1-flash-lite`），无权益继续自带 Key；计量与限流；设置页展示状态。

**架构：** Edge Function 内通过共享模块解析凭证（hosted / byok）；`ai_entitlements` + `ai_usage_logs` 存权益与用量；平台密钥仅读 `HOSTED_AI_*` Secrets（已配置）。支付与自助开通留二期。

**技术栈：** Supabase (Postgres + Edge/Deno) + React/TypeScript + TanStack Query + 现有 shadcn Settings 页

**规格：** `docs/superpowers/specs/2026-07-31-hosted-ai-hybrid-design.md`

**已就绪运维项（勿重复创建 Key）：**
- Secrets：`HOSTED_AI_API_KEY` / `HOSTED_AI_PLATFORM=gemini` / `HOSTED_AI_MODEL=gemini-3.1-flash-lite`
- 默认额度：月 1_000_000 tokens / 日 50 次 / 分 10 次；全站 120 RPM

---

## 文件清单

| 文件 | 类型 | 职责 |
|------|------|------|
| `supabase/migrations/20260731_hosted_ai.sql` | 新建 | `ai_entitlements`、`ai_usage_logs`、RLS、索引 |
| `supabase/functions/_shared/hostedAi.ts` | 新建 | 平台配置、权益判定、额度预检、写用量、解析最终 api 凭证 |
| `supabase/functions/_shared/platformUrls.ts` | 新建 | `PLATFORM_URLS` 单处定义（可选；也可留在 hostedAi 内） |
| `supabase/functions/ai-chat/index.ts` | 修改 | 改用 `resolveAiCredentials` + 成功后 `recordHostedUsage` |
| `supabase/functions/estimate-difficulty/index.ts` | 修改 | 同上 |
| `src/integrations/supabase/types.ts` | 修改 | 新表类型 |
| `src/lib/aiErrors.ts` | 新建 | 错误码 → 中文文案 |
| `src/hooks/useHostedAiStatus.ts` | 新建 | 读权益 + 当月/当日用量 |
| `src/pages/Settings.tsx` | 修改 | 「托管 AI」状态区块 |
| `src/components/AIChatPanel.tsx` | 修改 | 用 `aiErrors` 展示友好错误（若已有 toast/文案路径则接入） |

---

### 任务 1：数据库迁移

**文件：**
- 创建：`supabase/migrations/20260731_hosted_ai.sql`

- [ ] **步骤 1：编写迁移**

```sql
-- Hosted AI entitlements + usage (phase 1)

CREATE TABLE IF NOT EXISTS public.ai_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  monthly_token_limit INTEGER NOT NULL DEFAULT 1000000,
  daily_request_limit INTEGER NOT NULL DEFAULT 50,
  per_minute_limit INTEGER NOT NULL DEFAULT 10,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'hosted' CHECK (source IN ('hosted')),
  function_name TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  token_estimate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_created_idx
  ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_idx
  ON public.ai_usage_logs (created_at DESC);

ALTER TABLE public.ai_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ai_entitlements"
  ON public.ai_entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- no insert/update/delete policies for authenticated → only service role writes

DROP TRIGGER IF EXISTS update_ai_entitlements_updated_at ON public.ai_entitlements;
CREATE TRIGGER update_ai_entitlements_updated_at
  BEFORE UPDATE ON public.ai_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **步骤 2：应用到远程**

运行：`supabase db push`（或项目惯用的 migrate 方式）  
预期：两表出现在 remote；RLS 开启。

- [ ] **步骤 3：为自己开通权益（替换 USER_UUID）**

```sql
INSERT INTO public.ai_entitlements (user_id, status, monthly_token_limit, daily_request_limit, per_minute_limit, expires_at)
VALUES ('USER_UUID', 'active', 1000000, 50, 10, NULL)
ON CONFLICT (user_id) DO UPDATE SET
  status = 'active',
  monthly_token_limit = 1000000,
  daily_request_limit = 50,
  per_minute_limit = 10,
  expires_at = NULL;
```

获取 UUID：登录后在 SQL：`select id, email from auth.users;`

---

### 任务 2：共享模块 `hostedAi.ts`

**文件：**
- 创建：`supabase/functions/_shared/hostedAi.ts`

- [ ] **步骤 1：实现类型与常量**

```ts
export const PLATFORM_URLS: Record<string, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  siliconflow: "https://api.siliconflow.cn/v1",
  custom: "",
};

export const GLOBAL_HOSTED_RPM = 120;

export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "HOSTED_DISABLED"
  | "HOSTED_RATE_LIMIT"
  | "HOSTED_QUOTA_EXCEEDED"
  | "HOSTED_NOT_PROVISIONED"
  | "UPSTREAM_ERROR";

export type ResolvedAi =
  | {
      mode: "hosted";
      apiKey: string;
      platform: string;
      model: string;
      baseUrl: string;
      entitlement: {
        monthly_token_limit: number;
        daily_request_limit: number;
        per_minute_limit: number;
      };
    }
  | {
      mode: "byok";
      apiKey: string;
      platform: string;
      model: string;
      baseUrl: string;
    };

export type ResolveFailure = {
  ok: false;
  status: number;
  code: AiErrorCode;
  message: string;
};

export type ResolveSuccess = { ok: true; creds: ResolvedAi };
```

- [ ] **步骤 2：实现 `getHostedConfig()`**

从 `Deno.env` 读：
- `HOSTED_AI_ENABLED`（默认视为开启；仅当值为 `"false"` 时关闭托管路径）
- `HOSTED_AI_API_KEY`、`HOSTED_AI_PLATFORM`（默认 `gemini`）、`HOSTED_AI_MODEL`（默认 `gemini-3.1-flash-lite`）、`HOSTED_AI_BASE_URL`（可选）

- [ ] **步骤 3：实现 `resolveAiCredentials(adminSb, userId, settings)`**

逻辑顺序（与规格 2.1 一致）：

1. 若 `HOSTED_AI_ENABLED !== "false"`：查 `ai_entitlements` where `user_id`
2. 若存在且 `status === 'active'` 且（`expires_at` 为空或 `> now`）：
   - 若无 `HOSTED_AI_API_KEY` → `{ ok:false, status:503, code:'HOSTED_NOT_PROVISIONED', ... }`
   - 跑额度预检（步骤 4）；失败则返回对应 429/402
   - 成功 → `{ ok:true, creds: { mode:'hosted', ... } }`
3. 否则若 `settings?.ai_api_key` → BYOK
4. 否则 → `{ ok:false, status:400, code:'AI_NOT_CONFIGURED', message:'请开通托管 AI 或在设置中填写 API Key' }`

权益 `disabled` 或过期：视为无托管，走步骤 3（BYOK），**不要**单独 403（与规格测试表「过期走 BYOK」一致）。若需对「显式 disabled 且无 BYOK」区分文案，可在无 BYOK 时 message 提及已禁用；码仍用 `AI_NOT_CONFIGURED` 或 `HOSTED_DISABLED`（无 Key 且 entitlement disabled 时用 `HOSTED_DISABLED` 403）。

- [ ] **步骤 4：实现 `assertHostedQuota(adminSb, userId, entitlement)`**

用 service role 查询 `ai_usage_logs`：

- 本分钟：`created_at >= now() - interval '1 minute'` 且 `user_id` 的 count；`>= per_minute_limit` → 429 `HOSTED_RATE_LIMIT`
- 今日（UTC 日或 Asia/Shanghai——**选定 `Asia/Shanghai` 日历日**）：当日 count `>= daily_request_limit` → 402 `HOSTED_QUOTA_EXCEEDED`
- 本月（上海时区自然月）：`sum(total_tokens) >= monthly_token_limit` → 402
- 全站本分钟 count `>= GLOBAL_HOSTED_RPM` → 429

上海日界可用：

```ts
function shanghaiDatePrefix(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}
```

月界：同格式取 `YYYY-MM`，过滤 `created_at` 在该月上海时区范围内（可用 RPC 或宽松：`created_at >= 月初 UTC 近似`；实现时用明确的月初/月末 UTC 瞬时换算，或 SQL `created_at AT TIME ZONE 'Asia/Shanghai'`）。

一期允许用两次 query：count 日、sum 月、count 分钟、count 全局分钟。

- [ ] **步骤 5：实现 `recordHostedUsage(adminSb, { userId, functionName, model, usage })`**

从 OpenAI 兼容响应取 `usage.prompt_tokens` / `completion_tokens` / `total_tokens`；缺失则：

```ts
const estimate = Math.ceil(JSON.stringify(payloadHint || "").length / 4);
```

插入 `ai_usage_logs`，`source: 'hosted'`。

- [ ] **步骤 6：实现 `jsonError(code, message, status, corsHeaders)` 辅助**

返回统一形状：`{ error: message, code }`。

---

### 任务 3：改造 `ai-chat`

**文件：**
- 修改：`supabase/functions/ai-chat/index.ts`

- [ ] **步骤 1：删除本地 `PLATFORM_URLS`（改从 `_shared/hostedAi.ts` 导入）**

Deno 相对导入：`import { resolveAiCredentials, recordHostedUsage, jsonError, PLATFORM_URLS } from "../_shared/hostedAi.ts";`  
（若部署 bundler 不支持 `_shared`，改用与现有项目一致的共享方式；本仓库若尚无 `_shared`，创建后用 `supabase functions deploy` 验证。）

- [ ] **步骤 2：替换「必须有 ai_api_key」块为：**

```ts
const resolved = await resolveAiCredentials(adminSb, user.id, settings);
if (!resolved.ok) {
  return jsonError(resolved.code, resolved.message, resolved.status, corsHeaders);
}
const { apiKey, model, baseUrl } = resolved.creds;
```

- [ ] **步骤 3：上游成功解析后、return 之前**

```ts
if (resolved.creds.mode === "hosted") {
  await recordHostedUsage(adminSb, {
    userId: user.id,
    functionName: "ai-chat",
    model,
    usage: result.usage,
    estimateFrom: content,
  });
}
```

- [ ] **步骤 4：上游 `!response.ok` 时**

hosted 与 byok 均可返回 502，`code: "UPSTREAM_ERROR"`；**不要**写 usage。

- [ ] **步骤 5：本地或远程 deploy**

```bash
supabase functions deploy ai-chat --no-verify-jwt=false
```

预期：deploy 成功。用有权益账号、清空 settings Key 试一次 invoke。

---

### 任务 4：改造 `estimate-difficulty`

**文件：**
- 修改：`supabase/functions/estimate-difficulty/index.ts`

- [ ] **步骤 1：同样接入 `resolveAiCredentials` / `recordHostedUsage`**

`functionName: "estimate-difficulty"`。

- [ ] **步骤 2：deploy**

```bash
supabase functions deploy estimate-difficulty
```

---

### 任务 5：前端类型与错误文案

**文件：**
- 修改：`src/integrations/supabase/types.ts`
- 创建：`src/lib/aiErrors.ts`

- [ ] **步骤 1：在 `types.ts` 的 `Tables` 中增加 `ai_entitlements` 与 `ai_usage_logs` 行类型**（与 migration 列一致；参照现有表风格）

- [ ] **步骤 2：创建 `aiErrors.ts`**

```ts
const MAP: Record<string, string> = {
  AI_NOT_CONFIGURED: "请开通托管 AI，或在设置中填写自己的 API Key",
  HOSTED_DISABLED: "托管 AI 已停用，请使用自己的 API Key 或联系管理员",
  HOSTED_RATE_LIMIT: "请求过于频繁，请稍后再试",
  HOSTED_QUOTA_EXCEEDED: "今日或本月托管额度已用完。可在设置中填写自己的 API Key 继续使用",
  HOSTED_NOT_PROVISIONED: "托管 AI 暂未配置完成，请稍后或改用自己的 API Key",
  UPSTREAM_ERROR: "AI 服务暂时不可用，请稍后重试",
};

export function formatAiError(payload: { error?: string; code?: string } | null): string {
  if (payload?.code && MAP[payload.code]) return MAP[payload.code];
  return payload?.error || "AI 调用失败";
}
```

- [ ] **步骤 3：`AIChatPanel.tsx` 在 invoke 失败/返回 error 处改用 `formatAiError`**

`WrongAnswerForm.tsx` 同步改一处（若有展示 error）。

---

### 任务 6：设置页托管状态

**文件：**
- 创建：`src/hooks/useHostedAiStatus.ts`
- 修改：`src/pages/Settings.tsx`

- [ ] **步骤 1：实现 hook**

```ts
// useHostedAiStatus:
// 1) supabase.from('ai_entitlements').select('*').maybeSingle()
// 2) 当月 token：from('ai_usage_logs').select('total_tokens')
//    .gte('created_at', monthStartIso).eq('source','hosted')
//    在客户端 sum；或单次 select 后 reduce
// 3) 当日次数：count 查询 .gte('created_at', dayStartIso)
// 返回 { entitlement, monthlyUsed, dailyUsed, loading, error }
```

月/日起点用 `Asia/Shanghai`（与 Edge 一致）。

- [ ] **步骤 2：Settings「AI 配置」卡片上方或下方增加「托管 AI」Card**

展示：

- 状态：未开通 / 已开通（若有 `expires_at` 显示日期）
- 本月用量：`monthlyUsed / monthly_token_limit`
- 今日请求：`dailyUsed / daily_request_limit`
- 说明：开通后优先使用平台模型；超额不会自动改用你自己的 Key

无权益时隐藏用量数字，只显示「未开通 · 可使用下方自带 Key」。

---

### 任务 7：端到端验证

- [ ] **步骤 1：无权益 + 无 Key** → 400 / `AI_NOT_CONFIGURED`
- [ ] **步骤 2：无权益 + 有 Key** → BYOK 成功；`ai_usage_logs` 无新 hosted 行
- [ ] **步骤 3：有权益 + 清空 Key** → 托管成功；有 usage 行；模型为 secrets 中的 `gemini-3.1-flash-lite`
- [ ] **步骤 4：将某用户 `daily_request_limit` 临时改为 0 或 1 打满** → 402 文案正确
- [ ] **步骤 5：Settings 页用量数字与日志一致**

---

### 任务 8：收尾

- [ ] **步骤 1：确认 `HOSTED_AI_ENABLED` 未误设为 false**
- [ ] **步骤 2：规格状态改为「已实现」**（实现完成后改 `docs/superpowers/specs/2026-07-31-hosted-ai-hybrid-design.md` 头部状态）
- [ ] **步骤 3：仅在用户要求时 git commit**（中文约定可用：`feat(ai): 混合托管 AI 与用量限流`）

---

## 风险与注意

1. Supabase Edge 对 `../_shared` 的支持：deploy 时把 `_shared` 一并上传；若失败，改为把共享文件复制进各 function 目录（次优）。
2. `gemini-3.1-flash-lite` 必须与 Google 实际模型 ID 一致；若上游 404，在 AI Studio 核对 ID 后只改 Secret `HOSTED_AI_MODEL`，无需改代码默认值以外的逻辑。
3. 计量有竞态（并发双请求可能略超日限 1 次）：一期可接受；二期可上 DB 函数原子扣减。
4. 不要把 Key 写进 migration、前端或 git。
