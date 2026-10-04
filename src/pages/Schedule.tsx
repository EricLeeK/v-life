import { useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { GoalsBall } from "@/components/schedule/GoalsBall";
import { Button } from "@/components/ui/button";
import SegmentedControl from "@/vendor/uiarc/registry/components/segmented-control/segmented-control";
import { Combobox } from "@/vendor/uiarc/registry/components/combobox/combobox";
import { ArcScope } from "@/components/arc/ArcScope";
import { DateField, TimeField } from "@/components/arc/DateField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BottomSheet from "@/vendor/uiarc/registry/components/bottom-sheet/bottom-sheet";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useScheduleByRange, scheduleHooks, useSettings, todoHooks,
  useCreateSeriesWithInstances, useUpdateSeriesWithInstances, useDeleteSeries,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import ConfirmMorph from "@/vendor/uiarc/registry/components/confirm-morph/confirm-morph";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DayColumn } from "@/components/schedule/DayColumn";
import { MonthView } from "@/components/schedule/MonthView";
import { HOUR_HEIGHT, VISIBLE_START, TOTAL_HOURS, IMPORTANCE_COLORS, timeToY } from "@/components/schedule/EventBlock";

/* Event colors derive from the app's --cat-* tokens so they adapt to dark mode;
   legacy records may still carry raw hexes picked before this palette. */
const SCHEDULE_COLORS = [
  "hsl(var(--cat-red))", "hsl(var(--cat-orange))", "hsl(var(--cat-yellow))", "hsl(var(--cat-green))",
  "hsl(var(--cat-teal))", "hsl(var(--cat-blue))", "hsl(var(--cat-purple))", "hsl(var(--muted-foreground))",
];

