import type { Figure, HairlineOptions } from "@lucasmarkes/hairline";
import type { CustomFigureDefinition } from "./generated/figures";

type Kernel = { inject(root: Document): void };
declare global { interface Window { HL?: Kernel } }

let definitions: Promise<Record<string, CustomFigureDefinition>> | undefined;

/** One unchanged upstream kernel, shared by every custom drawing on the page. */
function loadKernel(): Promise<void> {
  if (window.HL) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${import.meta.env.BASE_URL}hairline/kernel.js`;
    script.async = true;
    script.onload = () => window.HL ? resolve() : reject(new Error("Hairline kernel unavailable"));
    script.onerror = () => { script.remove(); reject(new Error("Hairline kernel could not load")); };
    document.head.append(script);
  });
}

export async function customFigure(name: string) {
  definitions ??= Promise.all([loadKernel(), import("./generated/figures.js")])
    .then(([, { default: createFigures }]) => createFigures(window.HL))
    .catch(error => { definitions = undefined; throw error; });
  const spec = (await definitions)[name];
  if (!spec) throw new Error(`Unknown Hairline figure: ${name}`);

  return (stage: HTMLElement, options: HairlineOptions = {}): Figure => {
    window.HL!.inject(document);
    stage.dataset.hairline = name;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 320");
    svg.setAttribute("aria-hidden", "true");
    stage.append(svg);
    const read = { textContent: "rest" };
    const at = (intensity = .5) => {
      const i = Math.max(0, Math.min(1, intensity));
      const [lo, mid, hi] = spec.range;
      return i <= .5 ? lo + i * 2 * (mid - lo) : mid + (i - .5) * 2 * (hi - mid);
    };
    const handle = spec.mount({ stage, svg, read }, at(options.intensity));
    return {
      update: next => handle.set(at(next.intensity)),
      destroy: () => { handle.destroy(); stage.replaceChildren(); delete stage.dataset.hairline; },
    };
  };
}
