

## 目标模块实现计划

### 概述
在待办事项和随想之间新增「目标」模块，支持周/月/年目标管理，并可选在日程页面显示目标悬浮球。同时修复 WeightLoss.tsx 中 Checkbox 未导入的运行时错误。

### 1. 数据库
新建 `goals` 表：
- `id` uuid PK
- `user_id` uuid (default 00000000...)
- `type` text (`week` / `month` / `year`)
- `period_start` date (该周/月/年的起始日期，用于定位)
- `title` text
- `is_completed` boolean default false
- `created_at`, `updated_at` timestamps
- RLS: public ALL

在 `settings` 表新增 `show_goals_in_schedule` boolean default true。

### 2. 目标页面 (`src/pages/Goals.tsx`)
- 三栏布局：左=周目标，中=月目标，右=年目标
- 默认显示当前周/月/年的目标
- 每栏顶部有独立开关"查看全部"，开启后展示该类型所有历史目标（按时间倒序分组）
- 支持添加、完成（checkbox）、删除目标
- 使用 `startOfWeek`/`startOfMonth`/`startOfYear` 计算当前周期

### 3. 路由与导航
- `App.tsx`：添加 `/goals` 路由，放在 `/todos` 和 `/thoughts` 之间
- `AppSidebar.tsx`：在待办事项和随想之间加入「目标」（Target 图标）
- `MobileNav.tsx`：在 moreItems 中添加目标入口

### 4. 日程页面目标悬浮球
- 在 `Schedule.tsx` 中，若 `settings.show_goals_in_schedule` 为 true，右下角显示一个小悬浮球（类似 AI 按钮）
- 点击展开一个紧凑的弹出面板，显示当前周/月/年目标（三段，每段标题+条目列表）
- 关闭时只显示小球图标

### 5. 设置页面
- 在 `Settings.tsx` 中添加"在日程中显示目标球"开关（Switch）

### 6. Bug 修复
- `WeightLoss.tsx` 已导入 Checkbox，但运行时报未定义——检查并确认 import 正确存在。

### 文件变更清单
| 文件 | 操作 |
|------|------|
| SQL migration | 新建 `goals` 表 + settings 加列 |
| `src/pages/Goals.tsx` | 新建 |
| `src/hooks/useData.ts` | 添加 goals CRUD hooks |
| `src/App.tsx` | 添加路由 |
| `src/components/AppSidebar.tsx` | 添加导航项 |
| `src/components/MobileNav.tsx` | 添加导航项 |
| `src/pages/Schedule.tsx` | 添加目标悬浮球 |
| `src/pages/Settings.tsx` | 添加开关 |
| `src/pages/WeightLoss.tsx` | 修复 Checkbox 引用 |

