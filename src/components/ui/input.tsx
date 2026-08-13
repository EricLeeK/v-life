import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-2xs placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b88b5]/50 focus-visible:border-[#5b88b5] disabled:cursor-not-allowed disabled:opacity-50 text-xs transition-all",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
