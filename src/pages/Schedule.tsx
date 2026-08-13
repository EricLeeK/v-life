import { useState, useRef, useCallback, useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
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
  useScheduleByRange, scheduleHooks, useSettings, todoHooks,
  useCreateSeriesWithInstances, useUpdateSeriesWithInstances, useDeleteSeries,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DayColumn } from "@/components/schedule/DayColumn";
import { MonthView } from "@/components/schedule/MonthView";
import { HOUR_HEIGHT, VISIBLE_START, TOTAL_HOURS, IMPORTANCE_COLORS, timeToY } from "@/components/schedule/EventBlock";

const SCHEDULE_COLORS = [
  "#ef4444", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#78716c", "#d97706", "#059669", "#7c3aed",
];

const SCHEDULE_COLOR_NAMES: Record<string, { zh: string; en: string }> = {
  "#ef4444": { zh: "红色", en: "Red" },
  "#f59e0b": { zh: "琥珀色", en: "Amber" },
  "#84cc16": { zh: "黄绿色", en: "Lime" },
  "#22c55e": { zh: "绿色", en: "Green" },
  "#14b8a6": { zh: "青色", en: "Teal" },
  "#0ea5e9": { zh: "天蓝色", en: "Sky" },
  "#3b82f6": { zh: "蓝色", en: "Blue" },
  "#6366f1": { zh: "靛蓝色", en: "Indigo" },
  "#8b5cf6": { zh: "紫色", en: "Violet" },
  "#a855f7": { zh: "紫红色", en: "Purple" },
  "#ec4899": { zh: "粉色", en: "Pink" },
  "#f43f5e": { zh: "玫红", en: "Rose" },
  "#78716c": { zh: "石灰色", en: "Stone" },
  "#d97706": { zh: "橙色", en: "Orange" },
  "#059669": { zh: "翠绿", en: "Emerald" },
  "#7c3aed": { zh: "紫罗兰", en: "Violet deep" },
};

