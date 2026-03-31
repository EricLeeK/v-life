

## 账号密码系统实现计划

### 概述
添加邮箱+密码认证，注册后免邮箱验证直接登录。每个用户数据独立隔离。

### 1. 启用免验证注册
使用 `cloud--configure_auth` 开启 auto-confirm email signups。

### 2. 创建认证页面
新建 `src/pages/Auth.tsx`：
- 包含登录和注册两个 tab
- 邮箱 + 密码表单
- 忘记密码功能（发送重置邮件）

新建 `src/pages/ResetPassword.tsx`：
- 检测 URL 中的 recovery token
- 允许用户设置新密码

### 3. 认证上下文
新建 `src/contexts/AuthContext.tsx`：
- 使用 `onAuthStateChange` 监听登录状态
- 提供 `user`, `loading`, `signOut` 等
- 包裹整个 App

### 4. 路由保护
修改 `src/App.tsx`：
- 未登录用户重定向到 `/auth`
- `/auth` 和 `/reset-password` 为公开路由
- 已登录用户访问 `/auth` 重定向到 `/`

### 5. 更新 RLS 策略（数据库迁移）
所有业务表的 RLS 策略从 `true` 改为 `auth.uid() = user_id`：
- `pantry_items`, `belongings_daily`, `belongings_durable`
- `schedule_events`, `calorie_records`, `finance_records`
- `todos`, `thoughts`, `goals`
- `weight_records`, `measurement_records`
- `ai_sessions`, `ai_messages`
- `settings`

同时将各表 `user_id` 的默认值从固定 UUID 改为 `auth.uid()`。

### 6. 更新数据写入逻辑
修改 `src/hooks/useData.ts`：
- `useCrudHooks` 的 `useCreate` 不再需要手动传 user_id（数据库默认值 `auth.uid()` 自动处理）
- `useSettings` 的创建逻辑添加 user_id
- 各 query 不需要手动过滤 user_id（RLS 自动过滤）

### 7. 导航添加登出
在 `AppSidebar.tsx` 底部添加登出按钮。

### 文件变更清单
| 文件 | 操作 |
|------|------|
| SQL migration | 更新所有表 RLS + user_id 默认值 |
| `src/pages/Auth.tsx` | 新建 |
| `src/pages/ResetPassword.tsx` | 新建 |
| `src/contexts/AuthContext.tsx` | 新建 |
| `src/App.tsx` | 添加路由保护 + 新路由 |
| `src/hooks/useData.ts` | 适配 auth.uid() |
| `src/components/AppSidebar.tsx` | 添加登出 |
| `src/components/MobileNav.tsx` | 添加登出 |
| `src/pages/Settings.tsx` | 移除 user_id 硬编码 |

