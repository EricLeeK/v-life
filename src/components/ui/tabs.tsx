import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion-tokens";

const TabsValue = React.createContext<string | undefined>(undefined);

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [localValue, setLocalValue] = React.useState(defaultValue);
  const selected = value ?? localValue;
  return (
    <TabsValue.Provider value={selected}>
      <TabsPrimitive.Root ref={ref} {...props} value={selected} onValueChange={(next) => {
        if (value === undefined) setLocalValue(next);
        onValueChange?.(next);
      }} />
    </TabsValue.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const groupId = React.useId();
  return (
    <LayoutGroup id={groupId}>
      <TabsPrimitive.List
        ref={ref}
        className={cn("paper-tabs relative isolate inline-flex h-10 items-center justify-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground", className)}
        {...props}
      />
    </LayoutGroup>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const selected = React.useContext(TabsValue);
  const reduced = useReducedMotion();
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn("paper-tab relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors data-[state=active]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", className)}
      {...props}
    >
      {selected === value && (
        <motion.span aria-hidden="true" className="paper-tab-surface absolute inset-0 z-0 rounded-[inherit]" layoutId="tab-surface" transition={reduced ? { duration: 0 } : motionTokens.spring.responsive} />
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
