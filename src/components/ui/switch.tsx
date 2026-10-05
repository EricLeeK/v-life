import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion-tokens";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const [localChecked, setLocalChecked] = React.useState(defaultChecked ?? false);
  const selected = checked ?? localChecked;
  const reduced = useReducedMotion();
  return <SwitchPrimitives.Root
    className={cn(
      "paper-switch peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
    checked={selected}
    onCheckedChange={(next) => {
      if (checked === undefined) setLocalChecked(next);
      onCheckedChange?.(next);
    }}
  >
    <SwitchPrimitives.Thumb asChild>
      <motion.span initial={false} animate={{ x: selected ? 20 : 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.responsive} className="paper-switch-thumb pointer-events-none block h-5 w-5 rounded-full bg-card ring-0" />
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>;
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
