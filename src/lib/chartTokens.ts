/** Chart/category colors from CSS design tokens (HSL components on :root). */
export function tokenColor(cssVar: string): string {
  if (typeof document === "undefined") {
    return `hsl(var(${cssVar}))`;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return raw ? `hsl(${raw})` : `hsl(var(${cssVar}))`;
}

export const chartColors = {
  1: () => tokenColor("--chart-1"),
  2: () => tokenColor("--chart-2"),
  3: () => tokenColor("--chart-3"),
  4: () => tokenColor("--chart-4"),
  5: () => tokenColor("--chart-5"),
};

/** Semantic aliases used by finance/calorie charts */
export const chartPalette = {
  orange: () => tokenColor("--cat-orange"),
  teal: () => tokenColor("--cat-teal"),
  purple: () => tokenColor("--cat-purple"),
  green: () => tokenColor("--cat-green"),
  yellow: () => tokenColor("--cat-yellow"),
  blue: () => tokenColor("--cat-blue"),
};

export function piePalette(): string[] {
  return [
    chartPalette.orange(),
    chartPalette.teal(),
    chartPalette.purple(),
    chartPalette.green(),
    chartPalette.yellow(),
    chartPalette.blue(),
  ];
}
