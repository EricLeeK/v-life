# 托管 AI 混合模式（一期）设计文档

> **日期：** 2026-07-31  
> **版本：** v1.0  
> **状态：** 已实现（额度：月 100 万 / 日 50 / 分 10）  
> **范围：** 一期（平台 Key + 权益 + 计量限流）；不含支付收款（二期）

---

## 1. 背景与目标

V-Life 当前 AI 为 **BYOK**：用户在设置页填写自己的 API Key，`ai-chat` / `estimate-difficulty` Edge Function 用该 Key 调用模型。

产品化目标是 **混合模式**：

- 免费 / 未开通托管权益：继续自带 Key（BYOK）
- 开通托管权益：走服务端平台 Key，用户无需配置
- 为后续订阅收款留下权益与用量数据模型

### 一期成功标准

1. 有托管权益的用户，不填 Key 也能用 AI
2. 无权益用户行为与今天一致（必须自带 Key）
3. 每次托管调用写入用量；超限被拒绝并返回可读错误
4. 平台 Key 只存在 Supabase Edge Secrets，不进数据库、不进前端
5. 管理员可手动为用户开关托管权益（支付二期再自动化）

### 明确不做（二期）

- Stripe / 微信 / 支付宝收款
- 自动续费、发票、套餐商城页
- 号池、网页逆向、非官方账号轮询
- 多供应商自动故障转移（可后续加）

---

## 2. 设计决策

### 2.1 路由策略：托管优先，否则 BYOK

对每次 AI 请求（已登录用户）：

```
if 用户有有效托管权益 and 未超个人额度 and 平台 Key 已配置:
    使用平台 Key + 平台默认模型
else if 用户 settings 中有 ai_api_key:
    使用用户自己的 Key / platform / model / base_url
else:
    返回 400，提示「开通托管 AI 或在设置中填写 API Key」
```

说明：

- **有权益但超限**：不静默回落 BYOK（避免用户误以为还在用托管额度）；返回 429/402 类业务错误，文案说明已达上限。若用户同时配了自己的 Key，前端可提示「可改用自己的 Key」——一期仅在错误文案中提示，不做自动切换。
- **有权益且平台 Key 未配置**：返回 503，提示管理员配置 secrets（避免误用空 Key）。

### 2.2 密钥存放：仅 Edge Secrets

| 变量名 | 含义 | 示例 |
|--------|------|------|
| `HOSTED_AI_API_KEY` | 平台 API Key | （保密） |
| `HOSTED_AI_PLATFORM` | 平台标识 | `gemini`（默认） |
| `HOSTED_AI_MODEL` | 默认模型 | `gemini-3.1-flash-lite` |
| `HOSTED_AI_BASE_URL` | 可选覆盖 | 空则用现有 `PLATFORM_URLS` |

不写入 `settings` 表，不出现在 `types` 的客户端可读字段中用于「平台密钥」。

### 2.3 权益模型：手动开通的 entitlement

一期不用支付 webhook，用表记录「谁能用托管 AI、额度多少、何时到期」。

默认额度（可在实现时用常量，后续改配置表）：

| 项 | 默认值 |
|----|--------|
| 每月 token 上限（input+output 合计） | 1_000_000 |
| 每日请求上限 | 50 |
| 每分钟请求上限 | 10 |
| 权益有效期 | `expires_at` 可空=不过期 |

全站保护（防尖峰打爆上游）：

| 项 | 默认值 |
|----|--------|
| 全站托管 AI 每分钟总请求 | 120 |

数字可在代码常量中调整；一期不做管理后台改配额 UI（可用 SQL 改行）。

### 2.4 计量：请求级日志 + 月度聚合查询

每次成功打到上游的托管调用写一条 usage 日志。BYOK 调用**不记入**托管额度（可选记 `source=byok` 供分析，一期为简化：**仅记录 hosted**）。

Token：优先用上游响应的 `usage`；若无则按字符粗估（记录 `token_estimate=true`）。

### 2.5 限流位置：Edge Function 内、调上游之前

顺序：

