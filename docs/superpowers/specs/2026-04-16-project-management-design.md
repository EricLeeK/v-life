# V-Life 项目管理模块设计文档

> **日期：** 2026-04-16  
> **版本：** v1.0  
> **状态：** 待实现  

---

## 1. 背景与目标

V-Life 是一个个人全站式生活管理应用，目前包含食材管理、用品管理、日程计划、热量记录、记账、待办事项、目标、随想、减肥专项等模块。用户需要新增一个**项目管理**功能，用于追踪并行推进的多个项目进度，并以美观的看板形式呈现。

### 核心需求
- 支持同时管理多个并行项目
- 每个项目下包含任务、习惯、里程碑三种类型的工作项
- 通过看板直观追踪各项目下的工作项状态
- 习惯支持每日打卡和连击统计
- 项目进度基于任务权重自动计算

---

## 2. 设计决策

### 2.1 架构模式：层级模式（项目 → 工作项）
- 所有内容都归属到具体项目中
- 习惯是项目的一种特殊工作项类型
- 避免单独的习惯页面，统一管理在项目内

### 2.2 看板粒度：任务级看板
- 用户先选择一个活跃项目
- 看板展示该项目下的所有任务、习惯、里程碑
- 支持快速切换项目

### 2.3 习惯展示：永久母卡
- 看板上只有一个习惯卡片
- 通过进度环展示本周/本周期完成度
- 卡片上集成一键打卡按钮
- 显示连击数（streak）

### 2.4 进度计算：按权重加权
- 每个任务/里程碑可设置 `weight`（默认 1.0）
- 项目进度 = 已完成工作项的 weight 之和 ÷ 所有工作项的 weight 之和 × 100%
- 习惯不计入项目进度

### 2.5 看板列：固定五列
| 列名 | 含义 |
|------|------|
| 待办 | 尚未安排执行的工作项 |
| 本周 | 计划在本周内处理的工作项 |
| 进行中 | 正在执行的工作项 |
| 等待中 | 阻塞或等待外部反馈的工作项 |
| 已完成 | 已结束的工作项 |

### 2.6 数据存储：Supabase
- 复用现有 Supabase 基础设施
- 新增 `projects`、`project_tasks`、`habit_logs`、`task_tags`、`project_task_tags` 表
- 支持多设备同步

### 2.7 页面布局：左右分屏（方案 B）
- 左侧：项目列表（28%-32%）
- 右侧：选中项目的看板（68%-72%）
- 适合并行管理 5-15 个项目，切换成本低

---

## 3. 页面布局与交互设计

### 3.1 整体结构

