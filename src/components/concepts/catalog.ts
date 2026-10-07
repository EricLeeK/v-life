/** Each functional area owns one object. Cross-module reuse is intentionally forbidden. */
export const conceptCatalog = {
  home: { figure: "compass", title: "首页", path: "/", metaphor: "生活罗盘", gesture: "指针靠近，罗盘寻找方向；离开回到起始方位。" },
  pantry: { figure: "basket", title: "食材", path: "/pantry", metaphor: "新鲜菜篮", gesture: "菜篮轻倾，提手随后摆动。" },
  daily: { figure: "drawer", title: "日用品", path: "/belongings", metaphor: "常备物抽屉", gesture: "手指经过哪一格，那一格就轻轻拉开。" },
  durable: { figure: "laptop", title: "耐用品", path: "/belongings?tab=durable", metaphor: "陪伴日常的设备", gesture: "屏幕随指针展开，离开回到原来的角度。" },
  subscriptions: { figure: "plug", title: "订阅服务", path: "/belongings?tab=subscriptions", metaphor: "持续连接的服务", gesture: "插头靠近插座，离开后自然垂落。" },
  todos: { figure: "riffle", title: "待办", path: "/todos", metaphor: "一件件翻开的待办", gesture: "抽出一张任务卡，邻近卡片逐张让开；移开后自然归位。" },
  today: { figure: "focus", title: "今日待办", path: "/today", metaphor: "此刻的专注时钟", gesture: "移动指针拨动钟针，离开回到专注的起点。" },
  schedule: { figure: "calendar", title: "日程", path: "/schedule", metaphor: "翻到下一天", gesture: "台历纸页向上翻起，移开后轻落。" },
  finance: { figure: "vault", title: "记账", path: "/finance", metaphor: "收好每一笔的金库", gesture: "拨盘随指针转动，锁栓在刻度间回应。" },
  calories: { figure: "plate", title: "热量", path: "/calories", metaphor: "从一餐开始", gesture: "空餐盘向指针轻倾，餐具随后回应。" },
  goals: { figure: "terrain", title: "目标", path: "/goals", metaphor: "逐步长出的山峰", gesture: "目标附近的地形升起，向外逐渐平缓。" },
  projects: { figure: "exploded", title: "项目", path: "/projects", metaphor: "把想法拆成层次", gesture: "项目层板展开，指针所在的一层变清晰。" },
  learning: { figure: "book", title: "学习笔记", path: "/learning-notes", metaphor: "展开的一本书", gesture: "书页随指针翻展，离开合回自然的书脊。" },
  thoughts: { figure: "brainstorm", title: "随想", path: "/thoughts", metaphor: "一场小小的头脑风暴", gesture: "脑部轻轻舒展，念头向外散开，再聚拢。" },
  weight: { figure: "scale", title: "体重", path: "/weight-loss", metaphor: "感知身体的变化", gesture: "秤面轻轻受压，表针随之偏转。" },
  measurements: { figure: "tape", title: "围度", path: "/weight-loss#measurements", metaphor: "换一把尺子看变化", gesture: "卷尺的末端慢慢展开，离开重新卷回。" },
  civil: { figure: "exam", title: "考公", path: "/civil-service", metaphor: "认真解答下一题", gesture: "铅笔向题行移动，空白答题圈逐个回应。" },
  newspaper: { figure: "newspaper", title: "生活日报", path: "/newspapers", metaphor: "把一天折进报纸", gesture: "报纸沿中缝展开，离开后折回。" },
} as const;

export type ConceptKey = keyof typeof conceptCatalog;
export type HairlineName = typeof conceptCatalog[ConceptKey]["figure"];
export const moduleFigure = Object.fromEntries(Object.entries(conceptCatalog).map(([key, value]) => [key, value.figure])) as {
  [Key in ConceptKey]: typeof conceptCatalog[Key]["figure"];
};
export const customFigureNames: readonly HairlineName[] = ["brainstorm", "calendar", "book", "exam", "plate", "scale", "tape", "newspaper", "focus", "compass"];
