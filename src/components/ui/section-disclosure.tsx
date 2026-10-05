import { useId, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motionTokens } from "@/lib/motion-tokens";

interface SectionDisclosureProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expandLabel: string;
  collapseLabel: string;
  actionLabel?: string;
  count?: number;
  children: ReactNode;
}

function DisclosurePanel({ id, children }: { id: string; children: ReactNode }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return (
    <motion.div id={`${id}-panel`} role="region" aria-labelledby={`${id}-heading`} aria-hidden={!present} inert={!present} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: present ? .2 : .12 } }} className="overflow-hidden">
      <div className="pt-4 pb-1 px-px">{children}</div>
    </motion.div>
  );
}

/** A section keeps its heading in place while the content opens beneath it. */
export function SectionDisclosure({ title, open, onOpenChange, expandLabel, collapseLabel, actionLabel, count, children }: SectionDisclosureProps) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={`${id}-heading`} className="type-section-title heading-font">{title}</h2>
        <Button type="button" variant="outline" aria-expanded={open} aria-controls={`${id}-panel`} aria-label={actionLabel} className="min-h-11 shrink-0 px-3" onClick={() => onOpenChange(!open)}>
          <span>{open ? collapseLabel : expandLabel}</span>
          {count !== undefined && <span className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono-data text-xs text-muted-foreground">{count}</span>}
          <motion.span aria-hidden="true" initial={false} animate={{ rotate: open ? 180 : 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.responsive}><ChevronDown className="h-4 w-4" /></motion.span>
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <DisclosurePanel key="panel" id={id}>{children}</DisclosurePanel>
        )}
      </AnimatePresence>
    </section>
  );
}
