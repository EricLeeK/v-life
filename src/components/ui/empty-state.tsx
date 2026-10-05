import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** Optional primary action, e.g. the create button for this list. */
  action?: ReactNode;
  className?: string;
}

/** One quiet pattern for empty lists and filtered-to-zero moments across the app. */
export function EmptyState({ icon: Icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className ?? ""}`}>
      <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-card text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
