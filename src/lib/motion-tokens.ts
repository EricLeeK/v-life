/** V-Life adaptation layer over the vendored UIArc motion presets.
 *
 * Every value is the upstream token except the deliberate overrides below,
 * which retune how the shared springs feel inside this app. Removing an
 * override restores the upstream value exactly.
 *
 * Override: `spring.smooth` settles a touch quicker (0.34s vs 0.4s
 * visualDuration, still critically damped, bounce 0) so bottom sheets,
 * panel height changes, and layout shifts arrive lighter — same family,
 * no overshoot. */
import { motionTokens as upstream } from "@/vendor/uiarc/registry/motion-tokens";

export const motionTokens = {
  ...upstream,
  spring: {
    ...upstream.spring,
    smooth: { type: "spring", visualDuration: 0.34, bounce: 0 } as const,
    /** Drag-to-reorder feel (SortableList). `dragSettle` springs items into
     * their slots (~0.25s, damping ratio ≈ 0.77 — barely overshoots);
     * `dragFollow` lets the carried item trail the pointer with a slight,
     * hand-like lag. Ripple stagger is 24ms per ripple step, amplitude
     * ×0.7 per step (see SortableEngine). */
    dragSettle: { type: "spring", stiffness: 380, damping: 30 } as const,
    dragFollow: { type: "spring", stiffness: 420, damping: 34 } as const,
  },
};
