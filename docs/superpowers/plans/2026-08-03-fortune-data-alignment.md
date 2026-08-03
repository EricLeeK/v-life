# 运势数据对齐（方案 A）实现计划

> **面向 AI 代理的工作者：** 按任务顺序实现；每步可勾选。个人项目允许联网。  
> **规格：** `docs/superpowers/specs/2026-08-03-fortune-data-alignment-design.md`

**目标：** 黄历/干支全面改用 `lunar-javascript`；星座日运经 Edge 代理拉网上 API；今日星级由黄历 + 生肖冲合 + 星座数据合成；去掉伪随机宜忌与全员 3 星。

**架构：** 本地 `lunarDay` bundle 为中式真源；`fortune-horoscope` Edge 拉 aztro（或同等）；前端缓存写入 `fortune_daily_cache`；AI 只润色 facts。

**技术栈：** React / Vite、`lunar-javascript`、`astronomy-engine`、Supabase Edge Functions、Vitest

**工作区：** `/Users/chrisv/Projects/v-life/.worktrees/fortune-hub`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/lib/fortune/lunarDay.ts` | 新建：统一农历日 bundle（宜忌/冲煞/建除/日柱/农历标签） |
| `src/lib/fortune/almanac.ts` | 改为消费 lunarDay |
| `src/lib/fortune/lunarLabel.ts` | 改为消费 lunarDay |
| `src/lib/fortune/scores.ts` | 黄历 H + 生肖 S + 可选星座 Z 合成星级 |
| `src/lib/fortune/horoscope.ts` | 新建：调用 Edge、规范化、本地星级派生 |
| `src/lib/fortune/ruleVersion.ts` |  bump，记录数据源策略 |
| `supabase/functions/fortune-horoscope/index.ts` | 新建：代理 aztro |
| `src/pages/fortune/ZodiacPage.tsx` | 接 horoscope API |
| `src/pages/fortune/FortuneHome.tsx` | 真黄历 + 新星级 + 可选 Z |
| `src/pages/fortune/BaziPage.tsx` / `ShengxiaoPage.tsx` | 对齐 bundle |
| `src/components/fortune/AlmanacCard.tsx` | 展示真宜忌（可能条目更多，UI 截断） |
| `*.test.ts` | fixtures 与合成测试 |

---

### 任务 1：lunarDay bundle + 替换黄历

**文件：** 创建 `lunarDay.ts`；改 `almanac.ts`、`lunarLabel.ts`、相关测试与 AlmanacCard

- [ ] 写失败测试：固定日期 yi/ji/chong 等于直接调 `Solar.fromYmd`
- [ ] 实现 `getLunarDayBundle(isoDate)`
- [ ] `getAlmanacForDate` / `lunarLabelForDate` 走 bundle；删除自写 YI/JI 抽样
- [ ] AlmanacCard 宜忌列表可滚动或最多展示 N 条 + 「共 M 项」
- [ ] `npx vitest run src/lib/fortune` 通过

### 任务 2：星级合成 H+S

**文件：** `scores.ts`、`scores.test.ts`、`FortuneHome` / `ruleCopy` 若需要

- [ ] 测试：无生肖时 overall 随日期/黄历可变，非恒 3；有冲合时与无冲合可区分
- [ ] 实现 H（宜忌数量比等）+ S（冲合）；去掉「仅 tiny texture → round 3」主路径
- [ ] 保留可选极小 jitter 仅打破并列，幅度不足以抹平差异
- [ ] 测试通过

### 任务 3：fortune-horoscope Edge + 客户端

**文件：** `supabase/functions/fortune-horoscope/index.ts`；`src/lib/fortune/horoscope.ts`；部署

- [ ] Edge：CORS + 可选 JWT（个人项目允许带 anon）；请求 aztro；规范化 JSON
- [ ] 客户端 `fetchHoroscope(sign, day)`；失败返回明确 error
- [ ] 无 stars 时用稳定 hash(sign|date|mood|text) 映射 1–5，**按 sign 区分**
- [ ] 部署到项目 `veabdivlfhctseihypzl`

### 任务 4：星座页 + 总览接 Z

**文件：** `ZodiacPage.tsx`、`FortuneHome.tsx`、`useFortune` 缓存 payload

- [ ] ZodiacPage：切换星座拉取/展示 API 文案与星级
- [ ] FortuneHome：有档案星座时合并 Z 进 scores；facts 带 horoscope 摘要
- [ ] 缓存 payload 含 `source`、`horoscope`、`lunar`

### 任务 5：八字 / 生肖 / 版本 / 回归

**文件：** `BaziPage`、`ShengxiaoPage`、`bazi.ts` 若需、`ruleVersion.ts`

- [ ] 日柱/冲煞/年肖展示与 lunarDay 一致
- [ ] bump `FORTUNE_RULE_VERSION`
- [ ] 全套 `vitest run src/lib/fortune` + 关键页面无类型错误

---

## 完成定义

规格 §9 验收清单全部满足；不再使用产品词库假宜忌；星座页 API 正常时 12 座不雷同。
