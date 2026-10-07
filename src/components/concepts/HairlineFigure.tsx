import { useEffect, useRef } from "react";
import type { Figure } from "@lucasmarkes/hairline";
import { cn } from "@/lib/utils";
import { customFigureNames, type HairlineName } from "./catalog";
import "./concepts.css";

export type { HairlineName } from "./catalog";

/** Decorative, pointer-responsive objects. All meaning and actions remain in HTML. */
export function HairlineFigure({ name, className, surface = "page" }: {
  name: HairlineName;
  className?: string;
  surface?: "page" | "card";
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let figure: Figure | undefined;
    let started = false;
    const mount = async () => {
      if (started) return;
      started = true;
      try {
        const create = customFigureNames.includes(name)
          ? await (await import("./customRuntime")).customFigure(name)
          : (await import("@lucasmarkes/hairline"))[name as Extract<HairlineName, keyof typeof import("@lucasmarkes/hairline")>];
        if (disposed) return;
        figure = create(element, { intensity: 0.5 });
        // Riffle has keyboard navigation in its standalone form. Here the
        // drawing is decoration, so it must not add a hidden focus stop.
        element.tabIndex = -1;
      } catch {
        // A failed optional illustration must never hide the task or its CTA.
        element.dataset.unavailable = "true";
      }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        void mount();
        observer?.disconnect();
      }
    }, { rootMargin: "160px" });
    if (observer) observer.observe(element);
    else void mount();
    return () => {
      disposed = true;
      observer?.disconnect();
      figure?.destroy();
    };
  }, [name]);

  return <div aria-hidden="true" className={cn("concept-figure", `concept-surface-${surface}`, className)} data-concept={name}>
    <div ref={host} />
  </div>;
}