新页面路由：`/projects`

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (V-Life 全局)                                       │
├────────────────────┬────────────────────────────────────────┤
│  [+] 新建项目      │  项目标题          [全部|任务|习惯|里程碑]│
│  ┌──────────────┐  │  进度条 ████████░░ 80%                  │
│  │ 项目 A  ●    │  ├────────────────────────────────────────┤
│  │ ████████░░   │  │ 待办 │ 本周 │ 进行中 │ 等待中 │ 已完成 │
│  │ 12 任务      │  │  ────┼──────┼────────┼────────┼─────── │
│  └──────────────┘  │  [卡] │ [卡] │  [卡]  │  [卡]  │  [卡]  │
│  ┌──────────────┐  │  [卡] │      │  [卡]  │        │  [卡]  │
│  │ 项目 B  ●    │  │  [+] │ [+]  │  [+]   │  [+]   │  [+]   │
│  │ ████░░░░░░   │  │      │      │        │        │        │
│  └──────────────┘  │                                      │
│  ▼ 已完成 (3)      │                                      │
└────────────────────┴────────────────────────────────────────┘
```

### 3.2 左侧项目列表（ProjectSidebar）

**排序与分组：**
1. 进行中（active）— 按优先级高→低排序
2. 规划中（planning）— 按优先级排序
3. 暂停中（paused）— 按优先级排序
4. 已完成/已归档（completed / archived）— 默认折叠

**项目卡片内容：**
- 项目名称
- 优先级色点（高=红色，中=黄色，低=绿色）
- 总进度条（细条 Progress）
- 元信息：`{任务数} 工作项 · {截止日期或剩余天数}`
- 当前选中项高亮显示

### 3.3 右侧看板区域（ProjectBoard）

**顶部工具栏：**
- 项目名称（大号字体）
- 项目总进度条
- 筛选器 Tabs：`全部` / `仅任务` / `仅习惯` / `仅里程碑`
- 设置按钮（编辑项目、归档项目）

**看板列：**
- 每列固定宽度 `min-w-[260px]`，横向滚动
- 列标题显示列名 + 该列卡片数量
- 列内卡片垂直滚动
- 列底部 `+ 添加` 按钮

### 3.4 卡片视觉设计

三种卡片通过**左边框颜色**和**顶部类型图标**区分：

#### 任务卡片（TaskCard）
- 左边框：`border-l-4 border-blue-500`
- 图标：`CheckSquare`
- 标题 + 描述（最多 2 行，超出截断）
- 左下角：`weight` 值 + 优先级标签
- 右下角：截止日期（相对时间，如"3天后"）

#### 习惯卡片（HabitCard）
- 左边框：`border-l-4 border-purple-500`
- 图标：`Repeat`
- 标题居中
- 中央：圆形进度环（显示本周完成次数 / 目标次数）
- 进度环下方：今日打卡按钮（大号圆形 checkbox 样式）
- 右上角：连击 badge（🔥 12）
- 习惯卡片拖拽不受列限制，但打卡行为独立

#### 里程碑卡片（MilestoneCard）
- 左边框：`border-l-4 border-amber-500`
- 图标：`Flag`
- 标题（字号略大，加粗）
- 截止日期
- 右下角：完成 checkbox（直接标记完成/未完成）

---

## 4. 数据模型

### 4.1 `projects` 表
```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  target_date date,
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 4.2 `project_tasks` 表
```sql
create table project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  title text not null,
  description text,
  type text not null default 'task' check (type in ('task', 'habit', 'milestone')),
  status text not null default 'todo' check (status in ('todo', 'this_week', 'in_progress', 'waiting', 'done')),
  weight float not null default 1.0 check (weight > 0),
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 4.3 `habit_logs` 表
```sql
create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references project_tasks on delete cascade not null,
  log_date date not null default current_date,
  completed_at timestamptz default now(),
  unique (task_id, log_date)
);
```

### 4.4 `task_tags` 表
```sql
create table task_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  name text not null,
  color text not null default '#3b82f6'
);
```

### 4.5 `project_task_tags` 关联表
```sql
create table project_task_tags (
  task_id uuid references project_tasks on delete cascade,
  tag_id uuid references task_tags on delete cascade,
  primary key (task_id, tag_id)
);
```

### 4.6 RLS 策略
所有表启用 RLS，只允许 `auth.uid() = user_id`（或关联表通过 project 的 user_id 校验）进行 CRUD。

---

## 5. 组件架构

### 5.1 页面组件
- `src/pages/Projects.tsx` — 项目管理主页面

### 5.2 新增业务组件
| 组件 | 职责 |
|------|------|
| `ProjectSidebar` | 左侧项目列表、新建项目按钮、分组折叠 |
| `ProjectBoard` | 右侧看板容器、顶部工具栏、列渲染 |
| `BoardColumn` | 单列容器、标题、卡片列表、添加按钮 |
| `TaskCard` | 普通任务卡片渲染 |
| `HabitCard` | 习惯卡片渲染（含打卡、进度环） |
| `MilestoneCard` | 里程碑卡片渲染 |
| `ProjectModal` | 新建/编辑项目弹窗 |
| `TaskModal` | 新建/编辑工作项弹窗（根据 type 切换表单字段） |
| `HabitLogButton` | 习惯打卡按钮（今日已打卡/未打卡状态） |

### 5.3 新增 Hooks
| Hook | 职责 |
|------|------|
| `useProjects` | 查询/创建/更新/删除项目列表 |
| `useProjectTasks` | 查询/创建/更新/删除某项目下的工作项 |
| `useHabitLogs` | 查询/创建习惯打卡记录 |
| `useTaskTags` | 查询/创建标签 |

---

## 6. 关键交互逻辑

### 6.1 看板拖拽（@hello-pangea/dnd）
- 卡片支持跨列拖拽
- 同列内支持上下排序（更新 `sort_order`）
- 拖拽释放时：
  1. 本地乐观更新卡片位置
  2. 调用 Supabase 更新 `status` 和 `sort_order`
  3. 若拖到"已完成"列，普通任务/里程碑自动标记完成（不弹窗确认）

### 6.2 项目进度计算
- 触发时机：任务增删改、任务状态变更、任务 weight 变更
- 计算逻辑：
  ```
  total_weight = sum(weight of all tasks + milestones in project)
  completed_weight = sum(weight of tasks + milestones with status = 'done')
  progress = round(completed_weight / total_weight * 100)
  ```
- 习惯不计入进度计算
- 计算在客户端完成，然后 PATCH 更新 `projects.progress`

### 6.3 习惯打卡
- 点击 HabitCard 上的打卡按钮
- 检查 `habit_logs` 中是否已有今日记录
  - 无：插入记录，按钮变为"已完成"状态
  - 有：删除记录，恢复为"未完成"状态
- 乐观更新本地 UI，刷新本周进度环

### 6.4 进度环计算（习惯）
- V1 采用固定周目标：本周一至今日已打卡天数 / 7

---

## 7. 边界情况与错误处理

| 场景 | 处理方案 |
|------|----------|
| 项目中无任务 | 进度显示 0%，看板为空，显示引导文案"点击 + 添加第一个工作项" |
| 习惯被拖到"已完成"列 | 仅改变列位置（可用于表示习惯当前状态），不自动生成打卡记录；打卡必须通过按钮 |
| 删除项目 | 级联删除该项目下的所有任务、习惯日志、标签（CASCADE） |
| 归档项目 | `status` 改为 `archived`，从默认列表隐藏，但可展开查看 |
| 网络断开 | TanStack Query 自动重试，乐观更新在失败时回滚 |
| 无选中项目 | 默认选中第一个"进行中"项目；若全部为空，右侧显示空状态插图 |

---

## 8. 路由与导航

- 在 `App.tsx` 中新增路由：`<Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />`
- 在 `AppSidebar.tsx` 的 `mainItems` 中新增：`{ title: "项目管理", url: "/projects", icon: Kanban }`
- 首页 Dashboard（`Index.tsx`）新增一个"项目管理"卡片入口，显示活跃项目数 + 活跃项目的平均进度

---

## 9. 非功能性需求

- **响应式**：桌面端左右分屏；平板端左侧收窄；手机端左侧变为 Drawer，默认全屏看板
- **性能**：项目列表 + 任务列表一次查询，看板拖拽纯本地状态更新后批量同步
- **无障碍**：拖拽操作支持键盘替代（V1 可先用按钮移动状态作为 fallback）
