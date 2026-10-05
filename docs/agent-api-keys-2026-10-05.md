# Agent API Key 重构交付记录

2026 年 10 月 5 日 22:10（北京时间），正式后端发布及端到端验证已完成。生产项目为 `veabdivlfhctseihypzl`，`mcp-server` 版本 24、`agent-api` 版本 14。网站此前已发布新版设置页，本次补齐数据库迁移、签名配置和两个接入接口。

本次将 API Key 作为设置页的默认 Agent 连接方式，解决手工配置 OAuth 回调、授权跳转和刷新令牌带来的接入负担。支持 Bearer Token 或自定义 Authorization 请求头的客户端，复制一次 Key 即可使用 MCP 或 HTTP API。只支持 OAuth 的客户端仍使用兼容入口。

## 用户流程

1. 打开设置中的 Agent 连接，填写名称并选择权限。默认仅允许读取。
2. 选择 30 天、90 天、指定日期或永久。指定日期包含当天，按北京时间次日 00:00 失效。
3. 生成后复制 API Key、给 Agent 的完整接入说明或 MCP JSON 配置。完整 Key 只返回一次，仅在当前页面内存中保留；收起或离开页面后不能重新读取。
4. 在列表查看权限、有效期和最近使用时间，也可随时撤销。撤销不可恢复，需要创建新的 Key 才能重新连接。

生成请求没有收到结果时，表单保留输入并提示先刷新列表；不会自动重试导致重复发放。列表读取失败保留上一次内容，并明确提示错误。演示模式不查询或创建真实连接。错误 OAuth 回调进入缺少授权请求的页面时，会提供 API Key 设置入口。

连接地址直接使用 Supabase Edge 端点，减少一个网站代理环节；原有正式域名 HTTP 地址继续兼容。API Key 路径不经过 OAuth 回调、客户端注册或 refresh token，因此消除了这些依赖，但仍依赖网络、Supabase 服务和客户端对 Bearer 认证的支持。

## 认证和数据隔离

数据库生成高熵 `vlife_` Key，在不向普通用户角色开放的表中保存 SHA-256 摘要。管理列表仅包含名称、前缀、权限、创建时间、到期时间和使用时间。每个用户最多同时持有 50 个未撤销且未过期的 Key。

MCP 和 HTTP 共用 `withAgentAuth`。Edge 每个请求验证摘要和当前权限，再签发最长 60 秒的内部用户 JWT，其 subject 为 Key 所属用户，并包含 `client_id` 和 `agent_key_id`。内部 Token 不返回客户端。业务数据继续使用用户级 Supabase 客户端、现有 RLS、领域 RPC、幂等和审计；新增 service-role 用途仅为调用摘要解析函数。长任务在内部 Token 即将到期时重新验证 Key 并续签。

数据库的 `agent_permission` 在读写时检查到期、撤销和摘要存在性。撤销操作删除摘要，因此已签发的短 Token 也不能继续读取或写入受保护数据。Agent 不能创建其他 Key、管理授权或读取模型密钥等私密设置。既有 OAuth 授权记录自动保留为 `credential_type=oauth`。

无效、过期或撤销的 Key 返回 `401 API_KEY_INVALID`。签名配置不完整和认证服务故障返回不同的 `503` 错误，避免把服务器故障误导为用户需要不断换 Key。

## 本地验证证据

| 检查 | 结果与范围 |
| --- | --- |
| Vitest | 49 项通过，覆盖界面流程、演示隔离、有效期、现有授权和数据服务 |
| Deno | 41 项通过，包含两种真实入口 handler 的请求测试；外部数据库边界使用受控替身 |
| PostgreSQL 权限测试 | 隔离 PGlite 中使用实际迁移、数据库角色和 RLS，验证创建、摘要隔离、跨用户隔离、到期、撤销、领域写入与旧 OAuth 权限；事务最终回滚 |
| 类型与静态检查 | 网页类型检查、两个 Edge 入口和部署验证脚本的 Deno 类型检查、变更前端文件 ESLint 均通过 |
| 生产构建 | 通过；保留已有的大于 500 kB 分包提示 |
| 独立审查 | 未发现认证、隔离、到期、撤销路径上的实质问题；强调签名配置必须先完成 |

