<div align="center">

# 🌿 V-Life

**AI 辅助的一站式个人生活管理**

记录吃、住、用、想、赚、花、动、瘦、做。一处管理，AI 联动。

[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Radix-000000)](https://ui.shadcn.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Edge-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#-许可证)

</div>

---

## ✨ 项目简介

**V-Life** 是一个现代化的 **个人生活管理 Web 应用**，把日常零散的信息——日程、记账、热量、待办、目标、食材、用品、随想、减肥——统一收进同一个视图。前端基于 React + Vite + Tailwind + shadcn/ui，后端跑在 Supabase（Postgres + Edge Functions）。**所有模块共享同一份 AI 上下文**：内置对话面板、Supabase 上的 MCP Server，以及独立的 CLI 工具，可让 Claude / Cursor / Codex 直接读写你的生活数据。

> 不只是数据看板，更是一个能让 AI 真正“帮你过日子”的工作台。

---

## 🧩 核心功能

| 模块 | 用途 | 亮点 |
|---|---|---|
| 🏠 **首页概览** | 今天一眼看完 | 10 张实时卡片：日程 / 热量 / 支出 / 待办 / 目标 / 体重 / 16+8 断食 / 食材 / 用品 / 随想 |
| 🥕 **食材管理** | 厨房库存 | 6 大分类、过期预警、保质期排序 |
| 📦 **用品管理** | 日用 + 耐用品 | 自动计算「每日成本」「已省金额」，识别**超值用品** |
| 🗓 **日程计划** | 3 天 / 周 / 月视图 | 支持**重复日程数据库实例化**（外部 API 直接可查） |
| 🔥 **热量记录** | 一日三餐 + 加餐 | 与每日目标 / 进食窗口联动 |
| 💴 **记账** | 多币种 (CNY / JPY) | 自动汇率换算 + 月度预算 + 分类统计 |
| ✅ **待办事项** | GTD 风格 | 按重要性 / 分类筛选，紧急事项一目了然 |
| 🎯 **目标** | 周 / 月 / 季 / 年 | 进度追踪 + 看板式呈现 |
| 💡 **随想** | 灵感速记 | 标签 + 图标，可被 AI 检索 |
| ⚖️ **减肥专项** | 体重曲线 + 断食 | 16+8 进食窗口实时计算 |

---

## 🏗️ 技术栈

| 分层 | 技术选型 |
|---|---|
| **前端框架** | React 18 + TypeScript 5 + Vite 5 |
| **UI 体系** | Tailwind CSS 3 + shadcn/ui（Radix UI + lucide-react） |
| **数据请求** | TanStack React Query 5 |
| **表单 / 校验** | React Hook Form + Zod |
| **路由** | React Router DOM 6 |
| **图表** | Recharts |
| **后端** | Supabase（Postgres + Auth + Edge Functions） |
| **AI 适配** | 通用 OpenAI 协议（默认 Gemini，可切换 GPT / Claude / 自定义 Endpoint） |
| **测试** | Vitest + Testing Library + Playwright |
| **包管理** | npm（亦兼容 bun） |

---

## 🚀 快速开始

### 1. 克隆 & 安装

```bash
git clone https://github.com/EricLeeK/v-life.git
cd v-life
npm install
```

### 2. 配置环境变量

复制 `.env.example` 或参考 `.env`，填入 Supabase 项目信息：

```bash
VITE_SUPABASE_URL="https://<your-project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<your-project-id>"
```

> 仅前端 `anon key`（受 RLS 保护）；服务端 `service role key` 仅用于 CLI / MCP，不要写进前端。

### 3. 初始化数据库

```bash
# 安装 Supabase CLI 后
supabase link --project-ref <your-project-id>
supabase db push
```

迁移文件位于 `supabase/migrations/`，按顺序执行后会自动建表 + 索引 + RLS。

### 4. 启动开发服务器

```bash
npm run dev          # 默认 http://localhost:8080
```

---

## 🗂️ 项目结构

```
v-life/
├── src/
│   ├── pages/             # 11 个核心页面（Index、Schedule、Finance…）
│   ├── components/
│   │   ├── ui/            # shadcn/ui 组件
│   │   ├── schedule/      # 日程视图组件（DayColumn / MonthView…）
│   │   ├── AIChatPanel.tsx
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   └── MobileNav.tsx
│   ├── hooks/
│   │   ├── useData.ts     # 全模块数据 hooks（Query / Mutation）
│   │   ├── useTheme.ts
│   │   └── use-mobile.tsx
│   ├── contexts/          # AuthContext
│   ├── integrations/
│   │   └── supabase/      # 自动生成的 Supabase 客户端 & 类型
│   └── test/              # Vitest 单测
├── supabase/
│   ├── migrations/        # 12 个迁移脚本
│   └── functions/
│       ├── ai-chat/       # AI 对话 Edge Function
│       ├── auto-backup/   # 自动备份
│       └── mcp-server/    # MCP Server（暴露 CRUD Tools）
├── cli/                   # vlife.mjs：命令行工具
├── docs/                  # 设计文档与历史 plan
└── tests/e2e/             # Playwright（可选）
```

---

## 🤖 AI 集成

V-Life 把生活数据变成 AI 可读写的一等结构，提供**三种**接入方式。

### 1️⃣ 内置 AI 对话面板

右下角悬浮的 `AIChatPanel`：

- 直接对接你在「设置」中配置的模型（默认 Gemini，亦支持任何 OpenAI 兼容协议）
- 三种执行模式：`确认模式` / `直接执行` / `仅对话`
- 通过 `actions` 字段把建议的 CRUD 落库

### 2️⃣ Supabase MCP Server

部署在 `supabase/functions/mcp-server/index.ts`，让 Claude Desktop / Cursor 直接接入：

```json
{
  "mcpServers": {
    "vlife": {
      "url": "https://<your-project>.supabase.co/functions/v1/mcp-server"
    }
  }
}
```

暴露能力：
- 所有模块的 CRUD **Tools**（`pantry_create` / `finance_list` / `schedule_create` …）
- Dashboard / Finance / Calories 的统计 **Resources**

### 3️⃣ V-Life CLI

`cli/vlife.mjs` —— 用 Node 18+ 直接通过 Supabase REST API 操作数据：

```bash
export VLIFE_SUPABASE_URL="https://<your-project>.supabase.co"
export VLIFE_SUPABASE_KEY="<service-role-key>"

node cli/vlife.mjs dashboard summary
node cli/vlife.mjs finance create --name="午饭" --amount=850 --currency=JPY --category="餐饮"
node cli/vlife.mjs schedule list --start_date=2026-05-01 --end_date=2026-05-07
node cli/vlife.mjs data export --output=./backup.json
```

完整命令参见 [`cli/README.md`](./cli/README.md)。

---

## 🗄️ 数据模型

14 张核心表，全部启用 **Row Level Security**：

| 表 | 用途 |
|---|---|
| `settings` | 全局设置（预算、目标、AI 配置、断食窗口、汇率） |
| `pantry_items` | 食材库存 |
| `belongings_daily` / `belongings_durable` | 日用品 / 耐用品 |
| `schedule_events` | 日程（含 `parent_event_id` 实现重复实例化） |
| `calorie_records` | 热量 |
| `finance_records` | 收支（含 `amount_cny` 自动换算字段） |
| `todos` | 待办 |
| `goals` | 目标（周 / 月 / 季 / 年） |
| `thoughts` | 随想（标签数组 + GIN 索引） |
| `weight_records` / `measurement_records` | 体重 / 三围 |
| `ai_sessions` / `ai_messages` | AI 会话历史 |

---

## 🛠️ 开发命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（端口 8080） |
| `npm run build` | 生产构建 |
| `npm run build:dev` | 开发模式构建（保留 sourcemap） |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run test` | Vitest 单测 |
| `npm run test:watch` | Vitest 监听模式 |

---

## 📱 体验亮点

- 🌙 **暗黑模式优先**：默认深色主题，符合长时间阅读
- 📱 **响应式 + 移动端导航**：桌面侧栏 / 移动底栏自动切换
- ⚡ **乐观更新**：所有 mutation 走 React Query 乐观策略，操作零延迟
- 🔁 **重复日程真实落库**：未来 12 个月实例化进表，外部 API 也能查得到
- 💾 **一键导入 / 导出**：CLI `data export` / `data import` 全量备份
- ⏱ **16+8 断食实时态**：根据用户设定的进食窗口实时显示「断食中 / 进食中」

---

## 🤝 贡献

欢迎 Issue / PR！

1. Fork & clone
2. 新分支命名：`feature/<topic>` 或 `fix/<topic>`
3. 提交遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`feat: ...` / `fix: ...` / `refactor: ...`
4. 通过 `npm run lint && npm run test` 后再提 PR

---

## 📜 许可证

MIT © [EricLeeK](https://github.com/EricLeeK)
