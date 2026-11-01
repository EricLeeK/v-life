/**
 * installQuietEscFocus — kill the focus ring that lights up after closing an
 * overlay with Escape.
 *
 * Radix overlays (Dialog, Popover, DropdownMenu, Sheet…) return focus to their
 * trigger on close. A close via Escape is a keyboard interaction, so the
 * browser treats that returned focus as keyboard-initiated and paints the
 * global :focus-visible outline — the flash the user never wants. We mark the
 * Escape and blur whatever receives focus in the following ticks. Typing
 * surfaces (inputs/textareas/selects/contenteditable) are excluded, so
 * dialogs that restore focus into a field keep it, and real Tab navigation
 * (which never follows an Escape) still shows the ring for keyboard users.
 */
export function installQuietEscFocus() {
  if (typeof window === "undefined") return;
  let armedUntil = 0;

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") armedUntil = Date.now() + 200;
    },
    true
  );

  window.addEventListener(
    "focusin",
    () => {
      if (Date.now() > armedUntil) return;
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return;
      const typing =
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable;
      if (!typing) el.blur();
    },
    true
  );
}
