---
name: V-Life Project Board
description: Warm Desk Ledger 项目看板局部设计记录
colors:
  background: "hsl(40 20% 95%)"
  foreground: "hsl(30 25% 10%)"
  card: "hsl(0 0% 100%)"
  primary: "hsl(30 25% 10%)"
  primary-foreground: "hsl(0 0% 100%)"
  muted: "hsl(40 16% 91%)"
  muted-foreground: "hsl(36 12% 40%)"
  border: "hsl(40 16% 87%)"
  cat-green: "hsl(100 45% 28%)"
  cat-blue: "hsl(207 55% 36%)"
  cat-orange: "hsl(22 65% 36%)"
  cat-purple: "hsl(256 45% 42%)"
  cat-red: "hsl(0 55% 40%)"
  cat-yellow: "hsl(40 70% 30%)"
  cat-teal: "hsl(185 55% 28%)"
typography:
  compact:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
rounded:
  lg: "var(--radius)"
  md: "calc(var(--radius) - 2px)"
  sm: "calc(var(--radius) - 4px)"
spacing:
  compact: "8px"
  stack: "12px"
  group: "16px"
  columns: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  item-input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "40px"
  work-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
  filter-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  status-label:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
---

# Design System: V-Life Project Board

## Overview

**Creative North Star: "Warm Desk Ledger"**

这是 Warm Desk Ledger 在项目管理中的局部扩展：暖纸背景、墨色层级、语义分类色与细栏线维持原品牌，柔和纹理和拖动重量感帮助辨认与移动工作项。四列工作台的形式来自已批准原型，未重新选择 FORM，也没有随机 seed。

本文件只约束项目看板及其工作项弹窗；全局品牌仍以根 DESIGN.md 为准。记录依据为实际组件、样式与最终桌面、手机、暗色和纹理选择器截图；功能与验证详情见 README.md。

**Key Characteristics:**
- 语义色随明暗主题切换
- Inter 为看板信息主字体，复用小圆角
- 纹理可选、拖动有重量、减少动态效果可用

## Colors

### Primary
墨色承载主操作、项目名称与当前层级；封面不另设品牌主色。

### Secondary
现有 cat 色承载分类与状态：蓝色进行中、橙色等待、绿色完成、红色逾期；旧“本周”列使用紫色。封面借用绿/黄、黄/橙、橙/红、蓝/青、紫/橙五组现有颜色。

### Neutral
背景、卡片、辅助文字、边框均引用全局同名变量。frontmatter 记录亮色默认值；暗色由 src/index.css 的 .dark 覆盖，局部没有独立暗色色表。封面混色也跟随 card 与 cat 变量变化。sidecar 的八阶色带仅供文档面板预览，由默认色合成；不是新增运行时 token。

**The Shared Palette Rule.** 纹理、状态与进度复用现有语义色，不建立项目专属色表。

## Typography

看板继承 Inter 与系统后备字体；紧凑标题、列标题和侧栏项目名使用 compact，筛选与摘要使用 label，日期、描述和类型信息使用 caption。卡片标题行高（1.65），描述行高（1.7）并截为两行。工作项弹窗标题继续复用全站 Fraunces display，不建立新的展示字体。

## Layout

桌面保留项目侧栏与工作区。默认待办、进行中、等待中、已完成四列，只有实际存在“本周”事项时显示第五列。每列最小宽度（220px），列间距使用 columns，卡片垂直间距使用 stack；列间细线使用主题边框的透明度变体。

工作区头部与列区的桌面水平内边距（28px）。视口不大于（767px）时改为（18px），标题与操作换行、筛选铺满一行，列区保留横向滚动。手机的拖柄、列添加、里程碑完成、习惯打卡和头部按钮具有至少（44px）的命中高度；拖柄和完成按钮同时保证命中宽度。此规则限定这些已实现的控件，不推断所有存量控件都已达标。

## Elevation & Depth

细栏线与主题表面建立主要层级，卡片使用轻微软阴影；被拖起的卡片才呈现较深的扩散阴影。选中筛选沿用 shadow-btn，侧栏当前项目沿用 shadow-card。阴影的精确值存于局部 sidecar。

**The Lift While Carried Rule.** 卡片静止时保持轻阴影，仅拖动浮层使用明显抬升阴影。

## Shapes

