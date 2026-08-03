import { getLunarDayBundle, LUNAR_JS_SOURCE } from "./lunarDay";
import { FORTUNE_RULE_VERSION } from "./ruleVersion";

export interface AlmanacDay {
  yi: string[];
  ji: string[];
  chongsha: string;
  dayPillar: string;
  clashZhi: string;
  zhiXing: string;
  pengZu: string[];
  ruleVersion: string;
  source: string;
  /** Still false: folk library, not an imperial tongshu claim. */
  traditionalSystemClaim: false;
}

const EMPTY: AlmanacDay = {
  yi: ["平日行事"],
  ji: ["无"],
  chongsha: "",
  dayPillar: "",
  clashZhi: "",
  zhiXing: "",
  pengZu: [],
  ruleVersion: FORTUNE_RULE_VERSION,
  source: LUNAR_JS_SOURCE,
  traditionalSystemClaim: false,
};

/** Daily almanac from lunar-javascript (aligned with common Chinese almanac apps). */
export function getAlmanacForDate(isoDate: string): AlmanacDay {
  const bundle = getLunarDayBundle(isoDate);
  if (!bundle) return { ...EMPTY };

  return {
    yi: bundle.yi.length ? bundle.yi : ["平日行事"],
    ji: bundle.ji.length ? bundle.ji : ["无"],
    chongsha: bundle.chongsha,
    dayPillar: bundle.dayPillar,
    clashZhi: bundle.clashZhi,
    zhiXing: bundle.zhiXing,
    pengZu: bundle.pengZu,
    ruleVersion: bundle.ruleVersion,
    source: bundle.source,
    traditionalSystemClaim: false,
  };
}
