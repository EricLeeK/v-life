import * as Astronomy from "astronomy-engine";
import { FORTUNE_RULE_VERSION } from "./ruleVersion";

export interface MoonPhaseInfo {
  phase: string;
  phaseZh: string;
  phaseEn: string;
  blurbZh: string;
  blurbEn: string;
  illumination: number;
  /** Moon−Sun ecliptic longitude difference in degrees [0, 360). USNO primary-phase definition. */
  elongationDeg: number;
  method: "astronomy_engine_elongation";
  ruleVersion: string;
}

const PHASES: Array<{
  key: string;
  zh: string;
  en: string;
  blurbZh: string;
  blurbEn: string;
}> = [
  { key: "new", zh: "新月", en: "New Moon", blurbZh: "适合轻轻种下一个小想法。", blurbEn: "A gentle moment to plant a small idea." },
  { key: "waxing_crescent", zh: "蛾眉月", en: "Waxing Crescent", blurbZh: "适合播种想法，一步一步来。", blurbEn: "Good for starting small and building." },
  { key: "first_quarter", zh: "上弦月", en: "First Quarter", blurbZh: "适合推进一件卡住的小事。", blurbEn: "Push one stuck task forward." },
  { key: "waxing_gibbous", zh: "盈凸月", en: "Waxing Gibbous", blurbZh: "接近完成，收个尾会很爽。", blurbEn: "Almost there—finish something." },
  { key: "full", zh: "满月", en: "Full Moon", blurbZh: "适合表达与庆祝小小进步。", blurbEn: "Share and celebrate small wins." },
  { key: "waning_gibbous", zh: "亏凸月", en: "Waning Gibbous", blurbZh: "适合复盘，把心得记下来。", blurbEn: "Reflect and jot a short note." },
  { key: "last_quarter", zh: "下弦月", en: "Last Quarter", blurbZh: "适合放下多余负担。", blurbEn: "Let go of one extra burden." },
  { key: "waning_crescent", zh: "残月", en: "Waning Crescent", blurbZh: "适合休息，给自己留白。", blurbEn: "Rest and leave some whitespace." },
];

/** Product UI binning: snap to primary phases within ±7.5° (research moon_phases.json). */
const PRIMARY_TOLERANCE_DEG = 7.5;

function binPhase(elongationDeg: number): (typeof PHASES)[number] {
  const e = ((elongationDeg % 360) + 360) % 360;
  const near = (target: number) => {
    const d = Math.abs(((e - target + 540) % 360) - 180);
    return d <= PRIMARY_TOLERANCE_DEG;
  };
  if (near(0)) return PHASES[0];
  if (near(90)) return PHASES[2];
  if (near(180)) return PHASES[4];
  if (near(270)) return PHASES[6];
  if (e > 0 && e < 90) return PHASES[1];
  if (e > 90 && e < 180) return PHASES[3];
  if (e > 180 && e < 270) return PHASES[5];
  return PHASES[7];
}

/** Evaluate at UTC noon on the civil date (stable daily cache key). */
function noonUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Moon phase from Astronomy Engine MoonPhase (elongation deg).
 * Primary phases follow USNO: elongation 0/90/180/270°.
 */
export function getMoonPhase(isoDate: string): MoonPhaseInfo {
  const date = noonUtc(isoDate);
  const elongationDeg = Astronomy.MoonPhase(date);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const phase = binPhase(elongationDeg);

  return {
    phase: phase.key,
    phaseZh: phase.zh,
    phaseEn: phase.en,
    blurbZh: phase.blurbZh,
    blurbEn: phase.blurbEn,
    illumination: illum.phase_fraction,
    elongationDeg,
    method: "astronomy_engine_elongation",
    ruleVersion: FORTUNE_RULE_VERSION,
  };
}
