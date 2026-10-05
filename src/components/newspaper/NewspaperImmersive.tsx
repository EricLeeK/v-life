import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cancelPaperFlight, unfoldPaper, visiblePaperRect, type PaperRect } from "./paperFlight";

export type NewspaperOrigin = PaperRect;

export interface NewspaperFlight {
  from: PaperRect | null;
  cover?: HTMLElement | null;
}

export function NewspaperImmersive(
  { children, flight, onFlightDone }: {
    children: React.ReactNode;
    /** When set, the paper is drawn out of this slot and unfolded before the print appears. */
    flight: NewspaperFlight | null;
    onFlightDone?: () => void;
  },
) {
  const ref = useRef<HTMLDivElement>(null);
  const flown = useRef(false);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const previousInert = appRoot?.inert;
    document.body.style.overflow = "hidden";
    document.body.classList.add("np-immersive-open");
    if (appRoot) appRoot.inert = true;
    panel.querySelector<HTMLElement>("[data-newspaper-back]")?.focus({ preventScroll: true });
    return () => {
      const paper = panel.querySelector<HTMLElement>(".np-paper");
      if (paper) cancelPaperFlight(paper);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("np-immersive-open");
      if (appRoot) appRoot.inert = previousInert || false;
    };
  }, []);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel || !flight || flown.current) return;
    const paper = panel.querySelector<HTMLElement>(".np-paper");
    const open = visiblePaperRect(paper);
    if (!paper || !open) return;
    flown.current = true;
    panel.dataset.flight = "unfolding";
    void unfoldPaper({ from: flight.from, cover: flight.cover, paper, open, desk: panel }).finally(() => {
      if (panel.dataset.flight === "unfolding") delete panel.dataset.flight;
      onFlightDone?.();
    });
  });

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!panel.contains(event.target as Node)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        panel.querySelector<HTMLButtonElement>("[data-newspaper-back]")?.click();
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
