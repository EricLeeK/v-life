/** Pinned fortune rule pack version — bump when deterministic outputs change. */
export const FORTUNE_RULE_VERSION = "fortune-rules@1.2.0";

export const FORTUNE_RULE_SOURCES = {
  dayPillarAnchor: "1984-01-31=甲子 (civil midnight)",
  shengxiaoBoundary: "chinese_new_year",
  ichingLookup: "King Wen via binary bottom→top yang=1",
  calendarLib: "lunar-javascript@1.7.7",
  moonLib: "astronomy-engine@2.1.19 MoonPhase elongation",
  tarotMeanings: "Waite/de Laurence PD via research tarot_rws_78.json",
  horoscopeApi: "ohmanda.com/api/horoscope (via fortune-horoscope edge)",
  researchPackage: "docs/superpowers/research/fortune-rules-research/",
  dataAlignmentSpec: "docs/superpowers/specs/2026-08-03-fortune-data-alignment-design.md",
} as const;
