# V-Life Fortune Rules Compendium

> **类型：** 调研结论 / 工程规则知识库  
> **日期：** 2026-08-03  
> **对应任务书：** `docs/superpowers/research/2026-08-03-fortune-rules-research-brief.md`  
> **状态：** 主报告 + 机器可读附件已入库（`fortune-rules-research/`；见文末附件表）

---

## 执行摘要

运势中枢应严格分层，禁止把三类东西混成「传统真理」：

| 规则层 | 工程地位 | 产品处理 |
|--------|----------|----------|
| 公历日期、时区、农历转换、节气、月相几何 | 客观计算或约定绑定计算 | 确定性硬规则 + 黄金样例 |
| 干支、建除十二神、生肖关系、塔罗牌阵、铜钱起卦 | 传统体系，多流派 | **声明所选流派与版本** |
| 宜忌活动筛选、星级权重、温和解读、自建签谱 | 产品作者规则 | 版本化编辑规则，不作科学预测 |
| AI 文案 | 仅展示层 | 只接收结构化 facts，不得发明计算 |

### 必须立即纠正的错误

| 现状 | 纠正 |
|------|------|
| `1984-02-02 = 甲子` 日柱锚点 | 改为 `1984-01-31 = 甲子`；`1984-02-02` 为 **丙寅** |
| 生肖按公历年 | 按**农历正月初一（春节）**换属相 |
| 六爻二进制直接当文王卦序 1–64 | 使用规范 binary → King Wen 查表 |
| 毫秒日序伪干支 | 用整数民用日或儒略日算术 |
| 黄历冲煞随机抽生肖 | 由日支对立支推导 |
| 固定朔望月近似月相 | 用星历求日月黄经差 |
| 纯哈希星级 | 有界、可解释因子 + 极小 seed 纹理 |
| 零散随机辅助 | 统一 seed / PRNG / cache / `rule_version` 协议 |

日柱对照：独立万年历资料将 **1984-01-31** 标为甲子日，**1984-02-02** 为丙寅。香港天文台 2026 年 1 月黄历给出 **2026-01-01** 为农历十一月十三、**乙亥**日，与纠正后的锚点算术一致。

香港天文台公布 1901–2100 公历–农历对照，并提醒远期个别朔/节气靠近午夜时，天文估值精化可能导致差一天。因此 V-Life 必须**钉死日历数据版本**，禁止静默升级库导致历史结果重写。

---

## 推荐规则架构

### 1. 历法、农历标签与日柱（共享服务）

所有中式历法模块应调用同一服务，契约示意：

```ts
interface ChineseCalendarInput {
  localDate: string;          // YYYY-MM-DD
  timezone: string;           // IANA
  evaluationTime?: string;    // 默认本地 12:00:00
  calendarRuleVersion: string;
  dayBoundaryMode: "civil_midnight" | "zi_23";
}

interface ChineseCalendarFacts {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  yearPillarCivil?: string;
  monthPillarSolarTerm?: string;
  dayPillar: string;
  dayPillarIndex: number;
  solarTerm?: string;
  provenance: string;
  confidence: "exact" | "boundary_sensitive" | "unsupported";
}
```

首页推荐紧凑标签：

```text
农历十一月十三 · 乙亥日
```

实现候选：版本钉死的本地历法库（如 MIT `lunar-javascript`），但宜忌等不透明表须**独立校验**，不可把库 API 当自证权威。

日柱公式（整数民用日或儒略日）：

```text
index = mod(dayNumber(effectiveLocalDate) - dayNumber(1984-01-31), 60)
```

禁止：

```text
Math.floor(timestampMilliseconds / 86_400_000)
```

日界两派并存：`zi_23`（23:00 换日）与 `civil_midnight`。工程上须显式声明模式。  
**默认推荐 `civil_midnight`**（与展示公历日、无时辰档案对齐）；`zi_23` 可作为命名高级模式。

### 2. 生肖与地支关系

属相在**农历正月初一**切换，不是 1 月 1 日。样例：

| 生日 | 期望属相 |
|------|----------|
| 2024-02-09 | 兔 |
| 2024-02-10 | 龙 |
| 2025-01-28 | 龙 |
| 2025-01-29 | 蛇 |
| 2026-02-16 | 蛇 |
| 2026-02-17 | 马 |

（香港天文台：2026 年春节为 2 月 17 日。）

档案字段建议与八字年柱立春换年**分开**：

```json
{
  "shengxiao_boundary": "chinese_new_year",
  "shengxiao": "Horse",
  "year_branch": "午",
  "bazi_year_pillar_boundary": null
}
```

P0 日关系仅保留易解释集合：六合、三合、六冲。刑、害延后。黄历「冲」与档案日关系必须共用同一地支表。

### 3. 黄历宜忌与冲煞

