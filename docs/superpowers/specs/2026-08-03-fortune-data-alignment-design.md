# 运势数据对齐设计（方案 A）

> **日期：** 2026-08-03  
> **状态：** 已批准并实现中（方案 A）  
> **分支 / worktree：** `feat/fortune-hub`  
> **前置规格：** `docs/superpowers/specs/2026-07-31-fortune-hub-design.md`  
> **决策：** 采用方案 A——中式历法本地 `lunar-javascript` 对齐常见黄历算法；西式星座日运联网；个人项目允许使用网上数据源

---

## 1. 目标与原则

### 1.1 目标

把运势中枢从「娱乐向伪随机」升级为：

1. **能本地复现网上常见结果的** → 用同一套（或同源）规则库计算；
2. **没有公开可复核算法的** → 直接拉取网上数据；
3. AI **只润色结构化 facts**，不发明宜忌、星级或日柱。

### 1.2 原则（替换旧调研约束）

| 旧约束 | 新约束 |
|--------|--------|
| 禁止爬通书 / 尽量不用网上 | **允许**联网与第三方日运 API（个人项目） |
| 宜忌自写词库 + `traditional_system_claim: false` | 宜忌改用 `lunar-javascript` 输出，与常见黄历站可对拍 |
| 星级以日期种子为主 | 星级必须由可解释信号合成；换星座必须能看出差别 |
| 硬规则优先离线 | **中式历法仍优先离线**；西式日运允许在线，失败可降级 |

仍保留：确定性缓存（同用户同日稳定）、AI 失败有底稿、中英 UI、本地日 `YYYY-MM-DD`。

### 1.3 非目标

- 不做成专业命理咨询 / 合婚 / 医疗投资建议
- 不保证与「每一家」商业通书字字相同（各站词表略有差异；以 `lunar-javascript@已锁定版本` 为产品真源）
- 塔罗 / 易经 / 求签不改为「每日网上运势」品类（仍是本地仪式工具）

---

## 2. 模块改造一览

| 模块 | 策略 | 真源 | 说明 |
|------|------|------|------|
| 黄历宜忌 | 本地规则 | `lunar-javascript` `getDayYi` / `getDayJi` | 弃自写 YI/JI 词库抽样 |
| 冲煞 / 建除 / 彭祖百忌 / 喜神方位等 | 本地规则 | 同库对应 getter | 卡片可展示子集：宜忌 + 冲煞 + 建除必显 |
| 农历标签 / 日柱 | 本地规则 | 同库 | 与黄历同一 `Solar.fromYmd`，禁止第二套干支算法 |
| 生肖年界 | 本地规则 | 同库 CNY / 年柱 | 已部分接入，统一入口 |
| 月相 | 本地天文 | `astronomy-engine` | 保持 |
| 星座日运（文案 + 情绪/幸运等） | **联网** | 第三方日运 API（默认 aztro 或同等；经 Edge 代理） | 12 星座必须互异 |
| 今日总览星级 | 合成规则 | 黄历信号 + 生肖×日支 + 星座 API 字段 | 禁止「仅 seed → 全员 3 星」 |
| 生肖详解页 | 本地 + 可选文案 | 日支冲合害 + 规则底稿 | 可引用当日黄历冲煞 |
| 八字页 | 本地规则 | lunar 四柱 / 纳音等到日柱级 | 对齐常见排盘站日柱展示 |
| 星座详解页 | 联网优先 | 同星座日运 API | 切换星座刷新该日该座数据 |
| 塔罗 / 易经 / 求签 | 保持本地 | 现有校准规则 + PD 牌义 | 不强制联网 |
| AI 解读 | 润色 | `ai-chat` `mode: fortune` | facts 必须来自上表真源 |

---

## 3. 黄历与干支（本地）

### 3.1 单一入口

新增或收敛为 `src/lib/fortune/lunarDay.ts`（名可微调）统一：

```ts
getLunarDayBundle(isoDate: string) → {
  yi: string[];
  ji: string[];
  dayPillar: string;      // 如 己酉
  chongsha: string;       // 库的冲煞描述
  zhiXing: string;        // 建除
  pengZu: string[];       // 可选
  lunarLabel: string;     // 农历月日文案
  shengxiaoYear: ...;
  ruleVersion: string;    // 含 lunar-javascript 版本
  source: "lunar-javascript@x.y.z";
}
```

`almanac.ts` / `lunarLabel.ts` / `bazi` 日柱展示改为消费该 bundle，删除产品词库 `pickN(YI/JI)`。

### 3.2 对拍验收

固定 fixtures（至少 3 个日期）断言 `yi`/`ji`/`chong` 与直接调用 `Solar.fromYmd(...).getLunar()` 一致。手工抽一天与任意常见黄历站对比「宜忌大类 + 冲某肖」是否同向（允许词条集合不完全相同）。

