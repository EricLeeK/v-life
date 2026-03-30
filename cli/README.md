# V-Life CLI

V-Life Manager 的命令行工具，通过 Supabase REST API 直接操作数据。

## 安装

无需安装额外依赖，使用 Node.js 18+ 即可运行（需要原生 `fetch` 支持）。

## 配置

设置环境变量：

```bash
export VLIFE_SUPABASE_URL="https://wwrmlhwlthairbfuqlxc.supabase.co"
export VLIFE_SUPABASE_KEY="your-service-role-key-here"
```

## 使用方法

```bash
# 查看帮助
node cli/vlife.mjs

# ─── 食材管理 ───
node cli/vlife.mjs pantry list
node cli/vlife.mjs pantry list --category="新鲜食材"
node cli/vlife.mjs pantry create --name="鸡蛋" --category="新鲜食材" --quantity="10个" --expiry_date="2026-04-05"
node cli/vlife.mjs pantry update --id=<uuid> --quantity="5个"
node cli/vlife.mjs pantry delete --id=<uuid>

# ─── 记账 ───
node cli/vlife.mjs finance list --month=2026-03
node cli/vlife.mjs finance create --name="午饭" --amount=850 --currency=JPY --category="餐饮" --date=2026-03-30
node cli/vlife.mjs finance create --name="咖啡" --amount=15 --currency=CNY --category="餐饮" --date=2026-03-30

# ─── 待办 ───
node cli/vlife.mjs todos list --importance=紧急
node cli/vlife.mjs todos list --is_completed=false
node cli/vlife.mjs todos create --title="买牛奶" --category="生活" --importance="普通"
node cli/vlife.mjs todos update --id=<uuid> --is_completed=true

# ─── 随想 ───
node cli/vlife.mjs thoughts create --content="用LLM做个人助手" --tags="AI,科研"
node cli/vlife.mjs thoughts list --tag=AI

# ─── 日程 ───
node cli/vlife.mjs schedule list --start_date=2026-03-30 --end_date=2026-04-05
node cli/vlife.mjs schedule create --title="组会" --start_time="2026-03-31T15:00:00" --end_time="2026-03-31T17:00:00"

# ─── 热量 ───
node cli/vlife.mjs calories list --date=2026-03-30
node cli/vlife.mjs calories create --food_name="拉面" --calories=600 --meal_type=lunch --date=2026-03-30

# ─── 用品 ───
node cli/vlife.mjs daily list
node cli/vlife.mjs durable list
node cli/vlife.mjs durable create --name="MacBook" --category="电子产品" --purchase_price=15000 --purchase_date=2025-01-01 --expected_lifespan_days=1825

# ─── 数据管理 ───
node cli/vlife.mjs data export --output=./backup.json
node cli/vlife.mjs data import --input=./backup.json

# ─── 概览 ───
node cli/vlife.mjs dashboard summary
```

## 与 AI Agent 配合使用

### MCP Server

项目同时部署了 MCP Server（Edge Function），可在 Cursor / Claude Desktop 中使用：

```json
{
  "mcpServers": {
    "vlife": {
      "url": "https://wwrmlhwlthairbfuqlxc.supabase.co/functions/v1/mcp-server"
    }
  }
}
```

MCP Server 暴露了所有模块的 CRUD Tools 以及 Dashboard/Finance/Calories Resources。