数据库验证：`PGLITE_MODULE="$PWD/temp/agent-keys-check/node_modules/@electric-sql/pglite/dist/index.js" node scripts/check-agent-keys-db.mjs`。PGlite 安装位于忽略的临时目录；复现时可将 `PGLITE_MODULE` 指向已安装的 `@electric-sql/pglite` 模块。

界面使用实际组件、项目样式和独立的本地测试数据，检查了桌面 1280 像素、手机 390 像素及深色模式。交互验证包括指定日期、永久 Key、复制配置、收起完整 Key、撤销确认和撤销后的焦点恢复。截图中的 Key 均为假数据，未创建正式账户凭证。

- [初始桌面界面](assets/agent-connection/settings-desktop.png)
- [初始手机界面](assets/agent-connection/settings-mobile.png)
- [永久 Key 生成结果](assets/agent-connection/key-created-desktop.jpg)
- [手机生成结果](assets/agent-connection/key-created-mobile.jpg)
- [深色界面](assets/agent-connection/settings-dark.png)

以上表格记录开发阶段验证。发布时另外通过了签名兼容及入口认证的 12 项 Deno 测试，以及两个 Edge 入口和验证脚本的类型检查。

## 正式环境验证

先在正式 PostgreSQL 中把新迁移、API Key 权限测试和旧 OAuth 回归放入同一事务，全部通过后回滚。随后单独应用 `20261005010000_agent_api_keys.sql`，在同一事务记录迁移版本并通知 PostgREST 重载 schema；未应用其他待迁移文件。

使用两个临时 Auth 账户，经真实登录取得浏览器令牌，再通过与设置页相同的 RPC 创建 Key。以下 12 组检查全部通过，HTTP 和 MCP 都请求正式地址：

| 检查 | 结果 |
| --- | --- |
| 既有网站认证 | 密码登录与浏览器身份读取成功 |
| Key 管理 | 永久、指定到期时间的 Key 创建成功；列表正常读取，未暴露完整 Key |
| MCP 与 HTTP 接入 | MCP 初始化、工具发现、`agent_help` 和 HTTP guide 成功，权限一致 |
| OAuth 兼容 | 带 OAuth `client_id` 的可信 JWT 与旧类型授权记录通过两个入口；未重走第三方授权码交换 |
| 网站域名兼容 | `https://shenghuo.homes/api/v1/guide` 返回成功 |
| 数据操作 | HTTP 新建、相同幂等键重试、MCP 读取与修改成功 |
| 权限限制 | 只读 Key 的写入、删除被拒绝；Agent 身份不能发放 Key 或读取私密设置 |
| 用户隔离 | 另一账户不能读取测试记录或撤销其 Key |
| 管理状态 | 最近使用时间更新；允许删除的 Key 可以删除自己的测试记录 |
| 到期 | 等待短期 Key 自然到期后，HTTP 和 MCP 均返回 `401 API_KEY_INVALID` |
| 撤销 | 撤销后两个入口均返回 401，内部身份的数据库权限也立即失效 |
| OAuth discovery | 原有发现端点正常返回授权服务器 |

测试账户及其 Key、摘要和业务记录已清理，并再次查询确认无残留。本轮未操作实际用户的生活记录，也未替用户创建日常使用的 Key。尚未验证 Hermes 等具体客户端的设置界面；客户端需要支持 Bearer Token 或自定义 Authorization 请求头。

## 正式环境部署条件

发布前确认了故障原因：新界面已上线，数据库缺少 `credential_type` 等字段和创建函数，两个 Edge 函数仍为旧版，且缺少 `AGENT_JWT_SIGNING_JWK`。因此生成和列表请求都失败，重复刷新不能补齐服务端部署。