现代黄历没有唯一标准输出。首版推荐透明的 **V-Life almanac-lite**，声明 `source_layer` 与 `rule_version`，勿逆向某商业 App 后伪装成唯一传统答案。

P0 载荷示意：

```json
{
  "lunar": {},
  "sexagenary_day": {},
  "solar_term_month_branch": "丑",
  "day_officer": "除",
  "clash": {
    "day_branch": "子",
    "opposite_branch": "午",
    "animal": "Horse"
  },
  "sha_direction": "south",
  "recommended": ["clean", "declutter", "wellness_routine"],
  "avoid": ["add_unnecessary_obligations"],
  "source_layer": "transparent_vlife_lite",
  "rule_version": "almanac-lite/1.0.0"
}
```

建除十二神：

```text
officerIndex = mod(dayBranchIndex - solarTermMonthBranchIndex, 12)
0建 1除 2满 3平 4定 5执 6破 7危 8成 9收 10开 11闭
```

月支须由**节气时刻**定，不可简单用农历月或公历月。

冲：

```text
oppositeBranchIndex = (dayBranchIndex + 6) mod 12
```

煞方最小表：申子辰南、寅午戌北、亥卯未西、巳酉丑东。

首页宜忌用产品安全活动矩阵（由建除推导），传统词做软化（作灶→下厨等）。安葬、破土、疾病/诉讼吉凶等不上首页。完整通书层二期再接具体版本与优先级规则。

### 4. 月相

用日月视黄经差：

```text
phaseAngle = normalize(moonLongitude - sunLongitude)  // [0,360)
illumination = (1 - cos(phaseAngle)) / 2
```

八相按 45° 扇区划分（产品约定；精确朔望弦在 0/90/180/270°）。  
推荐离线库：Astronomy Engine（MIT）。首页在**所选本地日 12:00**求相，避免午夜翻牌。观测地仅影响升落/方位，不影响地心月相。

### 5. 热带黄道星座

默认 **Tropical**：春分起每宫 30°。静态生日表仅作无时刻回退；有出生瞬间则用太阳黄经。交界日无时刻 → `status: "ambiguous"`。出生地坐标对太阳星座非必需，**出生时区**才是关键。上升/宫位属 P2。

### 6. 轻量八字五行

勿标成完整「五行旺衰」。P0：`simple_visible`——日干权重 2 + 日支本气权重 1；有时辰可加小时干支小权重。大运、流年、用神、疾厄、婚财断语一律禁止。

---

## 互动系统与自建知识资产

### 塔罗（RWS 78 · 三牌）

- 无放回 Fisher–Yates；正逆位各 50%  
- 牌阵声明为 V-Life 默认「过去模式 / 当下状态 / 温和建议」，非唯一正统 RWS 阵  
- 牌面：优先几何自绘或经核验的公有领域扫描；勿直接用现代商业牌图/解说  
- 无 AI 时用固定语法拼接关键词，禁止发明事件/诊断/恐吓

### 易经

- 铜钱：背 2 / 字 3 → 6旧阴变、7少阳、8少阴、9旧阳变；**自下而上**  
- 编码：阴 0 阳 1，bit0=初爻，bit5=上爻  
- `000000` → 坤（文王 2）；`111111` → 乾（文王 1）  
- 变爻翻转变卦；多变爻默认透明展示（见调研原文表），不假装唯一古法  
- 产品用**原创短摘要**，勿整段复制现代译本

### 求签

- 商用推荐自建 `vlife_original_100`，不宣称观音/黄大仙/关帝/月老原文  
- 等级分布：上吉 10 / 吉 30 / 中平 35 / 小慎 20 / 待时 5；**不用凶/大凶**  
- Daily / Question 两种 seed 模式（见 seed 协议）

---

## 星级、档案、Seed 与历史

### 可解释星级（娱乐仪式分）

```text
raw = 3.0 + 关系 + 月相 + 黄历冲动 + 星期编辑因子 + personalTexture[-0.12,+0.12]
final = roundToHalf(clamp(raw, 1.5, 4.5))
```

冲不可逼成 1 星。载荷须暴露 top factors + 一行中文解释。

### 档案

源字段：`birth_date`、`birth_hour`(0–23)、可选 `birth_minute` / `birth_timezone` / `birth_place`。  
派生只读默认；手动覆盖须 `locked` + `derived_from_hash`；改生日必须显式选择清除或保留覆盖。  
原始生日/地点/邮箱/电话不得写入随机 seed。

### Seed / PRNG / Cache

- 旧 mulberry32 冻结为 `mulberry32-v1` 仅回放历史  
- 新协议：canonical seed → UTF-8 NFC → SHA-256 → xoshiro128**（版本钉死）→ rejection sampling  
- Seed 形态：`vlife|v1|{tool}|{mode}|{subject_id}|{date_or_dash}|{nonce_or_dash}|{rule_version}`  
- Cache：`subject + local_date + timezone + profile_hash + rule_bundle_version`  
- 历史存**物化 payload**，禁止用新规则静默重算旧记录

