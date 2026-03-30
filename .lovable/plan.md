

## V-Life Manager — Implementation Plan

### Foundation
- **Dark theme design system** inspired by Perplexity: deep backgrounds (#0D0D0D, #1A1A1A), blue/cyan accents (no purple), medium rounded corners, subtle borders
- **Responsive sidebar navigation** (desktop: full sidebar, tablet: collapsible, mobile: bottom nav) with icons for all 8 modules + settings
- **Supabase database setup**: All tables (pantry_items, belongings_daily, belongings_durable, schedule_events, calorie_records, finance_records, todos, thoughts, ai_sessions, ai_messages, settings, backups) with `user_id` reserved field
- **Chinese UI** throughout

### Module 1: Dashboard (首页概览)
- Responsive card grid showing: today's schedule, calorie progress bar, monthly spending vs budget, pending todos count, expiring pantry items, overdue durable goods savings, recent thoughts
- Each card clickable → navigates to its module

### Module 2: Finance (记账)
- Monthly overview with total spending, budget progress bar, category pie chart (Recharts)
- 12 expense categories with emoji icons
- Weekly collapsible sections (week assigned to month by Wednesday rule)
- Dual currency: JPY entries auto-convert to CNY using stored exchange rate
- Each record stores exchange rate snapshot
- Settings: exchange rate fetch button, monthly budget config

### Module 3: Calories (热量记录)
- Shared 7-day navigation bar with expandable 4-week month view
- Daily view with 4 meal slots (breakfast/lunch/dinner/snack)
- Per-meal subtotal + daily total + progress bar vs target (default 2000 kcal)
- Manual add/edit/delete per entry

### Module 4: Todos (待办事项)
- 3 view modes: by category, by importance, flat list
- 4 importance levels (紧急/重要/普通/低优先) with color coding
- Custom user categories, completion checkbox, expandable detail text
- Completed items gray out and sink to bottom

### Module 5: Schedule (日程计划)
- 3-day calendar view with vertical 0-24h time axis
- 7-day quick nav bar + expandable 4-week view
- Drag to create events, drag to resize/move (@dnd-kit)
- Event detail panel: title, time, color, importance, status toggle, notes
- Recurrence support (daily/weekly/monthly/custom) with "edit this one" vs "edit all future"
- Importance-based default colors (red/orange/blue/gray), overridable

### Module 6: Pantry (食材管理)
- Grouped by 6 categories, filterable by status (all/expiring/expired)
- Auto status calculation from expiry_date
- Search, expandable detail/edit per item

### Module 7: Belongings (用品管理)
- Two tabs: daily consumables (simple list) + durable goods (with cost tracking)
- Durable goods: real-time calculated daily cost, "超值" badge when past expected lifespan, savings amount display
- Design encourages longevity over replacement

### Module 8: Thoughts (随想)
- Markdown card layout (masonry/grid) with react-markdown rendering
- Tag filtering (preset: 科研🔬, 生活🏠, AI🤖, 杂念💭 + custom)
- Optional title, emoji icon, sorted newest first

### AI Entry System (全局 AI 录入)
- Floating button (bottom-right desktop, bottom nav mobile) → opens side drawer
- Text + image input, sends to Supabase Edge Function
- Edge function calls user-configured LLM (Gemini/DeepSeek/SiliconFlow via OpenAI-compatible API)
- AI returns structured JSON actions → preview before execute (Mode A) or auto-execute with undo (Mode B)
- Cross-module operations (e.g., lunch → finance + calories simultaneously)
- Session management: 30 session history, continuable conversations
- Settings page: API platform selector, API key, model name, base URL, operation mode toggle

### Settings (设置)
- AI API configuration (platform, key, model, base URL, mode)
- Exchange rate management (fetch latest + display current)
- Monthly budget setting
- Calorie target setting
- Custom tags for thoughts
- Data export (full JSON download) / import (JSON upload → IndexedDB for offline)
- Backup list viewer (from Supabase Storage)

### Data Management
- IndexedDB local cache for offline reading
- One-click export/import for flight mode workflow
- Auto weekly backup via edge function (cron) → Supabase Storage, rolling 3 backups