type ViewMode = "1day" | "3day" | "week" | "month";

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
  const { t, lang } = useLang();
  const [baseDate, setBaseDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return "1day";
    }
    return "3day";
  });
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
    if (viewMode === "1day") return [baseDate];
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
  const { data: allTodos = [] } = todoHooks.useList();
  const incompleteTodos = (allTodos as any[]).filter((t) => {
    if (t.is_completed || t.is_archived) return false;
    if (t.parent_id) return true;
    const hasActiveChildren = allTodos.some((child: any) => child.parent_id === t.id && !child.is_completed && !child.is_archived);
    return !hasActiveChildren;
  });
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
      toast({ title: t("请填写标题和时间", "Please fill in title and time"), variant: "destructive" }); return;
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
          toast({ title: t("已创建重复事件，共", "Created recurring events,") + ` ${instances.length + 1} ` + t("条", "total") });
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
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
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
      toast({ title: t("已删除整个重复系列", "Entire recurring series deleted") });
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
    if (viewMode === "1day") setBaseDate(subDays(baseDate, 1));
    else if (viewMode === "3day") setBaseDate(subDays(baseDate, 3));
    else if (viewMode === "week") setBaseDate(subWeeks(baseDate, 1));
    else setBaseDate(subMonths(baseDate, 1));
  };
  const goForward = () => {
    if (viewMode === "1day") setBaseDate(addDays(baseDate, 1));
    else if (viewMode === "3day") setBaseDate(addDays(baseDate, 3));
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
    ? (lang === "zh" ? format(baseDate, "yyyy年M月", { locale: zhCN }) : format(baseDate, "MMMM yyyy"))
    : viewMode === "1day"
    ? format(days[0], "M/d (eee)", { locale: zhCN })
    : `${format(days[0], "M/d")} – ${format(days[days.length - 1], "M/d")}`;

  const gridCols = viewMode === "week"
    ? "grid-cols-[40px_repeat(7,1fr)]"
    : viewMode === "1day"
    ? "grid-cols-[50px_1fr]"
    : "grid-cols-[50px_1fr_1fr_1fr]";

  // Check if editing item is part of a series
  const editingIsSeries = editingItem && (() => {
    const masterId = editingItem.parent_event_id || editingItem.id;
    const master = rawEvents.find((e: any) => e.id === masterId);
    return master?.recurrence && (master.recurrence as any).type !== "none";
  })();

  return (
    <AppLayout title={t("日程计划", "Schedule")}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={goBack} aria-label={t("上一页", "Previous")}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={goToday}>{t("今天", "Today")}</Button>
          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={goForward} aria-label={t("下一页", "Next")}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-medium text-foreground min-w-[100px]">{headerLabel}</span>
          <div className="flex-1" />
          {settings?.show_goals_in_schedule !== false && <GoalsBall />}
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(["1day", "3day", "week", "month"] as ViewMode[]).map((mode) => (
              <Button key={mode} variant={viewMode === mode ? "default" : "ghost"} size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setViewMode(mode)}>
                {{ "1day": t("日", "Day"), "3day": t("3天", "3 Day"), "week": t("周", "Week"), "month": t("月", "Month") }[mode]}
              </Button>
            ))}
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingItem(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0" onClick={resetForm}><Plus className="h-4 w-4 mr-1" />{t("新建", "New")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingItem ? t("编辑事件", "Edit Event") : t("新建事件", "New Event")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {incompleteTodos.length > 0 && (
                  <div>
                    <Label htmlFor="quick-todo-select" className="text-xs text-muted-foreground">{t("从待办快速选择", "Quick Pick from To-Dos")}</Label>
                    <Select onValueChange={(v) => {
                      const todo = incompleteTodos.find((t: any) => t.id === v);
                      if (todo) setForm({ ...form, title: todo.title, notes: todo.detail || form.notes });
                    }}>
                      <SelectTrigger id="quick-todo-select" className="mt-1"><SelectValue placeholder={t("选择待办作为标题...", "Pick a to-do as title...")} /></SelectTrigger>
                      <SelectContent>
                        {incompleteTodos.map((todo: any) => {
                          const displayTitle = (() => {
                            if (todo.parent_id) {
                              const parent = allTodos.find((p: any) => p.id === todo.parent_id);
                              return parent ? `${parent.title} > ${todo.title}` : todo.title;
                            }
                            return todo.title;
                          })();
                          return (
                            <SelectItem key={todo.id} value={todo.id}>
                              {displayTitle}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div><Label htmlFor="event-title">{t("标题", "Title")} *</Label><Input id="event-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="event-start-date">{t("开始日期", "Start Date")} *</Label><Input id="event-start-date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value })} /></div>
                  <div><Label htmlFor="event-start-time">{t("开始时间", "Start Time")}</Label><Input id="event-start-time" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="event-end-date">{t("结束日期", "End Date")} *</Label><Input id="event-end-date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  <div><Label htmlFor="event-end-time">{t("结束时间", "End Time")}</Label><Input id="event-end-time" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="event-importance">{t("重要性", "Importance")}</Label>
                    <Select value={form.importance} onValueChange={(v) => setForm({ ...form, importance: v })}>
                      <SelectTrigger id="event-importance"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(IMPORTANCE_COLORS).map((k) => <SelectItem key={k} value={k}>{t(k, { "紧急": "Urgent", "重要": "Important", "普通": "Normal", "低": "Low" }[k] || k)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="event-status">{t("状态", "Status")}</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger id="event-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="未开始">{t("未开始", "Not Started")}</SelectItem>
                        <SelectItem value="进行中">{t("进行中", "In Progress")}</SelectItem>
                        <SelectItem value="已完成">{t("已完成", "Completed")}</SelectItem>
                        <SelectItem value="已取消">{t("已取消", "Cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label htmlFor="event-notes">{t("备注", "Notes")}</Label><Input id="event-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div>
                  <Label id="event-color-label">{t("颜色", "Color")}</Label>
                  <div
                    role="group"
                    aria-labelledby="event-color-label"
                    className="flex flex-wrap gap-1.5 mt-2"
                  >
                    {SCHEDULE_COLORS.map((c) => {
                      const name = SCHEDULE_COLOR_NAMES[c];
                      const colorLabel = name ? (lang === "zh" ? name.zh : name.en) : c;
                      const selected = form.color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-label={colorLabel}
                          aria-pressed={selected}
                          className="w-7 h-7 rounded-full border-2 transition-all shrink-0 min-h-[32px] min-w-[32px]"
                          style={{
                            backgroundColor: c,
                            borderColor: selected ? "var(--foreground)" : "transparent",
                            transform: selected ? "scale(1.15)" : "scale(1)",
                          }}
                          onClick={() => setForm({ ...form, color: c })}
                        />
                      );
                    })}
                    <button
                      type="button"
                      aria-label={t("使用默认颜色", "Use default color")}
                      aria-pressed={!form.color}
                      className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground hover:border-foreground transition-colors shrink-0 min-h-[32px] min-w-[32px]"
                      onClick={() => setForm({ ...form, color: "" })}
                      title={t("使用默认颜色", "Use default")}
                    >
                      ×
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">{form.color || t("默认颜色", "Default color")}</span>
                </div>
                {/* Recurrence */}
                <div>
                  <Label htmlFor="event-recurrence">{t("重复", "Repeat")}</Label>
                  <Select value={form.recurrence_type} onValueChange={(v) => setForm({ ...form, recurrence_type: v })}>
                    <SelectTrigger id="event-recurrence"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("不重复", "No repeat")}</SelectItem>
                      <SelectItem value="daily">{t("每天", "Daily")}</SelectItem>
                      <SelectItem value="weekly">{t("每周", "Weekly")}</SelectItem>
                      <SelectItem value="monthly">{t("每月", "Monthly")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.recurrence_type === "weekly" && (
                    <div className="flex gap-1 mt-2">
                      {(lang === "zh" ? ["一","二","三","四","五","六","日"] : ["M","T","W","T","F","S","S"]).map((d, i) => {
                        const dayNum = i + 1;
                        const selected = form.recurrence_days.includes(dayNum);
                        return (
                          <Button key={d} type="button" variant={selected ? "default" : "secondary"} size="sm" className="h-7 w-7 p-0 text-xs"
                            aria-pressed={selected}
                            onClick={() => setForm(f => ({ ...f, recurrence_days: selected ? f.recurrence_days.filter(x => x !== dayNum) : [...f.recurrence_days, dayNum] }))}>
                            {d}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  {form.recurrence_type !== "none" && (
                    <div className="mt-2">
                      <Label htmlFor="event-recurrence-end" className="text-xs">{t("结束日期（可选，不填则生成未来12个月）", "End date (optional, defaults to 12 months)")}</Label>
                      <Input id="event-recurrence-end" type="date" value={form.recurrence_end_date} onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">{t("保存", "Save")}{editingIsSeries ? t("（整个系列）", " (entire series)") : ""}</Button>
                  {editingItem && (
                    <Button variant="destructive" size="icon" onClick={handleDelete} aria-label={t("删除事件", "Delete event")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {editingIsSeries && (
                  <p className="text-xs text-muted-foreground text-center">{t("编辑或删除将影响整个重复系列", "Editing or deleting will affect the entire recurring series")}</p>
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
          <div className="border border-border rounded-[9px] overflow-hidden bg-card overflow-x-auto">
            <div className="min-w-[600px] sm:min-w-0">
              {/* Day headers */}
              <div className={`grid ${gridCols} border-b border-border bg-muted/40`}>
                <div className="p-2 text-xs text-muted-foreground" />
                {days.map((d) => {
                  const isToday = format(d, "yyyy-MM-dd") === todayStr;
                  return (
                    <div key={d.toISOString()} className={`p-1.5 text-center border-l ${isToday ? "border-[#5b88b5]/30 bg-[#e1eaf4]/50" : "border-border"}`}>
                      <div className={`text-[10px] ${isToday ? "text-[#5b88b5] font-semibold" : "text-muted-foreground"}`}>
                        {format(d, "EEE", { locale: lang === "zh" ? zhCN : undefined })}
                      </div>
                      <div className={`text-xs font-medium ${isToday ? "bg-[#5b88b5] text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto" : "text-foreground"}`}>
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
                    isToday={format(day, "yyyy-MM-dd") === todayStr}
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
                        <div className="absolute -right-1 -top-[3px] w-2 h-2 rounded-full bg-destructive" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Time distribution analysis */}
      </div>
    </AppLayout>
  );
}
