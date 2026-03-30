import { useState, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useScheduleByRange, scheduleHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, differenceInWeeks, differenceInMonths, isBefore, isAfter } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DayColumn } from "@/components/schedule/DayColumn";
import { MonthView } from "@/components/schedule/MonthView";
import { HOUR_HEIGHT, VISIBLE_START, TOTAL_HOURS, IMPORTANCE_COLORS, timeToY } from "@/components/schedule/EventBlock";

const STATUS_OPTIONS = ["未开始", "进行中", "已完成", "已取消"];
type ViewMode = "3day" | "week" | "month";

export default function SchedulePage() {
  const [baseDate, setBaseDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [viewMode, setViewMode] = useState<ViewMode>("3day");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", start_date: "", start_time: "09:00", end_date: "", end_time: "10:00",
    importance: "普通", status: "未开始", color: "", notes: "",
    recurrence_type: "none" as string, recurrence_end_date: "", recurrence_days: [] as number[],
  });
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    if (viewMode === "3day") return [baseDate, addDays(baseDate, 1), addDays(baseDate, 2)];
    if (viewMode === "week") {
      const start = startOfWeek(baseDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return []; // month view doesn't use days columns
  }, [baseDate, viewMode]);

  const rangeStart = useMemo(() => {
    if (viewMode === "month") { const d = startOfMonth(baseDate); d.setHours(0, 0, 0, 0); return d; }
    const d = new Date(days[0]); d.setHours(0, 0, 0, 0); return d;
  }, [days, viewMode, baseDate]);

  const rangeEnd = useMemo(() => {
    if (viewMode === "month") { const d = endOfMonth(baseDate); d.setHours(23, 59, 59, 999); return d; }
    const d = new Date(days[days.length - 1]); d.setHours(23, 59, 59, 999); return d;
  }, [days, viewMode, baseDate]);

  const { data: events = [] } = useScheduleByRange(rangeStart, rangeEnd);
  const createMutation = scheduleHooks.useCreate();
  const updateMutation = scheduleHooks.useUpdate();
  const deleteMutation = scheduleHooks.useDelete();

  // Expand recurring events into virtual instances for display
  const expandedEvents = useMemo(() => {
    const result: any[] = [];
    events.forEach((event: any) => {
      result.push(event);
      const rec = event.recurrence as any;
      if (!rec || rec.type === "none") return;
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const duration = eventEnd.getTime() - eventStart.getTime();
      const recEndDate = rec.end_date ? new Date(rec.end_date) : rangeEnd;
      const maxEnd = new Date(Math.min(recEndDate.getTime(), rangeEnd.getTime()));

      let current = new Date(eventStart);
      for (let i = 0; i < 200; i++) {
        if (rec.type === "daily") current = addDays(current, rec.interval || 1);
        else if (rec.type === "weekly") current = addDays(current, 7 * (rec.interval || 1));
        else if (rec.type === "monthly") {
          current = new Date(current);
          current.setMonth(current.getMonth() + (rec.interval || 1));
        } else break;

        if (isAfter(current, maxEnd)) break;
        if (isBefore(current, rangeStart)) continue;

        // For weekly with specific days
        if (rec.type === "weekly" && rec.days_of_week?.length > 0) {
          const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
          if (!rec.days_of_week.includes(dayOfWeek)) continue;
        }

        const virtualStart = new Date(current);
        virtualStart.setHours(eventStart.getHours(), eventStart.getMinutes(), 0, 0);
        const virtualEnd = new Date(virtualStart.getTime() + duration);

        result.push({
          ...event,
          id: `${event.id}_rec_${i}`,
          start_time: virtualStart.toISOString(),
          end_time: virtualEnd.toISOString(),
          _isRecurrenceInstance: true,
          _parentId: event.id,
        });
      }
    });
    return result;
  }, [events, rangeStart, rangeEnd]);

  const getEventsForDay = useCallback((day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return expandedEvents.filter((e: any) => format(new Date(e.start_time), "yyyy-MM-dd") === dayStr);
  }, [expandedEvents]);

  const resetForm = useCallback(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    setForm({ title: "", start_date: today, start_time: "09:00", end_date: today, end_time: "10:00", importance: "普通", status: "未开始", color: "", notes: "", recurrence_type: "none", recurrence_end_date: "", recurrence_days: [] });
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.start_date || !form.end_date) {
      toast({ title: "请填写标题和时间", variant: "destructive" }); return;
    }
    try {
      const startTime = new Date(`${form.start_date}T${form.start_time}:00`);
      const endTime = new Date(`${form.end_date}T${form.end_time}:00`);
      const recurrence = form.recurrence_type !== "none" ? {
        type: form.recurrence_type,
        interval: 1,
        days_of_week: form.recurrence_days.length > 0 ? form.recurrence_days : undefined,
        end_date: form.recurrence_end_date || null,
      } : null;
      const payload = {
        title: form.title, start_time: startTime.toISOString(), end_time: endTime.toISOString(),
        importance: form.importance, status: form.status, color: form.color || null, notes: form.notes || null,
        recurrence,
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
      importance: event.importance || "普通", status: event.status, color: event.color || "", notes: event.notes || "",
      recurrence_type: (event.recurrence as any)?.type || "none",
      recurrence_end_date: (event.recurrence as any)?.end_date || "",
      recurrence_days: (event.recurrence as any)?.days_of_week || [],
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
      importance: "普通", status: "未开始", color: "", notes: "",
      recurrence_type: "none", recurrence_end_date: "", recurrence_days: [],
    });
    setDialogOpen(true);
  }, []);

  // Navigation
  const goBack = () => {
    if (viewMode === "3day") setBaseDate(subDays(baseDate, 1));
    else if (viewMode === "week") setBaseDate(subWeeks(baseDate, 1));
    else setBaseDate(subMonths(baseDate, 1));
  };
  const goForward = () => {
    if (viewMode === "3day") setBaseDate(addDays(baseDate, 1));
    else if (viewMode === "week") setBaseDate(addWeeks(baseDate, 1));
    else setBaseDate(addMonths(baseDate, 1));
  };
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setBaseDate(d); };

  const now = new Date();
  const nowY = timeToY(now);
  const todayStr = format(now, "yyyy-MM-dd");
  const todayDayIndex = days.findIndex((d) => format(d, "yyyy-MM-dd") === todayStr);

  const hasScrolled = useRef(false);
  if (scrollRef.current && !hasScrolled.current) {
    scrollRef.current.scrollTop = (8 - VISIBLE_START) * HOUR_HEIGHT - 20;
    hasScrolled.current = true;
  }

  const headerLabel = viewMode === "month"
    ? format(baseDate, "yyyy年M月", { locale: zhCN })
    : `${format(days[0], "M/d")} – ${format(days[days.length - 1], "M/d")}`;

  const gridCols = viewMode === "week" ? "grid-cols-[40px_repeat(7,1fr)]" : "grid-cols-[50px_1fr_1fr_1fr]";

  return (
    <AppLayout title="日程计划">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={goBack}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={goToday}>今天</Button>
          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={goForward}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-medium text-foreground min-w-[100px]">{headerLabel}</span>
          <div className="flex-1" />
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(["3day", "week", "month"] as ViewMode[]).map((mode) => (
              <Button key={mode} variant={viewMode === mode ? "default" : "ghost"} size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setViewMode(mode)}>
                {{ "3day": "3天", "week": "周", "month": "月" }[mode]}
              </Button>
            ))}
          </div>
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
                <div>
                  <Label>自定义颜色（可选）</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="color" value={form.color || "#0ea5e9"} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-8 p-0.5 cursor-pointer" />
                    <span className="text-xs text-muted-foreground">{form.color || "使用默认颜色"}</span>
                    {form.color && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setForm({ ...form, color: "" })}>清除</Button>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">保存</Button>
                  {editingItem && (
                    <Button variant="destructive" size="icon" onClick={async () => {
                      await deleteMutation.mutateAsync(editingItem.id);
                      setDialogOpen(false); setEditingItem(null); resetForm();
                    }}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Month View */}
        {viewMode === "month" ? (
          <MonthView baseDate={baseDate} events={events} onEdit={openEdit} onCreateAt={handleCreateAt} />
        ) : (
          /* Day/Week Grid View */
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Day headers */}
            <div className={`grid ${gridCols} border-b border-border bg-card`}>
              <div className="p-2 text-xs text-muted-foreground" />
              {days.map((d) => {
                const isToday = format(d, "yyyy-MM-dd") === todayStr;
                return (
                  <div key={d.toISOString()} className="p-1.5 text-center border-l border-border">
                    <div className="text-[10px] text-muted-foreground">{format(d, "EEE", { locale: zhCN })}</div>
                    <div className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto" : ""}`}>
                      {format(d, "dd")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div ref={scrollRef} className="max-h-[calc(100vh-220px)] overflow-y-auto relative">
              <div className={`grid ${gridCols}`} style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
                {/* Time gutter */}
                <div className="relative">
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                    <div key={i} className="absolute right-1 text-[10px] text-muted-foreground leading-none"
                      style={{ top: `${i * HOUR_HEIGHT - 5}px` }}>
                      {i + VISIBLE_START > 0 ? `${String(i + VISIBLE_START).padStart(2, "0")}:00` : ""}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <DayColumn key={day.toISOString()} day={day} events={getEventsForDay(day)}
                    onEdit={openEdit} onDragEnd={handleDragEnd} onCreateAt={handleCreateAt} />
                ))}

                {/* Current time line */}
                {todayDayIndex >= 0 && nowY >= 0 && nowY <= TOTAL_HOURS * HOUR_HEIGHT && (
                  <div className="absolute pointer-events-none"
                    style={{ top: `${nowY}px`, left: viewMode === "week" ? "40px" : "50px", right: 0, zIndex: 20 }}>
                    <div className="relative w-full">
                      <div className="absolute h-[2px] bg-destructive"
                        style={{
                          left: `${(todayDayIndex / days.length) * 100}%`,
                          width: `${100 / days.length}%`,
                        }}>
                        <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-destructive" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
