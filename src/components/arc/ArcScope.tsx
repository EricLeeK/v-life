import { forwardRef, type HTMLAttributes } from "react";
import "@/styles/arc-foundation.scoped.css";
import "@/styles/arc-warm.css";

/** Isolates Arc's original color/spacing tokens from V-Life's HSL Tailwind tokens. */
export const ArcScope = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ArcScope({ className = "", ...props }, ref) {
  return <div ref={ref} {...props} className={`arc-runtime ${className}`} />;
});
