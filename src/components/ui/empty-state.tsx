import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HairlineFigure, type HairlineName } from "@/components/concepts/HairlineFigure";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  figure?: HairlineName;
  compact?: boolean;
  surface?: "page" | "card";
  title: string;
  hint?: string;
  /** Optional primary action, e.g. the create button for this list. */
  action?: ReactNode;
  className?: string;
}

/** One quiet pattern for empty lists and filtered-to-zero moments across the app. */
export function EmptyState({ icon: Icon, figure, compact, surface, title, hint, action, className }: EmptyStateProps) {
  if (figure) return <div className={cn("concept-empty concept-entry", compact && "concept-empty-compact", className)}>
    <HairlineFigure name={figure} surface={surface} className="concept-empty-art" />
    <div className="concept-empty-copy">
      <p className="concept-empty-title heading-font">{title}</p>
      {hint && <p className="concept-empty-hint">{hint}</p>}
      {action && <div className="concept-empty-action">{action}</div>}
    </div>
  </div>;
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className ?? ""}`}>
      {Icon && <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-card text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
