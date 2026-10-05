import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
export function DialogContent(
  { className, children, ...props }: ComponentProps<
    typeof DialogPrimitive.Content
  >,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="np-dialog-backdrop" />
      <DialogPrimitive.Content
        className={cn("np-dialog-content", className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="np-dialog-close" aria-label="关闭">
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
