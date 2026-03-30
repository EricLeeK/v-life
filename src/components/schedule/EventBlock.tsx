import { useRef, useCallback } from "react";
import { format } from "date-fns";

const HOUR_HEIGHT = 60;
const VISIBLE_START = 6;
const VISIBLE_END = 24;
const TOTAL_HOURS = VISIBLE_END - VISIBLE_START;
const SNAP_MINUTES = 15;

const IMPORTANCE_COLORS: Record<string, string> = {
  "紧急": "#ef4444", "重要": "#f59e0b", "普通": "#0ea5e9", "低": "#6b7280"
};

export { HOUR_HEIGHT, VISIBLE_START, VISIBLE_END, TOTAL_HOURS, SNAP_MINUTES, IMPORTANCE_COLORS };

export function timeToY(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - VISIBLE_START) * HOUR_HEIGHT;
}

export function yToTime(y: number, dayDate: Date): Date {
  const totalMinutes = ((y / HOUR_HEIGHT) + VISIBLE_START) * 60;
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  const hours = Math.floor(snapped / 60);
  const minutes = snapped % 60;
  const d = new Date(dayDate);
  d.setHours(Math.max(0, Math.min(23, hours)), Math.min(59, minutes), 0, 0);
  return d;
}

export function EventBlock({ event, onEdit, onDragEnd }: {
  event: any;
  onEdit: (e: any) => void;
  onDragEnd: (id: string, newStart: Date, newEnd: Date) => void;
}) {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const color = event.color || IMPORTANCE_COLORS[event.importance || "普通"] || "#0ea5e9";

  const top = timeToY(startDate);
  const bottom = timeToY(endDate);
  const height = Math.max(bottom - top, HOUR_HEIGHT / 4);

  const dragState = useRef<{ mode: "move" | "resize"; startY: number; origTop: number; origHeight: number; dragged: boolean } | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    dragState.current = { mode, startY: e.clientY, origTop: top, origHeight: height, dragged: false };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current || !blockRef.current) return;
      const dy = ev.clientY - dragState.current.startY;
      if (Math.abs(dy) > 3) dragState.current.dragged = true;
      if (dragState.current.mode === "move") {
        const newTop = Math.max(0, Math.min(TOTAL_HOURS * HOUR_HEIGHT - dragState.current.origHeight, dragState.current.origTop + dy));
        blockRef.current.style.top = `${newTop}px`;
      } else {
        const newHeight = Math.max(HOUR_HEIGHT / 4, dragState.current.origHeight + dy);
        blockRef.current.style.height = `${newHeight}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (!dragState.current) return;
      const wasDragged = dragState.current.dragged;
      const dy = ev.clientY - dragState.current.startY;
      const dayDate = new Date(startDate);
      dayDate.setHours(0, 0, 0, 0);
      if (wasDragged) {
        if (dragState.current.mode === "move") {
          const newTop = Math.max(0, dragState.current.origTop + dy);
          const duration = endDate.getTime() - startDate.getTime();
          const newStart = yToTime(newTop, dayDate);
          const newEnd = new Date(newStart.getTime() + duration);
          onDragEnd(event.id, newStart, newEnd);
        } else {
          const newHeight = Math.max(HOUR_HEIGHT / 4, dragState.current.origHeight + dy);
          const newEnd = yToTime(dragState.current.origTop + newHeight, dayDate);
          onDragEnd(event.id, startDate, newEnd);
        }
      } else if (mode === "move") {
        onEdit(event);
      }
      dragState.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [top, height, startDate, endDate, event.id, onDragEnd, onEdit]);

  return (
    <div
      ref={blockRef}
      className="absolute left-1 right-1 rounded-md cursor-pointer select-none overflow-hidden group"
      style={{
        top: `${top}px`, height: `${height}px`,
        background: color + "25", borderLeft: `3px solid ${color}`, zIndex: 10,
      }}
      onMouseDown={(e) => handleMouseDown(e, "move")}
    >
      <div className="px-1.5 py-0.5 overflow-hidden h-full flex flex-col">
        <span className="text-xs font-medium truncate" style={{ color }}>{event.title}</span>
        <span className="text-[10px] opacity-70" style={{ color }}>
          {format(startDate, "HH:mm")} – {format(endDate, "HH:mm")}
        </span>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: color + "40" }}
        onMouseDown={(e) => handleMouseDown(e, "resize")}
      />
    </div>
  );
}
