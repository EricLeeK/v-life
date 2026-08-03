# Fortune Rules Research Package

机器可读规则包，配套主报告：

`docs/superpowers/research/fortune-rules-compendium.md`

## 原则

1. **有来源才写入。** 历法/天文事实必须可追溯到 HKO、USNO、NASA、Wikipedia 查表或公有领域文本。
2. **分层标注。** 区分：客观历法事实 / 声明的传统惯例 / V-Life 产品娱乐规则。
3. **禁止伪传统。** 宜忌 lite、100 签、星级权重等必须 `traditional_system_claim: false`，不得伪装成通书或庙签。

## 目录

```text
manifest.json                 # 文件清单与主来源索引
data/*.json                   # 规则与样例数据
fixtures/crosscheck.md        # 黄金对照表
SOURCES.md                    # 来源总表
```

## 快速验收

| 断言 | 期望 |
|------|------|
| 日柱锚点 | `1984-01-31 = 甲子`；`1984-02-02 = 丙寅` |
| 2026-01-01 | 农历十一月十三；日柱乙亥（由锚点推算） |
| 2026 春节 | `2026-02-17`（HKO） |
| 易经 | `000000→坤(2)`，`111111→乾(1)` |
| 塔罗 | 78 张；牌义摘自 Gutenberg #43548（Waite 系公有领域） |
| 签谱 | 100 签；明确非观音/月老体系 |

## 下一步

用本包的 `rule_version` 与 fixtures 替换 `feat/fortune-hub` 中 `src/lib/fortune/*` 的近似算法（P0）。
