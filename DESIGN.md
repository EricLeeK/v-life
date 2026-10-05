---
name: V-Life
description: Warm cream personal life OS — schedule, finance, todos, health, and study in one desk ledger
colors:
  background: "hsl(40 20% 95%)"
  foreground: "hsl(30 25% 10%)"
  card: "#ffffff"
  primary: "hsl(30 25% 10%)"
  primary-foreground: "#ffffff"
  muted: "hsl(40 16% 91%)"
  muted-foreground: "hsl(36 12% 40%)"
  border: "hsl(40 16% 87%)"
  line: "#e4e1d7"
  destructive: "hsl(0 72% 51%)"
  success: "hsl(100 35% 40%)"
  warning: "hsl(30 70% 55%)"
  cat-green: "hsl(100 45% 28%)"
  cat-blue: "hsl(207 55% 36%)"
  cat-orange: "hsl(22 65% 36%)"
  cat-teal: "hsl(185 55% 28%)"
  cat-purple: "hsl(256 45% 42%)"
  cat-yellow: "hsl(40 70% 30%)"
  cat-red: "hsl(0 55% 40%)"
  chart-1: "hsl(200 40% 53%)"
  chart-2: "hsl(100 35% 40%)"
  chart-3: "hsl(30 70% 55%)"
  chart-4: "hsl(0 72% 51%)"
  chart-5: "hsl(260 35% 60%)"
typography:
  display:
    fontFamily: "Fraunces, Instrument Serif, ui-serif, Georgia, serif"
    fontWeight: 600
    lineHeight: 1.2
  dashboard-display:
    fontFamily: "Fraunces, Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "clamp(28px, 3.6vw, 44px)"
    fontWeight: 700
    lineHeight: 1.08
  action-title:
    fontFamily: "Fraunces, Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "clamp(24px, 2.4vw, 32px)"
    fontWeight: 650
    lineHeight: 1.15
  section-title:
    fontFamily: "Fraunces, Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.2
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  micro:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.3
  dense:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "9px"
    fontWeight: 500
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  compact:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  newspaper-body:
    fontFamily: "Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.9
  newspaper-deck:
    fontFamily: "Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.8
  newspaper-headline:
    fontFamily: "Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif, serif"
    fontSize: "clamp(32px, 3.9vw, 54px)"
    fontWeight: 900
    lineHeight: 1.2
  newspaper-headline-compact:
    fontFamily: "Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif, serif"
    fontSize: "clamp(28px, 8vw, 38px)"
    fontWeight: 900
    lineHeight: 1.2
  newspaper-masthead:
    fontFamily: "Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif, serif"
    fontSize: "clamp(52px, 7.6vw, 104px)"
    fontWeight: 900
    lineHeight: 1.08
  newspaper-masthead-compact:
    fontFamily: "Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif, serif"
    fontSize: "clamp(44px, 14vw, 64px)"
    fontWeight: 900
    lineHeight: 1.08
  newspaper-archive-title:
    fontFamily: "Fraunces, Songti SC, Noto Serif SC, ui-serif, serif"
    fontSize: "clamp(30px, 4vw, 50px)"
    fontWeight: 650
    lineHeight: 1.22
  metric:
    fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace"
    fontSize: "28px"
    fontWeight: 600
  metric-compact:
    fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace"
    fontSize: "20px"
    fontWeight: 600
  mono:
    fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace"
    fontWeight: 500
    fontSize: "14px"
rounded:
  sm: "calc(0.5625rem - 4px)"
  md: "calc(0.5625rem - 2px)"
  lg: "0.5625rem"
  card: "8px"
spacing:
  page-x: "24px"
  page-y: "24px"
  section: "24px"
  stack: "12px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "40px"
  card-premium:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "8px"
    padding: "16px"
---

# Design System: V-Life

## Overview

**Creative North Star: "Warm Desk Ledger"**

V-Life is a bilingual personal life OS that should feel like a well-kept desk blotter: warm cream paper, ink-dark text, hairline rules, and quiet category accents. Density favors scanability for Operate-mode tasks (todos, schedule, finance) over marketing flourish. Motion is short and purposeful (list enter-up, button press), and always yields to `prefers-reduced-motion`.

**Key Characteristics:**
- Warm cream canvas (`--background`) with white elevated cards
- Ink primary (`--foreground` / `--primary`) instead of saturated brand purple
- Category accents via `--cat-*` tokens; charts via `--chart-*`
- Fraunces for display headings; Inter for UI; JetBrains Mono for metrics
- Hairline borders (`--line`) + soft warm-brown shadows

