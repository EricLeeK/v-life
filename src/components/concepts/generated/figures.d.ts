export interface CustomFigureDefinition {
  name: string;
  means: string;
  rules: number[];
  range: [number, number, number];
  mount(context: {stage: HTMLElement; svg: SVGSVGElement; read: {textContent: string}}, value: number): {
    set(value: number): void;
    destroy(): void;
  };
}
export default function createFigures(kernel: unknown): Record<string, CustomFigureDefinition>;
