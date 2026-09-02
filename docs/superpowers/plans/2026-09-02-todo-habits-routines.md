# 待办习惯与例行 实现计划

> **面向 AI 代理的工作者：** 在当前工作区按任务实现。规格：`docs/superpowers/specs/2026-09-02-todo-habits-routines-design.md`。TDD：先写失败测试再写实现。不要 commit，除非用户明确要求。

**目标：** 待办母卡支持一次性 / 例行 / 习惯；习惯自动出现在今日顶部控件栈；例行只在选择器置顶；AI 替用户选好种类并只让用户确认。

**架构：** `todos.kind` 分流；习惯流水在 `todo_habit_logs`；`daily_tasks` 只装一次性与例行。纯逻辑放 `src/lib/habits.ts`，AI 护栏放 `src/lib/habitAi.ts`，UI 用 `HabitWidgetStack`。

**技术栈：** React + TanStack Query、Supabase、现有 `moduleRegistry` / `AIChatPanel`、Vitest。

---

## 文件

- 创建：`src/lib/habits.ts`、`src/lib/habits.test.ts`
- 创建：`src/lib/habitAi.ts`、`src/lib/habitAi.test.ts`
- 创建：`src/components/HabitWidgetStack.tsx`、`src/components/HabitWidgetStack.test.tsx`
- 创建：`supabase/migrations/20260902_todo_habits_routines.sql`
- 修改：`src/integrations/supabase/types.ts`（todos 字段 + `todo_habit_logs`）
- 修改：`src/hooks/useData.ts`（习惯流水 hooks）
- 修改：`src/data/demoSeed.ts`
- 修改：`src/pages/Todos.tsx`
- 修改：`src/pages/TodayTodo.tsx`
- 修改：`supabase/functions/_shared/moduleRegistry.ts`
- 修改：`src/lib/moduleRegistry.test.ts`
- 修改：`src/components/AIChatPanel.tsx`
- 修改：`src/pages/Todos.habit.test.tsx` 或扩 `QuickCreateRouting.test.tsx` / 新建 `src/pages/TodosHabit.test.tsx`

---

### 任务 1：领域逻辑（纯函数）

**文件：** `src/lib/habits.ts`、`src/lib/habits.test.ts`

- [ ] 先写 `src/lib/habits.test.ts`（连击、达标、选择器过滤、习惯置顶）
- [ ] 跑测试确认失败
- [ ] 实现 `src/lib/habits.ts` 使测试通过

导出至少：

- `TODO_KINDS` / `HABIT_TYPES`
- `isPersistentKind(kind)` — habit | routine
- `isHabitMetToday(habit, log)` — 打卡 value>=1；计数/时长 value>=target；克制 broken 不为 true
- `habitStreak(habit, logs, today)` — 按 log_date 连续本地日
- `weekCheckins(logs, today)` — 本周一到今天达标天数
- `habitGroupFirst(todos)` — 未归档未暂停习惯置顶，其余保持相对顺序
- `todayPickerItems(todos, todayTodoIds)` — 排除习惯；例行在前；去掉已在今日的

---

### 任务 2：AI 护栏与预览文案

**文件：** `src/lib/habitAi.ts`、`src/lib/habitAi.test.ts`

- [ ] 测试：`normalizeHabitCreate` 默认 checkin / 计数目标 1 / 时长 30 / 习惯分类「习惯」
- [ ] 测试：`rewriteCompleteOp` 习惯 is_completed → habit_log；例行 is_completed → 标记需走 daily_task
- [ ] 测试：`shouldSkipDailyTask(todo)` 习惯为 true
- [ ] 测试：`formatOpPreview` 含「习惯」「例行」
- [ ] 实现使测试通过

---

### 任务 3：迁移与类型

**文件：** `supabase/migrations/20260902_todo_habits_routines.sql`、`src/integrations/supabase/types.ts`

- [ ] 迁移：todos 加 kind/habit_type/habit_target/habit_unit/is_paused；建 todo_habit_logs + RLS + 唯一约束
- [ ] 更新 generated types 中 todos 与新表

---

### 任务 4：hooks + demo seed

**文件：** `src/hooks/useData.ts`、`src/data/demoSeed.ts`

- [ ] `useTodoHabitLogs(todoId)` / `useUpsertTodoHabitLog`
- [ ] demo 增加 4 个习惯 + 1 个例行 + 若干流水

---

### 任务 5：待办清单 UI

**文件：** `src/pages/Todos.tsx`、`src/pages/TodosHabit.test.tsx`

- [ ] 测试：demo 下习惯行没有「标记为已完成」；有「例行」标记
- [ ] 新建弹窗增加种类；习惯默认分类「习惯」并选形态/目标
- [ ] 分类视图习惯分组置顶；习惯/例行不渲染复选框；可暂停

---

### 任务 6：今日待办控件栈与选择器

**文件：** `src/components/HabitWidgetStack.tsx`、`src/pages/TodayTodo.tsx`、对应测试

- [ ] 四种控件；无习惯不渲染栈
- [ ] 选择器排除习惯、例行置顶
- [ ] 临时添加仍只建一次性

---

### 任务 7：AI 模块与执行器

**文件：** `moduleRegistry.ts`、`src/lib/moduleRegistry.test.ts`、`src/components/AIChatPanel.tsx`

- [ ] todo 字段 + habit_log 模块（index 22）；提示词规则与三条示例
- [ ] 更新模块数量断言（22；allQueryKeys 长度随新 key 增加）
- [ ] 执行器：create 规范化；习惯/例行完成改写；daily_task 跳过习惯；habit_log upsert
- [ ] 确认预览用 `formatOpPreview`

---

## 规格覆盖

| 规格章节 | 任务 |
|----------|------|
| 3 概念 / 4 数据 | 1, 3 |
| 5 页面 | 5, 6 |
| 6 AI | 2, 7 |
| 8 测试 | 各任务内 |
| 9 不做 | 不实现 |

## 验证

```bash
npx vitest run src/lib/habits.test.ts src/lib/habitAi.test.ts src/lib/moduleRegistry.test.ts src/components/HabitWidgetStack.test.tsx src/pages/TodosHabit.test.tsx src/pages/QuickCreateRouting.test.tsx
```