## Colors

Palette character: warm neutral paper with restrained earth accents.

### Primary
- **Ink Charcoal** (`hsl(30 25% 10%)`): Primary actions, headings, strong emphasis.

### Neutral
- **Cream Paper** (`hsl(40 20% 95%)`): App canvas / page background.
- **Card White** (`#ffffff` / `hsl(var(--card))`): Elevated surfaces.
- **Muted Stone** (`hsl(36 12% 40%)`): Secondary text — keep ≥4.5:1 on cream; prefer `text-muted-foreground`, never hard-code `#8a847a`.
- **Hairline** (`#e4e1d7` / `--line`): Borders and separators.

### Semantic
- **Destructive** / **Success** / **Warning**: status only.

### Category & Chart
- Use Tailwind `text-cat-*`, `bg-cat-*-bg`, and `hsl(var(--chart-N))` / `chartTokens` helpers. Do not invent parallel hex maps in feature pages.
- Category foreground tokens are deliberately darker in light mode and lighter in dark mode so compact labels retain readable contrast. Each `--cat-*-bg` token also has an explicit dark-mode value.

### Dark Theme
- Canvas `hsl(30 15% 10%)`; cards and popovers `hsl(30 15% 13%)`.
- Use semantic surface and text utilities only: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, and `text-muted-foreground`.
- Never use `bg-white`, Stone palette text, or fixed cream surfaces for application UI. `card-premium` uses theme tokens in both modes.

**The One Ink Rule.** Primary ink is for actions and hierarchy. Accents are for category meaning, not decoration.

## Typography

**Display Font:** Fraunces (soft optical size)  
**Body Font:** Inter  
**Mono Font:** JetBrains Mono (`font-mono-data`)

**Character:** Editorial warmth in headings, utilitarian clarity in controls, monospace only for numbers/metrics.

### Hierarchy
- **Display / page titles**: Fraunces, semibold, ~base–lg in app chrome
- **Section titles**: Fraunces or semibold Inter
- **Body**: Inter 14px / medium weights for labels
- **Label**: Inter 12px (`text-xs`) for field labels and secondary UI
- **Micro**: Inter 10px (`text-[10px]`) only for dense chrome (calendar hour marks, bottom-nav captions)
- **Metrics**: JetBrains Mono tabular

## Layout

- Desktop: collapsible sidebar + centered main (`maxWidth` ~100rem), horizontal padding `px-6 lg:px-10`
- Mobile: sticky title bar + bottom nav (`MobileNav`); content `p-4` with `pb-16`
- Touch targets: interactive controls ≥44×44px
- Schedule: mobile defaults to `1day`; week view may horizontal-scroll

## Elevation & Depth

Hybrid: tonal cream layering plus warm hairline shadows.

### Shadow Vocabulary
- **Hairline** (`--shadow-hairline`): resting outline
- **Button** (`--shadow-btn`): resting controls
- **Card** (`--shadow-card`): default elevated panels
- **Raised** (`--shadow-raised`): hover / emphasis
- **Overlay** (`--shadow-overlay`): dialogs / sheets

**The Flat-By-Default Rule.** Surfaces stay quiet at rest; shadow deepens on hover or modal elevation only.

## Shapes

- Global radius token `--radius: 0.5625rem` (~9px)
- Cards / premium panels use `8px`
- Pills for badges; circular FABs for AI assistant
- Prefer soft rectangles over heavy neumorphism

## Components

### Buttons
- **Shape:** `rounded-md` from `--radius`
- **Primary:** ink fill, white text, warm micro-shadow; `active:scale-[0.97]`
- **Outline / Ghost:** hairline or mute fill; focus-visible ring on `--ring`
- Icon-only buttons must include `aria-label`; hit area ≥44px

### Cards / Containers
- Prefer `card-premium` or `bg-card border-border` — token gradients that follow light/dark
- Internal padding typically `p-4`
- Avoid nested cards

### Inputs / Fields
- Border `--input`, `bg-background`, `text-foreground`, and `--ring`; warm field wash `--field-warm` on hover where used
- Always pair `<Label htmlFor>` with control `id`
- `text-base` on mobile inputs to prevent iOS zoom

### Navigation
- Desktop: `AppSidebar` ink icons, muted idle / ink active on cream wash
- Mobile: bottom bar + “更多” dialog with Escape, focus trap, `aria-expanded` / `aria-controls`

