/**
 * SortableList — drag-to-reorder with the arc drag feel (see ./engine.ts).
 *
 * Items are rendered in the order given; dragging (from a <SortableHandle>,
 * or Enter/Space + arrow keys on a focused item) reorders locally and commits
 * through onReorder(orderedIds) — persistence is the caller's concern. All
 * motion is transform-only; keyboard and reduced-motion are built in.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { SortableEngine, type SortableAnnounce } from "./engine";
import styles from "./sortable.module.css";

export interface SortableListProps<T> {
  items: T[];
  itemId: (item: T) => string;
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  /** "horizontal" raises the carried item above the row instead of aside. */
  orientation?: "vertical" | "horizontal";
  /** Ripple amplitude in px — 8 for cards, 10 for icons. */
  amplitude?: number;
  disabled?: boolean;
  itemDisabled?: (item: T) => boolean;
  /** Classes for the <ul> (spacing/gap, e.g. "space-y-2" or "flex gap-2.5"). */
  className?: string;
  labelItem?: (item: T) => string;
  ariaLabel?: string;
  /** Lists sharing a group key are connected — items can be dragged across
   *  (e.g. kanban columns). Needs onMoveIn on the receiving list. */
  group?: string;
  onMoveOut?: (itemId: string) => void;
  onMoveIn?: (itemId: string, orderedIds: string[]) => void;
}

/** Pointer drag affordance. Only a handle starts a touch drag, so list
 *  scrolling keeps working on mobile; mouse/keyboard users get the same
 *  interaction through the handle / the item itself. */
export function SortableHandle({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <span
      data-sortable-handle
      aria-hidden="true"
      className={className ?? "shrink-0 inline-flex items-center p-0.5 text-muted-foreground/40 hover:text-muted-foreground"}
    >
      {children ?? <GripVertical className="h-3.5 w-3.5 pointer-events-none" />}
    </span>
  );
}

function announceText(e: SortableAnnounce, t: (zh: string, en: string) => string): string {
  switch (e.type) {
    case "picked":
      return t(`已拾起「${e.title}」`, `Picked up “${e.title}”`);
    case "moved":
      return t(`移到第 ${e.pos} 位`, `Moved to position ${e.pos}`);
    case "dropped":
      return t(`已放到第 ${e.pos} 位`, `Placed at position ${e.pos}`);
    case "cancelled":
      return t("已放回原位", "Returned to the original position");
  }
}

export function SortableList<T>({
  items,
  itemId,
  onReorder,
  renderItem,
  orientation = "vertical",
  amplitude = 8,
  disabled = false,
  itemDisabled,
  className,
  labelItem,
  ariaLabel,
  group,
  onMoveOut,
  onMoveIn,
}: SortableListProps<T>) {
  const { t } = useLang();
  const listRef = useRef<HTMLUListElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SortableEngine | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const cbRef = useRef({ onReorder, itemId, labelItem, onMoveOut, onMoveIn });
  cbRef.current = { onReorder, itemId, labelItem, onMoveOut, onMoveIn };

  useLayoutEffect(() => {
    const engine = new SortableEngine(listRef.current!, {
      vertical: orientation === "vertical",
      amplitude,
      group,
      onCommit: (ids) => cbRef.current.onReorder(ids),
      onMoveOut: (id) => cbRef.current.onMoveOut?.(id),
      onMoveIn: (id, ids) => cbRef.current.onMoveIn?.(id, ids),
      labelOf: (id) => {
        const { itemId: idOf, labelItem: label } = cbRef.current;
        const item = itemsRef.current.find((x) => idOf(x) === id);
        return item != null && label ? label(item) : "";
      },
      announce: (e) => {
        if (liveRef.current) liveRef.current.textContent = announceText(e, t);
      },
    });
    engineRef.current = engine;
    engine.setDisabled(disabled);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation, amplitude, group]);

  // After React re-orders (onReorder → state update), arm the FLIP springs.
  useLayoutEffect(() => {
    engineRef.current?.afterCommit();
  });

  useEffect(() => {
    engineRef.current?.setDisabled(disabled);
  }, [disabled]);

  const rootClass = [styles.list, orientation === "horizontal" ? styles.horiz : "", disabled ? styles.disabled : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <ul ref={listRef} className={rootClass} aria-label={ariaLabel}>
      {items.map((item, i) => {
        const id = itemId(item);
        return (
          <li
            key={id}
            data-sortable-id={id}
            data-sortable-disabled={itemDisabled?.(item) || undefined}
            tabIndex={disabled || itemDisabled?.(item) ? -1 : 0}
            className={styles.item}
            aria-roledescription={t("可排序项", "sortable item")}
            aria-label={labelItem ? labelItem(item) : undefined}
          >
            <div className={styles.inner}>{renderItem(item, i)}</div>
          </li>
        );
      })}
      <div data-sortable-line className={styles.line} aria-hidden="true">
        <i />
      </div>
      <div ref={liveRef} className="sr-only" role="status" aria-live="assertive" />
    </ul>
  );
}
