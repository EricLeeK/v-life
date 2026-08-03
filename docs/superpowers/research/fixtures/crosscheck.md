# Fortune Rules Cross-check Fixtures

Retrieved / verified: 2026-08-03

## Day pillar (civil midnight)

| Date | Expected | Source |
|------|----------|--------|
| 1984-01-31 | 甲子 | ximizi / chenggong8 huangli pages (see `bazi_fixtures.json`) |
| 1984-02-02 | 丙寅 | Computed from verified anchor (+2 days) |
| 2019-01-27 | 甲子 | 60-day cycle from anchor |
| 2026-01-01 | 乙亥 | Computed from verified anchor |

**Reject:** `1984-02-02 = 甲子` (incorrect; that day is 丙寅).

## Shengxiao / CNY

| Date | Expected | Source |
|------|----------|--------|
| 2010-02-14 | Tiger year starts | HKO `T2010c.txt` 正月 |
| 2024-02-10 | Dragon | HKO `T2024c.txt` |
| 2025-01-29 | Snake | HKO `T2025c.txt` |
| 2026-02-17 | Horse | HKO `T2026c.txt` |

## Lunar label

| Date | Expected | Source |
|------|----------|--------|
| 2026-01-01 | 十一月十三 | HKO `T2026c.txt` / `T2026e.txt` day 13 before 12th month header |
| 2026-01-05 | 小寒 | HKO solar term column |
| 2026-01-19 | 十二月初一 | HKO month header |

## I Ching encoding

| Binary (bottom→top, yang=1) | King Wen | Name | Source |
|-----------------------------|----------|------|--------|
| 000000 | 2 | 坤 | Wikipedia Hexagram lookup |
| 111111 | 1 | 乾 | Wikipedia Hexagram lookup |
| 100000 | 24 | 复 | Wikipedia + OEIS A102241 |

## Moon

Primary phases defined by Moon−Sun ecliptic longitude difference 0/90/180/270° (USNO). Eight named phases per NASA Science.

## Zodiac

Tropical approximate civil dates per Wikipedia Astrological sign; precise mode uses 30° ecliptic bands from equinox.
