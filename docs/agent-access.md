# Agent 接入与维护

## 用户连接

在支持远程 MCP 和 OAuth 的客户端添加 `https://veabdivlfhctseihypzl.supabase.co/functions/v1/mcp-server/mcp`，完成网站登录，选择读取、新增/修改和删除权限。用户不提供 API Key 或浏览器 Session。设置 → 数据 → 已连接的 Agent 可复制地址、查看权限和撤销；撤销先禁止数据请求，再撤销 OAuth grant，失败可重试。

只支持 HTTP/OpenAPI 的 Agent 使用 `https://shenghuo.homes/api/v1`。首次未登录请求会返回 OAuth protected-resource discovery；授权后可读取 `/openapi.json` 和 `/capabilities`，再调用 `/{module}`、`/{module}/{id}`、`/{module}/export`、`/summary/{name}`。写请求用 `Idempotency-Key`，响应携带 `X-Request-Id`。

## 数据与授权

- `moduleRegistry.ts` 定义字段和操作；`agentDataService.ts` 负责校验、用户范围查询、关系消歧和分页。
- 官方 `@supabase/server` middleware 完成 OAuth discovery 和 ES256/RS256 JWT 验证；每请求检查用户与 `client_id` 对应的授权。
- 写入通过 `agent_mutate` 数据库事务处理：身份来自 JWT、白名单字段、RLS、财务换算、审计、幂等键一致提交。函数由无登录、无 BYPASSRLS 的专用角色拥有；不使用 `service_role`。
- OAuth Token 对普通表只允许授权后的 RLS 读取；写入只能经过领域 RPC；设置和其他未注册表禁止 OAuth 访问。浏览器 Session 保持原有权限。
- 幂等键按用户和客户端隔离，与模块、操作、记录 ID、输入内容绑定。并发重复请求在事务锁上等待，失败操作不缓存成功响应。
- 审计不保存完整输入、Token 或密钥。`agent_action_logs` 保存工具、操作、记录、结果、请求 ID 和时间。写入事务和 MCP 请求分别记录，可按请求 ID 关联。
- 财务汇总遍历所有分页；导出明确返回分页信息，不把前 50 条当作全量数据。
- `daily_task` 的积分/母待办联动不作为普通 CRUD 暴露。JSON API 仍是后续适配器，本阶段提供 MCP。

## 配置与部署

Supabase Auth 配置：Site URL 为 `https://shenghuo.homes`，OAuth Server 和动态客户端注册开启，授权页路径 `/oauth/consent`，签名使用 ES256。不要把全量本地 Auth 配置推到生产，避免覆盖邮件、登录和其他现有配置。

应用迁移顺序为 `20260921120000_agent_access.sql`、`20260921150000_agent_hardening.sql`。已有项目迁移历史中含其他不一致版本，不能不经核对直接全量 `db push`。

```sh
supabase functions deploy mcp-server --use-api --no-verify-jwt
supabase functions deploy agent-api --use-api --no-verify-jwt
vercel deploy --prod
```

`verify_jwt=false` 只关闭网关校验，函数内的官方用户 JWT middleware 仍强制认证。`MCP_ALLOWED_ORIGINS` 可配置浏览器型 MCP 客户端来源；无 Origin 的原生客户端正常连接。

新增模块后运行 `deno run scripts/agent-contract.ts` 生成数据库写入白名单迁移；确认所有权、字段和表 RLS 后再发布。MCP 工具和 capability 自动来自注册表，数据库合同采用迁移发布，避免任意客户端扩大权限。

## 验证

```sh
npm test -- --run --maxWorkers=2
deno check --node-modules-dir=auto --config supabase/functions/mcp-server/deno.json supabase/functions/mcp-server/index.ts
deno check --node-modules-dir=auto --config supabase/functions/mcp-server/deno.json supabase/functions/agent-api/index.ts
deno test --no-lock supabase/functions/mcp-server/mcpAdapter.test.ts supabase/functions/agent-api/apiAdapter.test.ts
supabase db query --linked --file supabase/tests/agent_access.sql
npm run build
```

SQL 验收以事务运行并回滚，使用固定专用测试用户 UUID；不要删除 rollback。真实 OAuth 测试使用独立临时用户，测试后撤销授权并删除临时用户、客户端及其数据。

未登录 `/mcp` 和 `/api/v1/*` 应返回 401，`WWW-Authenticate` 指向可读取的 OAuth metadata，而不是网关的 Missing authorization header。登录后验证初始化、工具发现、读取、创建、修改、删除、重复创建、分页导出及撤销后的 403。