1. 鉴权  
2. 判定路由（hosted / byok）  
3. 若 hosted：检查权益有效 → 分钟/日/月额度 → 全站分钟额度  
4. 调用上游  
5. 写 usage（失败上游不扣月额度；分钟计数可用「尝试前占坑」或「成功后计数」——一期采用 **成功后计数 + 分钟滑动用 DB/内存近似**；为防刷，**在调用前用「今日次数 + 本分钟次数」预检**，预检用 usage 表 count）

429 上游：对客户端返回「服务繁忙，请稍后重试」，并打日志；不重试超过 1 次（避免放大账单）。

### 2.6 涉及的现有调用点

| 函数 | 调用方 | 一期改造 |
|------|--------|----------|
| `ai-chat` | `AIChatPanel`、`WrongAnswerForm` | 混合路由 + 计量限流 |
| `estimate-difficulty` | `useData` | 同上（共享解析 Key / 权益逻辑） |

抽取共享模块：`supabase/functions/_shared/hostedAi.ts`（Deno），避免两处复制。

### 2.7 设置页 UX

- 保留现有 BYOK 配置（平台 / Key / 模型 / Base URL）
- 新增「托管 AI」区块（只读状态）：
  - 未开通 / 已开通（到期日）
  - 本月已用 token / 上限
  - 今日请求数 / 上限
- 文案说明：开通后优先使用平台服务；自带 Key 仍可用于未开通或超额后的自行调用（超额不自动切换，见 2.1）

一期不提供用户自助购买按钮（二期）。

### 2.8 管理员开通方式（一期）

无管理后台。使用 SQL（或后续小脚本）插入/更新 `ai_entitlements`：

```sql
insert into public.ai_entitlements (user_id, status, monthly_token_limit, expires_at)
values ('<uuid>', 'active', 1000000, null)
on conflict (user_id) do update
set status = 'active', monthly_token_limit = excluded.monthly_token_limit, expires_at = excluded.expires_at;
```

---

## 3. 数据模型

### 3.1 `ai_entitlements`

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid PK, FK → auth.users | 一用户一行 |
| `status` | text | `active` \| `disabled` |
| `monthly_token_limit` | int | 默认 1000000 |
| `daily_request_limit` | int | 默认 50 |
| `per_minute_limit` | int | 默认 10 |
| `expires_at` | timestamptz null | null=不过期 |
| `created_at` / `updated_at` | timestamptz | |

RLS：

- 用户可读自己的行  
- 用户不可写（仅 service role / SQL 管理）

### 3.2 `ai_usage_logs`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid PK | |
| `user_id` | uuid | |
| `source` | text | 固定 `hosted`（一期） |
| `function_name` | text | `ai-chat` / `estimate-difficulty` |
| `model` | text | |
| `input_tokens` | int | |
| `output_tokens` | int | |
| `total_tokens` | int | |
| `token_estimate` | boolean | 是否估算 |
| `status` | text | `ok` \| `upstream_error`（可选，一期只插 ok） |
| `created_at` | timestamptz | 索引 (user_id, created_at) |

RLS：

- 用户可读自己的汇总所需行（或只读聚合 RPC）  
- 用户不可写；Edge 用 service role 写入

### 3.3 索引

- `ai_usage_logs (user_id, created_at desc)`
- 可选：`(created_at)` 供全站每分钟统计

---

## 4. 架构与数据流

```
[浏览器]
   │  supabase.functions.invoke('ai-chat')
   ▼
[Edge Function]
   │  JWT → user_id
   │  读 ai_entitlements（service role）
   │  读 settings.ai_*（BYOK 回落）
   ├─ hosted ─► 预检额度 ─► HOSTED_AI_* 调上游 ─► 写 ai_usage_logs
   └─ byok   ─► settings.ai_api_key 调上游（不写托管用量）
   ▼
[上游 Gemini / DeepSeek / ...]
```

```
设置页只读状态：
  entitlements + 当月 sum(total_tokens) + 当日 count(*)
```

---

## 5. API / 错误约定

Edge 对客户端 JSON 错误字段建议：

