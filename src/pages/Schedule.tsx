import { useState, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useScheduleByRange, scheduleHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";

const HOUR_HEIGHT = 60; // pixels per hour
const IMPORTANCE_COLORS: Record<string, string> = {
  "紧急": "#ef4444", "重要": "#f59e0b", "普通": "#0ea5e9", "低": "#6b7280"
};
const STATUS_OPTIONS = ["未开始", "进行中", "已完成", "已取消"];
const VISIBLE_START = 6; // show from 6:00
const VISIBLE_END = 23;  // to 23:00
const TOTAL_HOURS = VISIBLE_END - VISIBLE_START;
const SNAP_MINUTES = 15; // snap to 15-minute intervals

function timeToY(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - VISIBLE_START) * HOUR_HEIGHT;
}

function yToTime(y: number, dayDate: Date): Date {
  const totalMinutes = ((y / HOUR_HEIGHT) + VISIBLE_START) * 60;
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  const hours = Math.floor(snapped / 60);
  const minutes = snapped % 60;
  const d = new Date(dayDate);
  d.setHours(Math.max(0, Math.min(23, hours)), Math.min(59, minutes), 0, 0);
  return d;
}

function formatTimeShort(date: Date) {
  return format(date, "HH:mm");
}

// ===== Event Block Component =====
function EventBlock({ event, onEdit, onDragEnd }: {
  event: any;
  onEdit: (e: any) => void;
  onDragEnd: (id: string, newStart: Date, newEnd: Date) => void;
}) {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const color = event.color || IMPORTANCE_COLORS[event.importance || "普通"] || "#0ea5e9";

  const top = timeToY(startDate);
  const bottom = timeToY(endDate);
  const height = Math.max(bottom - top, HOUR_HEIGHT / 4); // min 15 min block

  const dragState = useRef<{ mode: "move" | "resize"; startY: number; origTop: number; origHeight: number } | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    const container = blockRef.current?.closest(".schedule-day-column") as HTMLElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    dragState.current = {
      mode,
      startY: e.clientY,
      origTop: top,
      origHeight: height,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current || !blockRef.current) return;
      const dy = ev.clientY - dragState.current.startY;
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
      if (!dragState.current || !blockRef.current) return;
      const dy = ev.clientY - dragState.current.startY;
      const dayDate = new Date(startDate);
      dayDate.setHours(0, 0, 0, 0);

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
      dragState.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [top, height, startDate, endDate, event.id, onDragEnd]);

  return (
    <div
      ref={blockRef}
      className="absolute left-1 right-1 rounded-md cursor-pointer select-none overflow-hidden group"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        background: color + "25",
        borderLeft: `3px solid ${color}`,
        zIndex: 10,
      }}
      onMouseDown={(e) => handleMouseDown(e, "move")}
      onClick={(e) => { e.stopPropagation(); onEdit(event); }}
    >
      <div className="px-1.5 py-0.5 overflow-hidden h-full flex flex-col">
        <span className="text-xs font-medium truncate" style={{ color }}>{event.title}</span>
        <span className="text-[10px] opacity-70" style={{ color }}>
          {formatTimeShort(startDate)} – {formatTimeShort(endDate)}
        </span>
      </div>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: color + "40" }}
        onMouseDown={(e) => handleMouseDown(e, "resize")}
      />
    </div>
  );
}

