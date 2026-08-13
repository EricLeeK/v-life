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
  cat-green: "hsl(100 35% 40%)"
  cat-blue: "hsl(207 40% 53%)"
  cat-orange: "hsl(22 65% 55%)"
  cat-teal: "hsl(185 34% 51%)"
  cat-purple: "hsl(256 30% 60%)"
  cat-yellow: "hsl(40 55% 51%)"
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
- Border `--input`, warm field wash `--field-warm` on hover where used
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