const SCHEDULE_COLOR_NAMES: Record<string, { zh: string; en: string }> = {
  "hsl(var(--cat-red))": { zh: "红色", en: "Red" },
  "hsl(var(--cat-orange))": { zh: "橙色", en: "Orange" },
  "hsl(var(--cat-yellow))": { zh: "黄色", en: "Yellow" },
  "hsl(var(--cat-green))": { zh: "绿色", en: "Green" },
  "hsl(var(--cat-teal))": { zh: "青色", en: "Teal" },
  "hsl(var(--cat-blue))": { zh: "蓝色", en: "Blue" },
  "hsl(var(--cat-purple))": { zh: "紫色", en: "Purple" },
  "hsl(var(--muted-foreground))": { zh: "石灰色", en: "Stone" },
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
  const location = useLocation();
  const openCreateFromDashboard = new URLSearchParams(location.search).get("new") === "1";
  const today = format(new Date(), "yyyy-MM-dd");
  const [baseDate, setBaseDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return "1day";
    }
    return "3day";
  });
  const [dialogOpen, setDialogOpen] = useState(openCreateFromDashboard);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", start_date: today, start_time: "09:00", end_date: today, end_time: "10:00",
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

  // Keep the series master visible as its first occurrence. Generated instances
  // begin after the master date, so hiding a matching master would leave the
  // series blank on its first day. For a weekly rule, the master only counts
  // when its weekday is one of the selected weekdays.
  const displayEvents = useMemo(() => {
    return rawEvents.filter((event: any) => {
      const recurrence = event.recurrence as { type?: string; days_of_week?: number[] } | null;
      if (!recurrence || event.parent_event_id || recurrence.type === "none" || recurrence.type !== "weekly") return true;
      const daysOfWeek = recurrence.days_of_week;
      if (!daysOfWeek?.length) return true;
      const start = new Date(event.start_time);
      const weekday = start.getDay() === 0 ? 7 : start.getDay();
      return daysOfWeek.includes(weekday);
    });
  }, [rawEvents]);

  const getEventsForDay = useCallback((day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return displayEvents.filter((e: any) => {
      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      return start < dayEnd && end > dayStart;
    });
  }, [displayEvents]);

  const resetForm = useCallback(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    setForm({ title: "", start_date: today, start_time: "09:00", end_date: today, end_time: "10:00", importance: "普通", status: "未开始", color: "", notes: "", recurrence_type: "none", recurrence_end_date: "", recurrence_days: [] });
  }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_date || !form.end_date || !form.start_time || !form.end_time) {
      toast({ title: t("请填写标题和时间", "Please fill in title and time"), variant: "destructive" }); return;
    }
    try {
      const startTime = new Date(`${form.start_date}T${form.start_time}:00`);
      const endTime = new Date(`${form.end_date}T${form.end_time}:00`);
      const isRecurring = form.recurrence_type !== "none";

      if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime <= startTime) {
        toast({ title: t("结束时间必须晚于开始时间", "End time must be after start time"), variant: "destructive" }); return;
      }
      if (isRecurring && form.recurrence_end_date && form.recurrence_end_date < form.start_date) {
        toast({ title: t("重复结束日期不能早于开始日期", "Repeat end date cannot be before start date"), variant: "destructive" }); return;
      }
      if (form.recurrence_type === "weekly" && form.recurrence_days.length === 0) {
        toast({ title: t("请选择每周重复的日期", "Choose at least one weekday for weekly repeat"), variant: "destructive" }); return;
      }

      const recurrence = isRecurring ? {
        type: form.recurrence_type,
        interval: 1,
        days_of_week: form.recurrence_days.length > 0 ? form.recurrence_days : undefined,
        end_date: form.recurrence_end_date || null,
      } : null;

      const basePayload = {
        title: form.title.trim(),
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

  const eventForm = (
    <div className="space-y-3">
      {incompleteTodos.length > 0 && (
        <div>
          <Combobox id="quick-todo-select" label={t("从待办快速选择", "Quick Pick from To-Dos")} placeholder={t("搜索待办作为标题…", "Search a to-do as title…")} onValueChange={(v) => {
            const todo = incompleteTodos.find((t: any) => t.id === v);
            if (todo) setForm({ ...form, title: todo.title, notes: todo.detail || form.notes });
          }} options={incompleteTodos.map((todo: any) => {
            const parent = todo.parent_id ? allTodos.find((p: any) => p.id === todo.parent_id) : null;
            return { value: todo.id, label: parent ? `${parent.title} > ${todo.title}` : todo.title, keywords: [todo.title, todo.category ?? ""] };
          })} />
        </div>
      )}
      <div><Label htmlFor="event-title">{t("标题", "Title")} *</Label><Input id="event-title" className="mt-1 h-9 text-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="event-start-date">{t("开始日期", "Start Date")} *</Label><DateField id="event-start-date" label={t("开始日期", "Start Date")} value={form.start_date} onChange={(start_date) => setForm({ ...form, start_date, end_date: start_date })} /></div>
        <div><Label htmlFor="event-start-time">{t("开始时间", "Start Time")}</Label><TimeField id="event-start-time" label={t("开始时间", "Start Time")} value={form.start_time} onChange={(start_time) => setForm({ ...form, start_time })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="event-end-date">{t("结束日期", "End Date")} *</Label><DateField id="event-end-date" label={t("结束日期", "End Date")} value={form.end_date} onChange={(end_date) => setForm({ ...form, end_date })} /></div>
        <div><Label htmlFor="event-end-time">{t("结束时间", "End Time")}</Label><TimeField id="event-end-time" label={t("结束时间", "End Time")} value={form.end_time} onChange={(end_time) => setForm({ ...form, end_time })} clearable /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="event-importance">{t("重要性", "Importance")}</Label>
          <select id="event-importance" value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })} className="native-select mt-1 w-full rounded-md border border-input bg-card px-3 text-base text-card-foreground">
            {Object.keys(IMPORTANCE_COLORS).map((k) => <option key={k} value={k}>{t(k, { "紧急": "Urgent", "重要": "Important", "普通": "Normal", "低": "Low" }[k] || k)}</option>)}
          </select>
        </div>
        <div><Label htmlFor="event-status">{t("状态", "Status")}</Label>
          <select id="event-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="native-select mt-1 w-full rounded-md border border-input bg-card px-3 text-base text-card-foreground">
            <option value="未开始">{t("未开始", "Not Started")}</option>
            <option value="进行中">{t("进行中", "In Progress")}</option>
            <option value="已完成">{t("已完成", "Completed")}</option>
            <option value="已取消">{t("已取消", "Cancelled")}</option>
          </select>
        </div>
      </div>
      <div><Label htmlFor="event-notes">{t("备注", "Notes")}</Label><Input id="event-notes" className="mt-1 h-9 text-base" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
                className="w-8 h-8 rounded-full border-2 transition-all shrink-0"
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
            className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground hover:border-foreground transition-colors shrink-0"
            onClick={() => setForm({ ...form, color: "" })}
            title={t("使用默认颜色", "Use default")}
          >
            ×
          </button>
        </div>
        <span className="text-[11px] text-muted-foreground mt-1 block">{form.color || t("默认颜色", "Default color")}</span>
      </div>
      {/* Recurrence */}
      <div>
        <Label htmlFor="event-recurrence">{t("重复", "Repeat")}</Label>
        <select id="event-recurrence" value={form.recurrence_type} onChange={(e) => setForm({ ...form, recurrence_type: e.target.value })} className="native-select mt-1 w-full rounded-md border border-input bg-card px-3 text-base text-card-foreground">
          <option value="none">{t("不重复", "No repeat")}</option>
          <option value="daily">{t("每天", "Daily")}</option>
          <option value="weekly">{t("每周", "Weekly")}</option>
          <option value="monthly">{t("每月", "Monthly")}</option>
        </select>
        {form.recurrence_type === "weekly" && (
          <div className="flex gap-1 mt-2">
            {(lang === "zh" ? ["一","二","三","四","五","六","日"] : ["M","T","W","T","F","S","S"]).map((d, i) => {
              const dayNum = i + 1;
              const selected = form.recurrence_days.includes(dayNum);
              return (
                <Button key={d} type="button" variant={selected ? "default" : "secondary"} size="sm" className="h-8 w-8 p-0 text-xs"
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
            <DateField id="event-recurrence-end" label={t("结束日期", "End date")} value={form.recurrence_end_date} onChange={(recurrence_end_date) => setForm({ ...form, recurrence_end_date })} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">{t("保存", "Save")}{editingIsSeries ? t("（整个系列）", " (entire series)") : ""}</Button>
        {editingItem && (
          <ConfirmMorph
  className="confirm-quiet"
            tone="danger"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            label={<span className="sr-only">{t("删除事件", "Delete event")}</span>}
            prompt={editingIsSeries ? t("删除整个重复系列？", "Delete the entire series?") : t("删除这个事件？", "Delete this event?")}
            confirmLabel={t("删除", "Delete")}
            cancelLabel={t("取消", "Cancel")}
            doneLabel={t("已删除", "Deleted")}
            onConfirm={handleDelete}
          />
        )}
      </div>
      {editingIsSeries && (
        <p className="text-xs text-muted-foreground text-center">{t("编辑或删除将影响整个重复系列", "Editing or deleting will affect the entire recurring series")}</p>
      )}
    </div>
  );

  return (
    <AppLayout title={t("日程计划", "Schedule")}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="icon" className="h-9 w-9" onClick={goBack} aria-label={t("上一页", "Previous")}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={goToday}>{t("今天", "Today")}</Button>
          <Button variant="secondary" size="icon" className="h-9 w-9" onClick={goForward} aria-label={t("下一页", "Next")}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-medium text-foreground min-w-[100px]">{headerLabel}</span>
          <div className="flex-1" />
          {settings?.show_goals_in_schedule !== false && <GoalsBall />}
          <ArcScope>
            <SegmentedControl label={t("日程视图", "Schedule view")} value={viewMode} onValueChange={value => setViewMode(value as ViewMode)} options={[
              { value: "1day", label: t("日", "Day") },
              { value: "3day", label: t("3天", "3 Day") },
              { value: "week", label: t("周", "Week") },
              { value: "month", label: t("月", "Month") },
            ]} />
          </ArcScope>
          <Button size="sm" className="shrink-0 h-9" onClick={() => { setEditingItem(null); resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t("新建", "New")}</Button>
        </div>

        {/* Event form rises from the bottom, opens at the tall detent */}
        <BottomSheet
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingItem(null); resetForm(); } }}
          title={editingItem ? t("编辑事件", "Edit Event") : t("新建事件", "New Event")}
          description={t("填写标题与时间，安排新的日程事件。", "Add a title and time for this schedule event.")}
          detents={[0.78, 0.94]}
          initialDetent={1}
          className="arc-runtime"
          closeLabel={t("关闭", "Close")}
        >
          {eventForm}
        </BottomSheet>

        {/* Month View */}
        {viewMode === "month" ? (
          <MonthView baseDate={baseDate} events={displayEvents} onEdit={openEdit} onCreateAt={handleCreateAt} />
        ) : (
          /* Day/Week Grid View */
          <div className="border border-border rounded-lg overflow-hidden bg-card overflow-x-auto">
            <div className="min-w-[600px] sm:min-w-0">
              {/* Day headers */}
              <div className={`grid ${gridCols} border-b border-border bg-muted/40`}>
                <div className="p-2 text-xs text-muted-foreground" />
                {days.map((d) => {
                  const isToday = format(d, "yyyy-MM-dd") === todayStr;
                  return (
                    <div key={d.toISOString()} className={`p-1.5 text-center border-l ${isToday ? "border-cat-blue/30 bg-cat-blue-bg/50" : "border-border"}`}>
                      <div className={`text-[11px] ${isToday ? "text-cat-blue font-semibold" : "text-muted-foreground"}`}>
                        {format(d, "EEE", { locale: lang === "zh" ? zhCN : undefined })}
                      </div>
                      <div className={`text-xs font-medium ${isToday ? "bg-cat-blue text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto" : "text-foreground"}`}>
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
                    <div key={i} className="absolute right-1 text-[11px] text-muted-foreground"
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