// ===== Day Column Component =====
function DayColumn({ day, events, onEdit, onDragEnd, onCreateAt }: {
  day: Date;
  events: any[];
  onEdit: (e: any) => void;
  onDragEnd: (id: string, newStart: Date, newEnd: Date) => void;
  onCreateAt: (start: Date, end: Date) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const dragCreate = useRef<{ startY: number; indicator: HTMLDivElement | null } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const col = colRef.current;
    if (!col) return;
    const rect = col.getBoundingClientRect();
    const y = e.clientY - rect.top + col.scrollTop;

    // Create visual indicator
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

      if (dragCreate.current.indicator) {
        col.removeChild(dragCreate.current.indicator);
      }
      dragCreate.current = null;

      // Only create if dragged at least a bit
      if (bottomY - topY > 5) {
        const dayBase = new Date(day);
        dayBase.setHours(0, 0, 0, 0);
        const start = yToTime(topY, dayBase);
        const end = yToTime(bottomY, dayBase);
        if (end.getTime() - start.getTime() < 15 * 60 * 1000) {
          end.setTime(start.getTime() + 60 * 60 * 1000); // default 1 hour
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
      className="schedule-day-column border-l border-border/50 relative"
      style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
      onMouseDown={handleMouseDown}
    >
      {/* Half-hour gridlines */}
      {Array.from({ length: TOTAL_HOURS * 2 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-b"
          style={{
            top: `${i * (HOUR_HEIGHT / 2)}px`,
            borderColor: i % 2 === 0 ? "hsl(var(--border))" : "hsl(var(--border) / 0.3)",
          }}
        />
      ))}
      {events.map((event) => (
        <EventBlock key={event.id} event={event} onEdit={onEdit} onDragEnd={onDragEnd} />
      ))}
    </div>
  );
}

// ===== Current Time Indicator =====
function NowIndicator({ days }: { days: Date[] }) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const dayIndex = days.findIndex((d) => format(d, "yyyy-MM-dd") === todayStr);
  if (dayIndex === -1) return null;

  const y = timeToY(now);
  if (y < 0 || y > TOTAL_HOURS * HOUR_HEIGHT) return null;

  // Position within grid: skip the time gutter (50px), then offset by column
  const colPercent = 100 / days.length;
  const left = `calc(50px + ${dayIndex * colPercent}% * (100% - 50px) / 100%)`;

  return null; // Simplified: we'll use a different approach
}

// ===== Main Component =====
export default function SchedulePage() {
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", start_date: "", start_time: "09:00", end_date: "", end_time: "10:00",
    importance: "普通", status: "未开始", color: "", notes: ""
  });
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => [baseDate, addDays(baseDate, 1), addDays(baseDate, 2)], [baseDate]);
  const rangeStart = useMemo(() => { const d = new Date(days[0]); d.setHours(0, 0, 0, 0); return d; }, [days]);
  const rangeEnd = useMemo(() => { const d = new Date(days[2]); d.setHours(23, 59, 59, 999); return d; }, [days]);

  const { data: events = [] } = useScheduleByRange(rangeStart, rangeEnd);
  const createMutation = scheduleHooks.useCreate();
  const updateMutation = scheduleHooks.useUpdate();
  const deleteMutation = scheduleHooks.useDelete();

  const getEventsForDay = useCallback((day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((e: any) => format(new Date(e.start_time), "yyyy-MM-dd") === dayStr);
  }, [events]);

  const resetForm = useCallback(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    setForm({ title: "", start_date: today, start_time: "09:00", end_date: today, end_time: "10:00", importance: "普通", status: "未开始", color: "", notes: "" });
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.start_date || !form.end_date) {
      toast({ title: "请填写标题和时间", variant: "destructive" }); return;
    }
    try {
      const startTime = new Date(`${form.start_date}T${form.start_time}:00`);
      const endTime = new Date(`${form.end_date}T${form.end_time}:00`);
      const payload = {
        title: form.title, start_time: startTime.toISOString(), end_time: endTime.toISOString(),
        importance: form.importance, status: form.status, color: form.color || null, notes: form.notes || null
      };
      if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      else await createMutation.mutateAsync(payload);
      setDialogOpen(false); setEditingItem(null); resetForm();
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const openEdit = useCallback((event: any) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    setEditingItem(event);
    setForm({
      title: event.title, start_date: format(start, "yyyy-MM-dd"), start_time: format(start, "HH:mm"),
      end_date: format(end, "yyyy-MM-dd"), end_time: format(end, "HH:mm"),
      importance: event.importance || "普通", status: event.status, color: event.color || "", notes: event.notes || ""
    });
    setDialogOpen(true);
  }, []);

  const handleDragEnd = useCallback((id: string, newStart: Date, newEnd: Date) => {
    updateMutation.mutate({ id, start_time: newStart.toISOString(), end_time: newEnd.toISOString() });
  }, [updateMutation]);

  const handleCreateAt = useCallback((start: Date, end: Date) => {
    setEditingItem(null);
    setForm({
      title: "", start_date: format(start, "yyyy-MM-dd"), start_time: format(start, "HH:mm"),
      end_date: format(end, "yyyy-MM-dd"), end_time: format(end, "HH:mm"),
      importance: "普通", status: "未开始", color: "", notes: ""
    });
    setDialogOpen(true);
  }, []);

  // 7-day navigation
  const navDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(subDays(new Date(), 1), i)), []);

  // Current time line Y
  const now = new Date();
  const nowY = timeToY(now);
  const todayStr = format(now, "yyyy-MM-dd");
  const todayDayIndex = days.findIndex((d) => format(d, "yyyy-MM-dd") === todayStr);

  // Auto-scroll to ~8am on mount
  const hasScrolled = useRef(false);
  if (scrollRef.current && !hasScrolled.current) {
    scrollRef.current.scrollTop = (8 - VISIBLE_START) * HOUR_HEIGHT - 20;
    hasScrolled.current = true;
  }

  return (
    <AppLayout title="日程计划">
      <div className="space-y-4">
        {/* Navigation bar */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBaseDate(subDays(baseDate, 3))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-1 overflow-x-auto">
            {navDays.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const isSelected = days.some((day) => format(day, "yyyy-MM-dd") === dateStr);
              const isToday = dateStr === todayStr;
              return (
                <Button key={dateStr} variant={isSelected ? "default" : "secondary"} size="sm"
                  className={`shrink-0 min-w-[52px] ${isToday && !isSelected ? "border border-primary" : ""}`}
                  onClick={() => setBaseDate(d)}>
                  <div className="text-center">
                    <div className="text-[10px]">{format(d, "EEE", { locale: zhCN })}</div>
                    <div className="text-xs">{format(d, "dd")}</div>
                  </div>
                </Button>
              );
            })}
          </div>
          <Button variant="secondary" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBaseDate(addDays(baseDate, 3))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingItem(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0" onClick={resetForm}><Plus className="h-4 w-4 mr-1" />新建</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingItem ? "编辑事件" : "新建事件"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>标题 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>开始日期 *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value })} /></div>
                  <div><Label>开始时间</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>结束日期 *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  <div><Label>结束时间</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>重要性</Label>
                    <Select value={form.importance} onValueChange={(v) => setForm({ ...form, importance: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(IMPORTANCE_COLORS).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>状态</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>备注</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">保存</Button>
                  {editingItem && (
                    <Button variant="destructive" size="icon" onClick={async () => {
                      await deleteMutation.mutateAsync(editingItem.id);
                      setDialogOpen(false); setEditingItem(null); resetForm();
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Calendar grid */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-[50px_1fr_1fr_1fr] border-b border-border bg-card">
            <div className="p-2 text-xs text-muted-foreground" />
            {days.map((d) => {
              const isToday = format(d, "yyyy-MM-dd") === todayStr;
              return (
                <div key={d.toISOString()} className="p-2 text-center border-l border-border">
                  <div className="text-xs text-muted-foreground">{format(d, "EEE", { locale: zhCN })}</div>
                  <div className={`text-sm font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto" : ""}`}>
                    {format(d, "dd")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={scrollRef} className="max-h-[calc(100vh-220px)] overflow-y-auto relative">
            <div className="grid grid-cols-[50px_1fr_1fr_1fr]" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
              {/* Time gutter */}
              <div className="relative">
                {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                  <div key={i} className="absolute right-2 text-[10px] text-muted-foreground leading-none" style={{ top: `${i * HOUR_HEIGHT - 5}px` }}>
                    {i + VISIBLE_START > 0 ? `${String(i + VISIBLE_START).padStart(2, "0")}:00` : ""}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => (
                <DayColumn
                  key={day.toISOString()}
                  day={day}
                  events={getEventsForDay(day)}
                  onEdit={openEdit}
                  onDragEnd={handleDragEnd}
                  onCreateAt={handleCreateAt}
                />
              ))}

              {/* Current time line */}
              {todayDayIndex >= 0 && nowY >= 0 && nowY <= TOTAL_HOURS * HOUR_HEIGHT && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: `${nowY}px`,
                    left: "50px",
                    right: 0,
                    zIndex: 20,
                  }}
                >
                  <div className="relative w-full">
                    {/* Red dot + line spanning only the today column */}
                    <div
                      className="absolute h-[2px] bg-destructive"
                      style={{
                        left: `${(todayDayIndex / days.length) * 100}%`,
                        width: `${100 / days.length}%`,
                      }}
                    >
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-destructive" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
