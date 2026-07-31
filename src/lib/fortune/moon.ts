import { hashStringToSeed, mulberry32 } from "./seededRandom";

export interface MoonPhaseInfo {
  phase: string;
  phaseZh: string;
  phaseEn: string;
  blurbZh: string;
  blurbEn: string;
  illumination: number;
}

const PHASES: Array<{
  key: string;
  zh: string;
  en: string;
  blurbZh: string;
  blurbEn: string;
  min: number;
  max: number;
}> = [
  { key: "new", zh: "新月", en: "New Moon", blurbZh: "适合轻轻种下一个小想法。", blurbEn: "A gentle moment to plant a small idea.", min: 0, max: 0.03 },
  { key: "waxing_crescent", zh: "蛾眉月", en: "Waxing Crescent", blurbZh: "适合播种想法，一步一步来。", blurbEn: "Good for starting small and building.", min: 0.03, max: 0.22 },
  { key: "first_quarter", zh: "上弦月", en: "First Quarter", blurbZh: "适合推进一件卡住的小事。", blurbEn: "Push one stuck task forward.", min: 0.22, max: 0.28 },
  { key: "waxing_gibbous", zh: "盈凸月", en: "Waxing Gibbous", blurbZh: "接近完成，收个尾会很爽。", blurbEn: "Almost there—finish something.", min: 0.28, max: 0.47 },
  { key: "full", zh: "满月", en: "Full Moon", blurbZh: "适合表达与庆祝小小进步。", blurbEn: "Share and celebrate small wins.", min: 0.47, max: 0.53 },
  { key: "waning_gibbous", zh: "亏凸月", en: "Waning Gibbous", blurbZh: "适合复盘，把心得记下来。", blurbEn: "Reflect and jot a short note.", min: 0.53, max: 0.72 },
  { key: "last_quarter", zh: "下弦月", en: "Last Quarter", blurbZh: "适合放下多余负担。", blurbEn: "Let go of one extra burden.", min: 0.72, max: 0.78 },
  { key: "waning_crescent", zh: "残月", en: "Waning Crescent", blurbZh: "适合休息，给自己留白。", blurbEn: "Rest and leave some whitespace.", min: 0.78, max: 1.01 },
];

/** Approximate synodic phase from known new moon epoch. */
export function getMoonPhase(isoDate: string): MoonPhaseInfo {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const knownNew = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodic = 29.530588853 * 24 * 3600 * 1000;
  const age = ((date.getTime() - knownNew) % synodic + synodic) % synodic;
  const cycle = age / synodic; // 0..1
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * cycle));

  const phase =
    PHASES.find((p) => cycle >= p.min && cycle < p.max) ||
    PHASES[PHASES.length - 1];

  // tiny flavor variation
  const rng = mulberry32(hashStringToSeed(`moon:${isoDate}`));
  void rng;

  return {
    phase: phase.key,
    phaseZh: phase.zh,
    phaseEn: phase.en,
    blurbZh: phase.blurbZh,
    blurbEn: phase.blurbEn,
    illumination,
  };
}
