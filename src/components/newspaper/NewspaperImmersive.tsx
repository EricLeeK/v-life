import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface NewspaperOrigin {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function NewspaperImmersive(
  { children, origin, useNativeTransition }: {
    children: React.ReactNode;
    origin: NewspaperOrigin | null;
    useNativeTransition: boolean;
  },
) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const previousInert = appRoot?.inert;
    document.body.style.overflow = "hidden";
    document.body.classList.add("np-immersive-open");
    if (appRoot) appRoot.inert = true;
    panel.querySelector<HTMLElement>("[data-newspaper-back]")?.focus({
      preventScroll: true,
    });
    if (
      !useNativeTransition && origin &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const paper = panel.querySelector<HTMLElement>(".np-paper");
      if (paper?.animate) {
        const rect = paper.getBoundingClientRect();
        const sx = origin.width / rect.width;
        const sy = origin.height /
          Math.min(rect.height, window.innerHeight - 80);
        paper.animate([{
          transform: `translate(${origin.left - rect.left}px,${
            origin.top - rect.top
          }px) scale(${sx},${sy})`,
          clipPath: "inset(42% 0 42% 0)",
          opacity: .7,
        }, { transform: "none", clipPath: "inset(0)", opacity: 1 }], {
          duration: 760,
          easing: "cubic-bezier(.16,1,.3,1)",
        });
      }
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("np-immersive-open");
      if (appRoot) appRoot.inert = previousInert || false;
    };
  }, [origin, useNativeTransition]);
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!panel.contains(event.target as Node)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        panel.querySelector<HTMLButtonElement>("[data-newspaper-back]")
          ?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const all = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = all[0], last = all[all.length - 1];
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, []);
  return createPortal(
    <div
      ref={ref}
      className="np-immersive np-scope"
      role="dialog"
      aria-modal="true"
      aria-label="生活日报沉浸阅读"
    >
      <div className="np-immersive-desk">{children}</div>
    </div>,
    document.body,
  );
}