| HTTP | `error` 码（或 message 前缀） | 场景 |
|------|------------------------------|------|
| 400 | `AI_NOT_CONFIGURED` | 无权益且无 BYOK Key |
| 403 | `HOSTED_DISABLED` | 权益 disabled / 过期 |
| 429 | `HOSTED_RATE_LIMIT` | 个人或全站频率超限 |
| 402 | `HOSTED_QUOTA_EXCEEDED` | 日/月额度用尽 |
| 503 | `HOSTED_NOT_PROVISIONED` | 未配置平台 Secret |
| 502 | `UPSTREAM_ERROR` | 上游失败 |

前端：`AIChatPanel` 等展示对应中文提示即可。

---

## 6. 安全

1. 平台 Key 仅 Secrets；日志禁止打印 Key  
2. 所有 AI Edge 必须 JWT；拒绝匿名  
3. 用户不能通过 API 改 `ai_entitlements`  
4. 托管路径忽略客户端传入的「指定用平台 Key」之外的密钥覆盖（客户端不可上传平台密钥）  
5. Google AI Studio Key 建议限制 API 范围；项目开 spend cap  

---

## 7. 配置与运维

### 7.1 写入 Secrets（实现前可先做）

项目已 link：`veabdivlfhctseihypzl`（v-life）。

```bash
supabase secrets set \
  HOSTED_AI_API_KEY="***" \
  HOSTED_AI_PLATFORM="gemini" \
  HOSTED_AI_MODEL="gemini-3.1-flash-lite"
```

也可用 Dashboard：Project → Edge Functions → Secrets。

### 7.2 开通内测用户

对指定 `user_id` 插入 `ai_entitlements`（见 2.8）。

### 7.3 观察

- AI Studio Rate Limit / Usage 面板  
- `ai_usage_logs` 按日聚合  
- Edge 日志中的 429/上游错误率  

---

## 8. 测试计划

| 场景 | 期望 |
|------|------|
| 无权益 + 无 Key | 400 `AI_NOT_CONFIGURED` |
| 无权益 + 有 Key | BYOK 成功，无 usage 托管行 |
| 有权益 + 无 Key + Secret 已配 | 托管成功，有 usage 行 |
| 有权益 + 超月额度 | 402，不调上游 |
| 有权益 + 超每分钟 | 429 |
| Secret 未配 + 有权益 | 503 |
| 权益过期 | 403，有 BYOK 时可仍走 BYOK（过期视为无托管权益，走 2.1 第二分支） |

---

## 9. 回滚

1. 去掉 Edge 中托管分支或设 feature flag（环境变量 `HOSTED_AI_ENABLED=false`）强制全员 BYOK  
2. Migration 表可保留；停写即可  
3. 删除 Secrets 中的 Key 即停止托管出站调用  

建议实现时加：`HOSTED_AI_ENABLED` 默认 `true`，便于紧急关闭。

---

## 10. 二期预留（不实现）

- `subscriptions` / 支付 webhook → 自动写 `ai_entitlements`  
- 套餐页、用量仪表盘增强  
- 超额可购加油包  
- OpenRouter 双活  

权益表字段已够二期「支付成功 → upsert entitlement」使用，无需推翻。

---

## 11. 实现文件预估

| 路径 | 变更 |
|------|------|
| `supabase/migrations/20260731_hosted_ai.sql` | 新表 + RLS |
| `supabase/functions/_shared/hostedAi.ts` | 路由、额度、secrets |
| `supabase/functions/ai-chat/index.ts` | 接入共享逻辑 |
| `supabase/functions/estimate-difficulty/index.ts` | 同上 |
| `src/integrations/supabase/types.ts` | 类型 |
| `src/pages/Settings.tsx` | 托管状态展示 |
| `src/hooks/...` 或轻量 query | 读权益与用量汇总 |
| 可选：`src/lib/aiErrors.ts` | 错误码文案 |

预计改动文件约 8–12 个，无新独立服务。

---

## 12. 已确认项

1. 默认额度：月 **100 万** token / 日 **50** 次 / 分 **10** 次  
2. 超额不自动切 BYOK（仅文案提示）  
3. 一期管理员仅 SQL 开通  
4. 平台默认模型：`gemini-3.1-flash-lite`（Secrets 已配置）