### Charts
- Colors from `--chart-*` / `--cat-*` via `src/lib/chartTokens.ts`
- Tooltips use shared `ChartTooltip`

## Do's and Don'ts

- **Do** use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, `text-cat-green`).
- **Do** respect `prefers-reduced-motion` (`.enter-up` off; no infinite distraction).
- **Do** keep bilingual copy via `t(zh, en)`.
- **Don't** hard-code cream/ink hex in new UI (`#f4f3ee`, `#1f1a14`, `#8a847a`, `#e4e1d7`) — map to tokens.
- **Don't** invent a second category color map beside `--cat-*`.
- **Don't** ship icon-only controls without accessible names.
- **Don't** use purple-on-white marketing gradients; this product is warm ink on cream.
- **Don't** treat Inter/Fraunces as disposable without an explicit rebrand — they are the incumbent pairing until `/impeccable typeset` changes them.

## Motion

- Functional hover, focus, and state transitions remain brief and visible.
- Under `prefers-reduced-motion: reduce`, staggered entrances and infinite/decorative animation classes are disabled; scrolling becomes immediate.
- Do not globally force every transition to `0.01ms`: that removes useful state feedback and can create brittle timing behavior.

## 生活报纸档案馆（/newspapers）

此处是用户指定的「档案柜 + 真实报纸」视觉扩展，采用 Experience → Read 的转换，不沿用右侧模块面板的阅读结构。

- **档案柜**：暖灰柜体和每月抽屉保留，默认只展开最近一个月，搜索时展开匹配月份。层级以每份日报的标题、首段摘要与真实配图为主；日期签完整露出，月份与归档状态退为辅助信息。抽屉约 360ms 展开，纸张悬停抬起 6px，归位后不残留抬升。
- **纸张**：报纸是新闻纸而不是屏幕卡片——纸色上叠细颗粒与横向纤维两层 SVG 噪点（`--np-grain`、`--np-fibre`），下方两层错开的薄纸边，纸面保留对折成条留下的三道水平折痕。配图做轻微的旧化（sepia / 降饱和）。深色模式降低折痕强度、桌面去掉纹理。
- **折叠动画**：纸张从原槽位连续移动并沿中线展开（820ms），收回反向折起归位（620ms）。封面来自实际档案条目，内页来自当前阅读位置的真实 DOM；两个印刷面保留在同一场景，移动与折叠共用时间轴，固定印刷面始终在折页背面上方。完成时一次性交接，避免中途空白与重复纸张。展开途中按 Esc 反转当前帧；卸载时取消动画。减少动态效果和不支持 Web Animations 时直接切换，归位恢复原列表滚动与键盘焦点。
- 原有 Fraunces 用于 V-Life 和日期（用户已确认，检测器登记了单值豁免）。中文报头与栏目使用 `Songti SC, Noto Serif SC, Source Han Serif SC, ui-serif`，已登记为 `newspaper-*` 字体规范：正文 16px、导语 18px、头条 clamp(32px, 3.9vw, 54px)、报头 clamp(52px, 7.6vw, 104px)，紧凑版本见 frontmatter。小号 9–14px 仅用于日期印记、状态和辅助信息。
- 纸页保持直角；印章、勾选框等印刷元素直角；按钮、抽屉、索引签用 8px。复用 `--background`、`--muted`、`--foreground`、`--border` 与语义色；阴影用墨色透明度，无额外品牌色。
- 桌面宽窄分栏、手机单栏。图片是真实保存资产的缩略图，AI 与演示图片分别明确标识；无图、无复盘时保留完整文字阅读。
- 手机输入框、日期和选择器使用 16px，避免 iOS 聚焦时自动放大。
- 收回阅读器后保留实际键盘焦点但不残留抬起和框线；再次 Tab 导航显示焦点，实际指针移动恢复悬浮反馈。


## 首页日程缩略视图

- 以真实事件的标题和时间为主，沿用日程分类颜色；日期只作为列索引，今天使用原 `--secondary` 浅色。
- 桌面展示七列，每列最多三条安排；今天围绕接下来要发生的安排取连续片段，并保留近期上下文。完整日程入口与事件卡都携带对应日期。
- 手机在卡片内部横向翻阅，默认让今天可见；加载、空日程和读取失败有明确反馈。统计数据放在下方紧凑一行。
