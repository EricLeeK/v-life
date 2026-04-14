import { useState, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GoalsBall } from "@/components/schedule/GoalsBall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useScheduleByRange, scheduleHooks, useSettings,
  useCreateSeriesWithInstances, useUpdateSeriesWithInstances, useDeleteSeries,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DayColumn } from "@/components/schedule/DayColumn";
import { MonthView } from "@/components/schedule/MonthView";
import { HOUR_HEIGHT, VISIBLE_START, TOTAL_HOURS, IMPORTANCE_COLORS, timeToY } from "@/components/schedule/EventBlock";

const STATUS_OPTIONS = ["未开始", "进行中", "已完成", "已取消"];
type ViewMode = "3day" | "week" | "month";

// Generate recurring instances from a master event's recurrence rule
function generateInstances(
  master: { title: string; importance: string; status: string; color: string | null; notes: string | null },
  startTime: Date, endTime: Date,
  recurrence: { type: string; interval?: number; days_of_week?: number[]; end_date?: string | null },
) {
  const duration = endTime.getTime() - startTime.getTime();
  const maxDate = recurrence.end_date
    ? new Date(recurrence.end_date + "T23:59:59")
    : new Date(startTime.getTime() + 365 * 24 * 60 * 60 * 1000); // 12 months

  const instances: any[] = [];

  if (recurrence.type === "weekly" && recurrence.days_of_week?.length) {
    // For weekly with specific days, iterate day by day
    let current = new Date(startTime);
    current.setHours(0, 0, 0, 0);
    // Start from the day after the master's start date
    current = addDays(current, 1);
    for (let safety = 0; safety < 5000 && current <= maxDate; safety++) {
      const dow = current.getDay() === 0 ? 7 : current.getDay();
      if (recurrence.days_of_week.includes(dow)) {
        const instStart = new Date(current);
        instStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        instances.push({
          title: master.title,
          importance: master.importance,
          status: master.status,
          color: master.color,
          notes: master.notes,
          start_time: instStart.toISOString(),
          end_time: new Date(instStart.getTime() + duration).toISOString(),
        });
      }
      current = addDays(current, 1);
    }
  } else {
    let current = new Date(startTime);
    for (let i = 0; i < 5000; i++) {
      if (recurrence.type === "daily") current = addDays(current, recurrence.interval || 1);
      else if (recurrence.type === "weekly") current = addDays(current, 7);
      else if (recurrence.type === "monthly") {
        current = new Date(current);
        current.setMonth(current.getMonth() + (recurrence.interval || 1));
      } else break;

      if (current > maxDate) break;

      const instStart = new Date(current);
      instStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      instances.push({
        title: master.title,
        importance: master.importance,
        status: master.status,
        color: master.color,
        notes: master.notes,
        start_time: instStart.toISOString(),
        end_time: new Date(instStart.getTime() + duration).toISOString(),
      });
    }
  }
  return instances;
}

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
    return [];
  }, [baseDate, viewMode]);

  const rangeStart = useMemo(() => {
    if (viewMode === "month") { const d = startOfMonth(baseDate); d.setHours(0, 0, 0, 0); return d; }
    const d = new Date(days[0]); d.setHours(0, 0, 0, 0); return d;
  }, [days, viewMode, baseDate]);

  const rangeEnd = useMemo(() => {
    if (viewMode === "month") { const d = endOfMonth(baseDate); d.setHours(23, 59, 59, 999); return d; }
    const d = new Date(days[days.length - 1]); d.setHours(23, 59, 59, 999); return d;
  }, [days, viewMode, baseDate]);

  const { data: rawEvents = [] } = useScheduleByRange(rangeStart, rangeEnd);
  const { data: settings } = useSettings();
  const createMutation = scheduleHooks.useCreate();
  const updateMutation = scheduleHooks.useUpdate();
  const deleteMutation = scheduleHooks.useDelete();
  const createSeriesMutation = useCreateSeriesWithInstances();
  const updateSeriesMutation = useUpdateSeriesWithInstances();
  const deleteSeriesMutation = useDeleteSeries();

  // Filter out master events (they have recurrence but are parents) - show only instances and normal events
  const displayEvents = useMemo(() => {
    return rawEvents.filter((e: any) => {
      // Normal event (no recurrence, no parent) → show
      if (!e.recurrence && !e.parent_event_id) return true;
      // Instance of a series → show
      if (e.parent_event_id) return true;
      // Master event with recurrence → hide (instances represent it)
      // But only hide if it actually has instances in DB (check if any instance exists)
      // For safety, hide masters that have recurrence set
      if (e.recurrence && (e.recurrence as any).type !== "none") return false;
      return true;
    });
  }, [rawEvents]);

  const getEventsForDay = useCallback((day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return displayEvents.filter((e: any) => format(new Date(e.start_time), "yyyy-MM-dd") === dayStr);
  }, [displayEvents]);

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
      const isRecurring = form.recurrence_type !== "none";

      const recurrence = isRecurring ? {
        type: form.recurrence_type,
        interval: 1,
        days_of_week: form.recurrence_days.length > 0 ? form.recurrence_days : undefined,
        end_date: form.recurrence_end_date || null,
      } : null;

      const basePayload = {
        title: form.title,
        importance: form.importance,
        status: form.status,
        color: form.color || null,
        notes: form.notes || null,
      };

      if (editingItem) {
        const editingMasterId = editingItem.parent_event_id || editingItem.id;
        const editingMaster = rawEvents.find((e: any) => e.id === editingMasterId) || editingItem;
        const wasSeries = editingMaster.recurrence && (editingMaster.recurrence as any).type !== "none";

        if (isRecurring) {
          // Update as series: update master + regenerate instances
          const instances = generateInstances(basePayload, startTime, endTime, recurrence!);
          await updateSeriesMutation.mutateAsync({
            masterId: editingMasterId,
            masterUpdates: {
              ...basePayload,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              recurrence,
            },
            instances,
          });
        } else if (wasSeries) {
          // Was a series, now converting to single: delete all instances, update master to remove recurrence
          await updateSeriesMutation.mutateAsync({
            masterId: editingMasterId,
            masterUpdates: {
              ...basePayload,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              recurrence: null,
            },
            instances: [],
          });
        } else {
          // Simple single event update
          await updateMutation.mutateAsync({
            id: editingItem.id,
            ...basePayload,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            recurrence: null,
          });
        }
      } else {
        // Creating new
        if (isRecurring) {
          const instances = generateInstances(basePayload, startTime, endTime, recurrence!);
          await createSeriesMutation.mutateAsync({
            master: {
              ...basePayload,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              recurrence,
            },
            instances,
          });
          toast({ title: `已创建重复事件，共 ${instances.length + 1} 条` });
        } else {
          await createMutation.mutateAsync({
            ...basePayload,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            recurrence: null,
          });
        }
      }
      setDialogOpen(false); setEditingItem(null); resetForm();
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const openEdit = useCallback((event: any) => {
    // If clicking an instance, find and edit the master
    const masterId = event.parent_event_id;
    const actualEvent = masterId
      ? rawEvents.find((e: any) => e.id === masterId) || event
      : event;
    const start = new Date(actualEvent.start_time);
    const end = new Date(actualEvent.end_time);
    setEditingItem(actualEvent);
    setForm({
      title: actualEvent.title, start_date: format(start, "yyyy-MM-dd"), start_time: format(start, "HH:mm"),
      end_date: format(end, "yyyy-MM-dd"), end_time: format(end, "HH:mm"),
      importance: actualEvent.importance || "普通", status: actualEvent.status, color: actualEvent.color || "", notes: actualEvent.notes || "",
      recurrence_type: (actualEvent.recurrence as any)?.type || "none",
      recurrence_end_date: (actualEvent.recurrence as any)?.end_date || "",
      recurrence_days: (actualEvent.recurrence as any)?.days_of_week || [],
    });
    setDialogOpen(true);
  }, [rawEvents]);

  const handleDelete = async () => {
    if (!editingItem) return;
    const masterId = editingItem.parent_event_id || editingItem.id;
    const master = rawEvents.find((e: any) => e.id === masterId);
    const isSeries = master?.recurrence && (master.recurrence as any).type !== "none";

    if (isSeries) {
      // Delete entire series
      await deleteSeriesMutation.mutateAsync(masterId);
      toast({ title: "已删除整个重复系列" });
    } else {
      await deleteMutation.mutateAsync(editingItem.id);
    }
    setDialogOpen(false); setEditingItem(null); resetForm();
  };

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

  // Check if editing item is part of a series
  const editingIsSeries = editingItem && (() => {
    const masterId = editingItem.parent_event_id || editingItem.id;
    const master = rawEvents.find((e: any) => e.id === masterId);
    return master?.recurrence && (master.recurrence as any).type !== "none";
  })();

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
          {settings?.show_goals_in_schedule !== false && <GoalsBall />}
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
                {/* Recurrence */}
                <div>
                  <Label>重复</Label>
                  <Select value={form.recurrence_type} onValueChange={(v) => setForm({ ...form, recurrence_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不重复</SelectItem>
                      <SelectItem value="daily">每天</SelectItem>
                      <SelectItem value="weekly">每周</SelectItem>
                      <SelectItem value="monthly">每月</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.recurrence_type === "weekly" && (
                    <div className="flex gap-1 mt-2">
                      {["一","二","三","四","五","六","日"].map((d, i) => {
                        const dayNum = i + 1;
                        const selected = form.recurrence_days.includes(dayNum);
                        return (
                          <Button key={d} type="button" variant={selected ? "default" : "secondary"} size="sm" className="h-7 w-7 p-0 text-xs"
                            onClick={() => setForm(f => ({ ...f, recurrence_days: selected ? f.recurrence_days.filter(x => x !== dayNum) : [...f.recurrence_days, dayNum] }))}>
                            {d}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  {form.recurrence_type !== "none" && (
                    <div className="mt-2">
                      <Label className="text-xs">结束日期（可选，不填则生成未来12个月）</Label>
                      <Input type="date" value={form.recurrence_end_date} onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">保存{editingIsSeries ? "（整个系列）" : ""}</Button>
                  {editingItem && (
                    <Button variant="destructive" size="icon" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {editingIsSeries && (
                  <p className="text-xs text-muted-foreground text-center">编辑或删除将影响整个重复系列</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Month View */}
        {viewMode === "month" ? (
          <MonthView baseDate={baseDate} events={displayEvents} onEdit={openEdit} onCreateAt={handleCreateAt} />
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
              <div className={`grid ${gridCols} pt-2 pb-2`} style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT + 16}px` }}>
                {/* Time gutter */}
                <div className="relative">
                  {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => (
                    <div key={i} className="absolute right-1 text-[10px] text-muted-foreground"
                      style={{ top: `${i * HOUR_HEIGHT + 8 - 5}px`, lineHeight: "1" }}>
                      {`${String(i + VISIBLE_START).padStart(2, "0")}:00`}
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
