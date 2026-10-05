# Agent API Key 重构交付记录

2026 年 10 月 5 日。本地实现和验证已完成，正式环境尚未部署。此记录供维护者检查实现、执行发布和处理回退；不能作为线上连接已经成功的证明。

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

以上未验证真实 Supabase 签名信任、生产数据库部署、真实账户生成 Key、Hermes 客户端配置或真实 MCP 工具执行。这些必须在发布时完成。

## 正式环境部署条件

只读检查确认：项目 `veabdivlfhctseihypzl` 当前公开签名算法为 ES256，Edge secrets 列表中尚无 `AGENT_JWT_SIGNING_JWK`。现有公开 JWKS 不能用于签名，也无法从 Supabase 取出现有托管私钥。

服务需要一个 Supabase Auth 信任的私有 P-256 ES256 JWK，`kid` 必须与已激活的签名公钥一致，并以 `AGENT_JWT_SIGNING_JWK` 保存为 Edge secret。它不能出现在前端环境变量、仓库、命令行参数、截图或日志中。Supabase 官方支持导入自有签名密钥并用它签发外部 JWT，见 [JWT 文档](https://supabase.com/docs/guides/auth/jwts) 和 [签名密钥文档](https://supabase.com/docs/guides/auth/signing-keys)。

导入和激活会修改正式项目的认证签名配置。这一步与生产数据库迁移、服务发布一起，在执行前向项目所有者确认。保留已有签名密钥的验证能力，不撤销旧密钥；先验证既有登录与 OAuth，再启用新界面。这里的确认是对生产认证配置变更的发布控制，不是本地开发步骤。

## 发布顺序

1. 从已审查的文件集合准备独立发布来源。当前工作区还有其他任务的改动，不能直接全量提交或发布整个工作区。
2. 检查生产迁移记录和依赖，只应用 `20261005010000_agent_api_keys.sql`。不要无差别执行所有待迁移文件或修改无关迁移记录。
3. 安全生成并导入私有 ES256 JWK，按 Supabase 流程激活，等待签名公钥传播并检查 `kid`。保留旧密钥，验证旧登录和 OAuth 仍可用，再配置对应 Edge secret。
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