---

## CI 发布闸门（节选）

| 闸门 | 期望 |
|------|------|
| 1984-01-31 日柱 | 甲子 |
| 1984-02-02 日柱 | 丙寅 |
| 2026-01-01 日柱 | 乙亥 |
| 2026 生肖切换 | 2/16 蛇；2/17 马 |
| 六爻 000000 / 111111 | 坤2 / 乾1 |
| 塔罗三张 | ID 互异 |
| 有界随机 | rejection sampling，不用 `% n` |
| 历史载荷 | 含 seed/PRNG/rule versions |
| 安全 lint | 无诅咒、死亡、疾病、灾难、必输类断言 |

日历验收最终应覆盖分层日期 ≥1000 + 春节/闰月/节气/闰日/时区切换/两种子时模式；以 HKO 1901–2100 为黄金对照。

---

## 版权结论（摘要）

| 资产 | 结论 |
|------|------|
| Astronomy Engine | MIT，可用（保留声明） |
| MIT 农历库 | 可用 + 独立校验 |
| HKO 历法事实 | 适合做对照样例（注意再分发条款） |
| NASA 科学数据 | 一般可复用；Logo/背书另限 |
| Swiss Ephemeris | AGPL 或商业许可决策 |
| 《周易》古文 | 公有领域；现代译本通常受版权保护 |
| 历史 RWS 扫描 | 逐文件/法域核验 |
| 现代塔罗牌版与解说 | 勿抄 |
| 商业黄历文案/库 | 勿爬、勿克隆 |
| 自建塔罗摘要 / 100 签 / 星级与活动矩阵 | 原创草稿，上线前需人工双语与法务过目 |

---

## 实现里程碑

| 优先级 | 工作 |
|--------|------|
| **P0** | 本地日/时区契约；真农历；纠正日柱；春节生肖；规范易经查表；透明 almanac-lite；rule_version 历史与缓存 |
| **P1** | Astronomy Engine 月相与太阳黄经；精确 cusp；塔罗/签谱人工编辑；可选时柱；跨运行时 PRNG 向量 |
| **P2** | 校准星级模型；更丰富组合文案；具名授权通书层；更多牌阵；可选真太阳时 |

---

## 机器可读附件（已入库）

路径：`docs/superpowers/research/fortune-rules-research/`

| 文件 | 内容要点 | 主来源 |
|------|----------|--------|
| `manifest.json` / `SOURCES.md` / `README.md` | 清单与来源索引 | — |
| `data/shengxiao_cny.json` | 春节边界 2010–2037；HKO 核验至 2030 | HKO 对照表 / 博客；Wiki 2031+ 待复核 |
| `data/bazi_fixtures.json` | 日柱锚点 `1984-01-31=甲子` 与样例 | 万年历页 + 模运算 |
| `data/iching_64.json` + `iching_fixtures.json` | 文王查表；底爻=LSB | Wikipedia Hexagram + OEIS A102241 |
| `data/zodiac_boundaries.json` | 热带黄道近似日期与 30° 带 | Wikipedia Astrological sign |
| `data/moon_phases.json` | 八相位；黄经差定义 | USNO + NASA |
| `data/almanac_*.json` | schema、HKO 2026-01 样例、产品宜忌词库 | HKO；宜忌层 `traditional_system_claim:false` |
| `data/tarot_rws_78.json` | 78 牌 + PD 占卜义摘录 | Gutenberg #43548 / Wikipedia RWS |
| `data/lots_vlife_100.json` | 100 签产品稿 | **非**庙签；产品原创 |
| `data/score_model.json` / `profile_schema.json` / `seed_spec.json` | 星级因子、档案、seed 协议 | 产品层 + 复用上述事实 |
| `fixtures/crosscheck.md` | 黄金对照 | 同上 |

**状态：** 附件已齐，可开 P0 规则落地（替换 `src/lib/fortune/*`）。签文中英与塔罗中文关键词仍需人工润色后再上线。

---

## 已知局限（调研自述）

1. `shengxiao_cny.json` 目前 HKO 核验至 2030；2031–2037 来自 Wikipedia，落地 CI 前须再对 HKO 文本。1901–2100 全表应由钉死版本的历法引擎生成并以 HKO 门禁校验。  
2. HKO 样例把节气印在公历日上；月支/节气精确换界仍须星历时刻，禁止「印了节气就按午夜换月支」。  
3. 塔罗中文关键词、100 签正文仍是草稿；上线前需人工双语润色与安全 lint。  
4. 合并进 `feat/fortune-hub` 前须对照 `src/lib/fortune/*` 做 schema/历史兼容检查。