---

## 4. 星座日运（联网）

### 4.1 代理

新增 Edge Function（建议名 `fortune-horoscope`）或并入现有函数：

- 入参：`sign`、`day`（`today` | `yesterday` | `tomorrow` 或 ISO，以所选 API 能力为准）
- 服务端请求第三方；浏览器不直连（规避 CORS / 隐藏实现细节）
- 返回规范化 JSON：

```ts
{
  sign: ZodiacSign;
  date: string;
  text: string;           // 日运正文
  mood?: string;
  luckyNumber?: string;
  luckyColor?: string;
  compatibility?: string;
  // 若 API 无星级，由服务端或客户端用稳定 hash(text|sign|date) 映射到 1–5，但必须 sign 维可区分
  stars?: { overall: number; love?: number; career?: number; wealth?: number };
  source: string;
}
```

### 4.2 默认源与降级

1. 首选：**aztro**（或调研时仍可用的免费日运 API）
2. 失败：展示「今日无法拉取星座日运」+ 本地弱底稿（须标明非网络数据），**不得**静默退回全员 3 星假装日运
3. 缓存：`fortune_daily_cache` payload 增加 `horoscopeBySign` 或按 `sign` 分 key；登录用户同日复用

### 4.3 星座页 UX

- 切换星座 → 拉/读缓存该座当日数据 → 星级与文案变化可见
- 档案星座为默认选中项

---

## 5. 今日总览星级合成

### 5.1 输入信号

- **H（黄历）：** 例如宜条目数 vs 忌、或库若提供吉凶字段；映射到约 `[-1, 1]`
- **S（生肖）：** 档案生肖 vs 当日日支：六冲 / 六合（及可选三合）→ `[-1, 1]`；无档案则 `0` 且 meta 仍为「通用今日」
- **Z（星座）：** 来自 API 的 mood/stars/正文派生分；无档案无星座则不用 Z，或仅用「通用」不展示伪星座分

### 5.2 输出

```
overall / love / career / wealth ∈ {1..5}
```

权重可配置但需写入 `ruleVersion`。禁止仅用 `3 + tinyTexture` 作为主路径。

有档案时 meta：`专属今日 · 星座 · 属肖`；无档案：`通用今日`（黄历/月相仍真，星级偏黄历日运而非个人）。

---

## 6. 八字 / 生肖页

- **八字：** 展示与 lunar 一致的日柱、纳音；有时辰则排四柱（库能力范围内）；文案底稿基于真实柱而非随机
- **生肖：** 年柱/日冲合用 bundle；详解 AI facts 带上当日冲煞与关系类型

---

## 7. 仪式工具（不强制改源）

| 工具 | 策略 |
|------|------|
| 塔罗 | 保持 78 牌 + PD 关键词 + seed 抽牌 |
| 易经 | 保持 King Wen + 变爻 |
| 求签 | 保持产品 100 签（继续 `traditional_system_claim: false`） |

若后续要「和某庙签一模一样」，另开规格，不在本次范围。

---

## 8. 工程与数据层

- 依赖：锁定 `lunar-javascript`、`astronomy-engine` 版本；`ruleVersion` 含二者版本号
- Edge：部署 horoscope 代理；更新 `ai-chat` fortune facts 字段说明（文档级即可）
- Types / RLS：沿用 `fortune_daily_cache`、`fortune_readings`、`settings.fortune_profile`
- Demo / 游客：黄历本地仍可用；星座 API 在未登录策略二选一——**允许匿名调用代理（个人项目）** 或强制登录；默认 **允许匿名但 rate limit**（实现计划里定）

---

## 9. 验收清单

- [ ] 固定日期 fixtures：`yi`/`ji`/冲煞与 `lunar-javascript` 直接调用一致
- [ ] 星座页切换 12 座，正文或星级至少一项明显不同（API 正常时）
- [ ] 无档案不再出现「假宜忌词库」；可出现「通用今日」但黄历为真
- [ ] API 失败有明确降级文案，不静默假 3 星
- [ ] 今日总览缓存写入含 `source` 与规则版本
- [ ] 相关单元测试更新并通过

---

## 10. 实现顺序（供计划拆分）

1. `lunarDay` bundle + 替换 almanac / lunarLabel / 冲煞  
2. 星级合成去掉伪随机主路径（先接 H+S）  
3. Edge horoscope 代理 + 星座页 / 总览接 Z  
4. 八字 / 生肖页对齐 bundle  
5. AI facts 与缓存字段、文案来源标注  
6. 测试与手工对拍  

---

## 11. 已否决

- **方案 B：** 黄历也全走商业 HTTP API（无必要；本地库已能对齐常见结果）
- **方案 C：** 继续自写伪随机冒充日运
