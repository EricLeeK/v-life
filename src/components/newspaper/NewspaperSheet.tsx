import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Right-hand desk drawer; portaled outside the immersive reader so Escape closes only the sheet. */
export function NewspaperSheet(
  { open, onOpenChange, title, description, children, footer }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
  },
) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="np-sheet-backdrop" />
        <DialogPrimitive.Content
          className="np-sheet np-scope"
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="np-sheet-header">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="np-icon-button np-icon-quiet" aria-label="关闭">
              <X size={18} />
            </DialogPrimitive.Close>
          </header>
          <div className="np-sheet-body">{children}</div>
          {footer && <footer className="np-sheet-footer">{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
