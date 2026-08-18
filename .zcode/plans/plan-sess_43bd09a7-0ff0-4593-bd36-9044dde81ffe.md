# 兑换码会员体系（托管 AI）实施方案

## 决策（已确认）
- 存量授权：**立即全部失效**（migration 中将所有 `ai_entitlements.expires_at` 置为 `now()`）
- 发码工具：**Admin edge function + curl**（`x-admin-key` 环境变量密钥保护，`--no-verify-jwt` 部署）
- 月卡 = 30 天滚动，年卡 = 365 天滚动；配额沿用现有默认（1M tokens/月、50 次/天、10 次/分钟），两种卡只有时长差异
- 重复兑换 = 叠加延长（从 max(当前到期日, now) 顺延）
- 兑换码只存 **SHA-256 哈希**（防拖库），另存 9 字符前缀用于售后对码

## 一、数据库（migration `20260814_redemption_codes.sql`）

1. `redemption_codes` 表：`code_hash text unique`、`code_prefix text`（展示/对码用）、`plan ('monthly'|'yearly')`、`note`（管理备注，如「闲鱼批次」）、`batch_id uuid`、`status ('unused'|'redeemed'|'disabled')`、`redeemed_by`/`redeemed_at`、`created_at`。RLS 开启但**零策略**（仅 service role 可读写）。
2. 原子兑换 RPC `redeem_ai_code(p_code_hash, p_user_id)`，`SECURITY DEFINER`：
   - `FOR UPDATE` 锁行 → 校验 status（unused 才可用）→ 错误码返回 `CODE_NOT_FOUND` / `CODE_ALREADY_REDEEMED` / `CODE_DISABLED` / `ACCOUNT_DISABLED`（现有 entitlement `status='disabled'` 时拒兑）
   - upsert `ai_entitlements`：新用户 `expires_at = now() + duration`；已有则 `greatest(coalesce(expires_at, now()), now()) + duration`，status 置 active
   - 标记码 `redeemed` + `redeemed_by/at`；返回 `(ok, error, plan, expires_at)`
   - `revoke all from public/authenticated; grant execute to service_role`（只能由 edge function 调用）
   - 哈希由 edge function 在 JS 侧算好传入（复用已测试的纯模块，避免 pgcrypto 依赖）
3. 存量失效：`update ai_entitlements set expires_at = now() where expires_at is null or expires_at > now()`（先 SELECT 预览受影响行数再执行）

## 二、共享纯模块（TDD 先行）

`supabase/functions/_shared/redemptionCode.ts` + 同目录测试（vitest 已收录该目录）：
- `generateRedemptionCode()` → `VL` 前缀 + 16 位 Crockford 风格随机字符（去掉 0/1/O/I 混淆字符，≈79 bit 熵），展示为 `VLXXXX-XXXX-XXXX-XXXX` 分组
- `normalizeRedemptionCode(input)` → 大写 + 去掉所有非字母数字（容忍用户粘贴时带空格/横线/小写）
- `sha256Hex(text)` → Web Crypto subtle（Deno/Node 通用；若 jsdom 测试环境无 subtle，该测试文件加 `// @vitest-environment node`）
- 测试：格式正则、无混淆字符、归一化各 case、哈希确定性、批量唯一性

## 三、Edge functions

**`redeem-code`**（JWT 验证，复用 estimate-difficulty 模式）：
- POST `{code}` → 归一化 + 哈希 → `adminSb.rpc("redeem_ai_code", …)` → 成功返回 `{ok, plan, expires_at}`，失败映射中文错误文案（沿用 aiErrors 风格）

**`redemption-admin`**（`--no-verify-jwt`，`x-admin-key` 恒时比对 `ADMIN_API_KEY` secret）：
- POST `{action:"generate", plan, count≤500, note}` → 批量生成，**唯一一次**返回明文码列表（之后库中只有哈希）
- POST `{action:"disable", batch_id}` → 作废整批未用码
- GET `?status=&batch_id=` → 列出元数据（前缀/套餐/状态/兑换人/时间，无明文码）

## 四、客户端（Settings.tsx「托管 AI」卡片）

- 卡片内加兑换区：输入框（自动大写）+「兑换」按钮，未开通时作为主操作、已开通时用于续费叠加
- `supabase.functions.invoke("redeem-code")`；成功 toast 显示「已开通/已续至 X 日期」并 invalidate `["ai-hosted-status"]`；失败显示中文错误
- 双语文案，保持安静 UI 风格；demo 模式隐藏

## 五、部署与验证

1. 只读检查线上 `ai_entitlements` 现状（行数/无到期行数）→ 报告数字
2. migration 经 `supabase db query --linked -f` 应用 + 手动补 `schema_migrations`（`text[]`，db push 因 IPv6 不可用——既有经验）
3. `supabase secrets set ADMIN_API_KEY=<随机生成>`；部署两个 function
4. 冒烟测试：admin curl 生成月卡测试码 → 直接调 RPC 验证兑换/叠加/重兑拒绝/无效码四条路径（在测试数据上做，先快照后还原）→ 客户端 UI 你手动点击验证
5. 全量 vitest + tsc + eslint（不新增存量问题）

## 六、交付物
- 4 个新文件（migration、共享模块+测试、2 个 function）+ Settings.tsx 修改 + curl 使用速查（写入最终说明）
- 你后续卖码的工作流：`curl -X POST .../redemption-admin -H "x-admin-key: …" -d '{"action":"generate","plan":"monthly","count":20,"note":"闲鱼8月"}'` → 拿到明文码列表去上架