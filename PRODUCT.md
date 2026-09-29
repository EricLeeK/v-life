<!-- impeccable:product-schema 1 -->
# V-Life

## Platform
web

## Users
个人生活管理用户，日常记录任务、学习、财务、健康与想法，并希望在一天结束时回看和补充自己的生活。

## Product Purpose
把分散的生活记录汇集为可理解、可补充、可复用的个人上下文。生活日报按天收藏真实记录，AI 复盘和配图均由用户按需选择。

## Operating Context
桌面和手机使用。网站之外的经历由用户补充原文；报纸可完整复制给其他 AI。往期报纸保留快照，更新由用户明确触发。

## Capabilities and Constraints
复用现有 React、Supabase、MCP 和 Agent API。任务按完成时间归日并去重，未知事实不推断。图片使用用户自带的 Grsai、OpenAI 或 Gemini API 配置；预设风格由用户维护。

## Brand Commitments
延续 Warm Desk Ledger 的暖纸色、墨色、细栏线与双语界面。日报库先展示折叠报纸侧脊，从原位飞出展开为覆盖整个应用的沉浸阅读面，返回收回原位；阅读面采用真实报纸的模块分栏。

## Product Principles
- 数据汇总本身即可成立，AI 不是使用前提。
- 保留原始记录与用户原文，明确区别事实与 AI 分析。
- 往期档案可读、可补充，生成状态不能冒充已完成。
- 手机阅读、键盘操作和减少动效模式均可用。