现已导入独立的私有 P-256 ES256 JWK，并将其保存为 Edge secret `AGENT_JWT_SIGNING_JWK`。`kid` 与项目已信任的公钥匹配。新密钥保留为 `standby`，正式 Data API 和两个 Edge 入口均已实测接受其签名；原有 `in_use` 登录签名密钥和旧验证密钥保持原状态，无需切换网站登录签名。Supabase 的公开 JWKS 只能验签，不能用来签名，也无法取出现有托管私钥。官方说明见 [JWT 文档](https://supabase.com/docs/guides/auth/jwts) 和 [签名密钥文档](https://supabase.com/docs/guides/auth/signing-keys)。

真实部署还发现 Supabase CLI 输出的 `key_ops: ["sign", "verify"]` 会被 Web Crypto 的 EC 私钥导入拒绝，造成 `API_KEY_AUTH_NOT_CONFIGURED`。认证层现验证密钥允许签名，再将导入用途收窄为 `sign`；只允许验签的密钥仍被拒绝。新增回归测试先复现失败，再验证修复与真实线上调用。

私钥不能出现在前端环境变量、仓库、命令行参数、截图或日志中。项目所有者已明确授权本次后端发布，包括数据库迁移、签名配置及接口部署。

## 发布顺序

1. 从已审查的文件集合准备独立发布来源。当前工作区还有其他任务的改动，不能直接全量提交或发布整个工作区。
2. 检查生产迁移记录和依赖，只应用 `20261005010000_agent_api_keys.sql`。不要无差别执行所有待迁移文件或修改无关迁移记录。
3. 安全生成并导入私有 ES256 JWK，检查 `kid` 和 Data API 的实际签名接受情况。若 `standby` 已被信任，无需切换全站登录签名。保留旧密钥，验证旧登录和 OAuth 仍可用，再配置对应 Edge secret。
4. 部署 `mcp-server` 和 `agent-api`。两个函数继续使用应用层认证；`verify_jwt=false` 不能替代 `withAgentAuth`。先确认原有 OAuth discovery 和调用仍可用。
5. 在可审阅的预览版本中，用正式账户创建短期只读 Key，执行 `scripts/verify-agent-key.ts`。脚本通过环境接收 `SUPABASE_URL` 和 `VLIFE_AGENT_API_KEY`，只验证 MCP 初始化、工具发现、使用指南与 HTTP 指南，且检查两边权限一致；不写入生活数据，也不输出凭证。不要将 Key 放到命令行参数。
6. 撤销测试 Key，确认两个接口对该 Key 返回 401；额外检查一把已到期 Key。实际 Hermes 配置采用 Bearer API Key 或 Authorization 请求头，调用指南并查看最近使用时间。
7. 发布设置页和 OAuth 错误恢复入口，再以正式地址完成一次用户流程。记录真实验证时间和结果后，将本文和接入说明中的待部署状态更新。

## 回退

若签名配置或真实 Key 验证失败，暂不发布新界面，保留旧 OAuth。若新界面已经发布，先回退界面和两个 Edge 函数到上一版；新增表和列可保留，避免删除授权数据。API Key 在旧函数上不可用，需明确告知已接入用户。不要为回退本功能撤销仍用于登录的签名密钥。

## 主要文件

- 界面与客户端封装：`src/components/AgentConnections.tsx`、`src/components/AgentOAuthConnections.tsx`、`src/lib/agentKeys.ts`、`src/lib/agentKeyStore.ts`。
- 共用认证：`supabase/functions/_shared/agentAuth.ts`、`supabase/functions/_shared/agentKeyAuth.ts`。
- 数据库：`supabase/migrations/20261005010000_agent_api_keys.sql`、`supabase/tests/agent_api_keys.sql`。
- 验证：`src/components/AgentConnections.test.tsx`、`src/lib/agentKeys.test.ts`、`supabase/functions/mcp-server/agentKeyAuth.test.ts`、`supabase/functions/mcp-server/agentAuthentication.test.ts`、`scripts/check-agent-keys-db.mjs`、`scripts/verify-agent-key.ts`。
