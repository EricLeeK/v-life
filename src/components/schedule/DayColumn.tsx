import { useRef, useCallback } from "react";
import { EventBlock, HOUR_HEIGHT, TOTAL_HOURS, yToTime } from "./EventBlock";

export function DayColumn({ day, events, onEdit, onDragEnd, onCreateAt, isToday }: {
  day: Date;
  events: any[];
  onEdit: (e: any) => void;
  onDragEnd: (id: string, newStart: Date, newEnd: Date) => void;
  onCreateAt: (start: Date, end: Date) => void;
  isToday?: boolean;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const dragCreate = useRef<{ startY: number; indicator: HTMLDivElement | null } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const col = colRef.current;
    if (!col) return;
    const rect = col.getBoundingClientRect();
    const y = e.clientY - rect.top + col.scrollTop;

    const indicator = document.createElement("div");
    indicator.className = "absolute left-1 right-1 rounded-md pointer-events-none";
    indicator.style.cssText = `background: hsl(var(--primary) / 0.15); border: 1px dashed hsl(var(--primary)); z-index: 5;`;
    indicator.style.top = `${y}px`;
    indicator.style.height = `${HOUR_HEIGHT}px`;
    col.appendChild(indicator);
    dragCreate.current = { startY: y, indicator };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragCreate.current?.indicator || !col) return;
      const rect2 = col.getBoundingClientRect();
      const currentY = ev.clientY - rect2.top + col.scrollTop;
      const topY = Math.min(dragCreate.current.startY, currentY);
      const bottomY = Math.max(dragCreate.current.startY, currentY);
      dragCreate.current.indicator.style.top = `${topY}px`;
      dragCreate.current.indicator.style.height = `${Math.max(HOUR_HEIGHT / 4, bottomY - topY)}px`;
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (!dragCreate.current || !col) return;
      const rect2 = col.getBoundingClientRect();
      const endY = ev.clientY - rect2.top + col.scrollTop;
      const topY = Math.min(dragCreate.current.startY, endY);
      const bottomY = Math.max(dragCreate.current.startY, endY);
      if (dragCreate.current.indicator) col.removeChild(dragCreate.current.indicator);
      dragCreate.current = null;
      if (bottomY - topY > 5) {
        const dayBase = new Date(day);
        dayBase.setHours(0, 0, 0, 0);
        const start = yToTime(topY, dayBase);
        const end = yToTime(bottomY, dayBase);
        if (end.getTime() - start.getTime() < 15 * 60 * 1000) {
          end.setTime(start.getTime() + 60 * 60 * 1000);
        }
        onCreateAt(start, end);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [day, onCreateAt]);

  return (
    <div
      ref={colRef}
      className={`schedule-day-column border-l relative ${isToday ? "bg-[#f0ede6]" : "border-[#e4e1d7]/50"}`}
      style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
      onMouseDown={handleMouseDown}
    >
      {Array.from({ length: TOTAL_HOURS * 2 }).map((_, i) => (
        <div key={i} className="absolute left-0 right-0 border-b"
          style={{
            top: `${i * (HOUR_HEIGHT / 2)}px`,
            borderColor: i % 2 === 0 ? "hsl(var(--border))" : "hsl(var(--border) / 0.3)",
          }} />
      ))}
      {events.map((event) => (
        <EventBlock key={event.id} event={event} onEdit={onEdit} onDragEnd={onDragEnd} />
      ))}
    </div>
  );
}