卡片、拖动占位与侧栏项目继承全局 radius；筛选、状态签和完成按钮沿用 md，分布条沿用 sm。纹理选项外框沿用（8px）圆角。虚线占位保留原卡高度，卡片内容不会在拾起时改变尺寸。

## Components

### Buttons / Inputs
主操作和编辑操作复用全站 Button；主操作保持墨色实底，编辑使用 ghost/secondary。标题、权重与日期输入沿用共享表单组件。保存期间禁用提交，错误由现有提示组件反馈；新增事项与新增项目的入口文案明确区分。

### Navigation / Filters
项目侧栏显示项目名称与进度；当前项目的进度由与看板相同的工作项函数计算。全部、任务、习惯、里程碑筛选以 aria-pressed 表示选择。项目状态签属于真实状态信息，手机隐藏该辅助签。

### Work Card
标题、可选两行描述、类型图标和日期构成稳定信息顺序，卡片正文内边距（15px 15px 12px）。里程碑可以完成/重新打开；习惯另设本周天数与今日打卡底栏。完成后的标题转为辅助文字色，并保留完成图标。任务与里程碑参与加权进度，习惯不参与。

### Texture Picker
五款纹理为鼠尾草、暖沙、陶土、雾蓝、鸢尾；另有自动与无封面。选择器四列，使用缩略封面、名称和选中勾，不依赖颜色独自传达选择。自动仅为里程碑使用鼠尾草；正式账户保存 cover_preset。封面以主题混色、模糊径向渐变与本地 grain.png 构成，正常卡高（64px）、选择器预览高（36px）。这些是局部装饰材质，不承载业务优先级。

### Weighted Drag
桌面可拖卡，触屏经拖柄开始；移动超过（4px）后拾起。位置使用阻尼弹簧，横向速度控制倾角并限制在（±4.5°），停止时回正，释放后吸附；邻卡用弹簧让位。减少动态效果时位置直接跟随、倾角为零、邻卡无过渡，分布条也取消过渡。空格/Enter 拾起与放下、方向键移动、Esc 取消，并以 live region 播报。保存失败恢复服务端状态并提示。

## Do's and Don'ts

### Do:
- Do 保留任务、里程碑与习惯的视觉与行为区别；习惯独立打卡。
- Do 保留手机拖柄、完成和打卡的至少 44×44px 命中区。
- Do 复用主题变量、双语文案和减少动态效果分支。

### Don't:
- Don’t 将局部四列构图、纹理或拖动倾角推广为全站规则。
- Don’t 把颜色或纹理当作事项类型、完成状态的唯一提示。
- Don’t 把截图中的示例项目、日期或设计试验工具栏写入产品规范。

局部例外：封面内短标签延续用户批准的原型，并经最终审查保留；它不代表新增的业务优先级。该表现仅适用于这套纹理卡片，不推广为全站装饰眉题规则。

### Editing overlay (2026-11-01 用户修订)

编辑模式保持侧栏和看板流式布局不变：项目操作区在标题状态旁预留固定空间，切换按钮按最长标签预留宽度。工作项操作以 44px 命中区覆盖于右上角，铅笔在内、圆形删除叉在角上；卡片周围始终保留相同空间。普通状态点击卡片不编辑。编辑时外壳进行 ±0.3° 的交替旋转，不改变文档流；操作按钮悬停/卡片获焦时暂停，减少动态效果时取消。顶部保存保护用 aria-disabled 和点击守卫，不通过透明度表达短暂的保存状态。

角标与拖动提示补充：编辑铅笔和删除叉共享同一上沿及圆形底；落位框为 2px 暖灰虚线（muted-foreground / 50%）。左侧所有项目在静止、拖起和回落时均使用不透明底色。未选中使用 card，选中使用 muted/card 的实色混合背景和更清晰的边框；边框宽度始终一致，切换选择不改变尺寸。

### 2026-11-01 图标与列头细化

标题使用 32px 每项目 SVG；默认暖棕几何线稿，网格/学位/网站/书页/生长/探索按项目主题匹配。自定义上传在独立 img 中显示。列头 44px、与状态分布条同源的淡色晕染和 2.5% 纸纹，卡片列表独立滚动。列间距 12px、列表横向内边距 6px，卡片更宽。筛选用同一个弹簧滑块表示选择。封面新增海盐、玫瑰纸、石墨、琥珀，提供不同粒度与晕染形态；只增加视觉重点，不改变工作项权重。
