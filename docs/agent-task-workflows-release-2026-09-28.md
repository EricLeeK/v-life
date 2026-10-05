# Agent 任务工作流 2.6.0 发布记录

2026-09-28 已发布到 Supabase 项目 `veabdivlfhctseihypzl`。

## 已发布内容

- 数据库迁移：`20260928010000_agent_task_workflows`，与版本记录在同一事务内提交。
- MCP：`mcp-server` v18，状态 `ACTIVE`。
- HTTP API：`agent-api` v8，状态 `ACTIVE`。
- 共享接口契约：`2.6.0`。新增 `daily_task_overview`、`daily_task_transfer`，旧 CRUD 工具保留。
- 仅发布外部 Agent 后端；本次没有迁移用户任务，也没有发布网页或 ai-chat。

## 验证证据

- 382 项应用/共享服务测试通过，31 项 MCP/API 协议测试通过；两个 Edge Function 的 Deno 类型检查通过。
- 新测试先在缺少实现时失败，再随实现通过；任务工作流数据库测试在本地 PGlite、远端迁移回滚试运行、正式函数发布后均通过。
- 数据库用专用用户及 `authenticated` 角色验证读写删除权限、跨用户拒绝、批量回滚、目标复用、积分/元数据保留、来源删除后的幂等重放、相对日期重试、权限撤销、超过50条的完整概览和超过500条的明确拒绝。
- 远端读回确认测试用户、授权、幂等键和日志均为零；生产函数正文哈希与本地一致。
- 下载已部署源码逐文件比较：MCP 的12个 TypeScript文件、HTTP API的13个 TypeScript文件均与本地一致。
- MCP地址及正式域名 `/api/v1/daily_task/overview?date=tomorrow` 未登录访问均返回401和OAuth资源发现头。
- `git diff --check` 通过。

| 数据库函数 | 正文 MD5（与 pg_proc.prosrc 比较） |
| --- | --- |
| `agent_private.resolve_task_date` | `d38884f4610db952ea6220048f5cbfbb` |
| `agent_private.task_transfer_reason` | `41fb710e3dcfdbe1748b1e34e77c2460` |
| `public.daily_task_overview` | `c32f01dfb8793f75669bdbf66de1b079` |
| `public.daily_task_transfer` | `563493bcec27b20fb1652b1787c010a6` |

协议测试使用模拟数据库；真实数据库行为另以回滚测试验证。尚未在用户的另一个 Agent 客户端执行完整 OAuth 会话和真实任务迁移，不能把未登录401检查当成此项验证。

使用参数、权限和返回语义见 [Agent 接入文档](agent-access.md)。已连接的客户端需要刷新工具列表或重新连接，才能发现新工具。
