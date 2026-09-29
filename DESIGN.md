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
- Cards / premium panels often `8px`
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

此处是用户指定的纸张档案馆视觉扩展，采用 Experience → Read 的转换，不沿用右侧模块面板的阅读结构。

- 档案架首先呈现折叠报纸的侧脊、折边与薄纸层，按月份叠放；日期和摘要保持可辨认。纸层几何阴影与透视是实体报纸语义，不是通用卡片装饰。
- 点击从所选报纸的实际位置抽出、展开到整窗。阅读器覆盖应用侧栏、顶栏和游览条；归位恢复原列表滚动与键盘焦点。桌面原生 View Transition 720ms 展开、600ms 收回；无该能力时使用局部 Web Animations，减少动态效果时直接切换。
- 原有 Fraunces 用于 V-Life 和日期，中文报头与栏目新增 `Songti SC, Noto Serif SC, ui-serif`。这是报纸编辑排版的限定字体栈；正文仍用现有正文体系。报头桌面 48–80px、移动端 35–40px；栏目与文章标题 18–32px；小号 9–13px 仅用于日期印记、状态和辅助信息，正文 14px / 宽松行高。
- 纸页保持直角，表单与小按钮允许 3–9px 的轻圆角。复用 `--background`、`--card`、`--foreground`、`--border` 与语义色；阴影用现有墨色透明度。无额外品牌色。
- 桌面宽窄分栏、手机单栏。图片是真实保存资产的缩略图，AI 与演示图片分别明确标识；无图、无复盘时保留完整文字阅读。
- 手机输入框、日期和选择器使用 16px（等同现有 `text-base` 规范），避免 iOS 聚焦时自动放大；这项无障碍尺寸不属于字体漂移。
- 月份收起保留一叠合拢纸页，显示份数与日期范围，整叠可点击展开。纸层沿用 9px/2px 的折边与 18–20px 栏目标题，属于上述报纸形态；开合以约 480ms 的高度压缩连接，不移除整块内容后留下空架。收回阅读器先让纸张平稳归位，保留实际键盘焦点但不残留抬起和框线；再次 Tab 导航显示焦点，实际指针移动恢复悬浮反馈。

本轮设计检测中的既有错题正文 Times New Roman/宋体、既有 8px 卡片和暖色阴影属于原有页面，不在此功能中重写。日报的宋体、报头字号、薄纸层和直角纸页为上述限定设计，不作为全站新默认值，也不使用检测忽略配置隐藏问题。
