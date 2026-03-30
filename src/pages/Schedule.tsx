import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import { useScheduleByRange, scheduleHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays, setHours, setMinutes } from "date-fns";
import { zhCN } from "date-fns/locale";

const IMPORTANCE_COLORS: Record<string, string> = {
  "紧急": "#ef4444", "重要": "#f59e0b", "普通": "#0ea5e9", "低": "#6b7280"
};
const STATUS_OPTIONS = ["未开始", "进行中", "已完成", "已取消"];

export default function SchedulePage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", start_date: "", start_time: "09:00", end_date: "", end_time: "10:00",
    importance: "普通", status: "未开始", color: "", notes: ""
  });
  const { toast } = useToast();

  // 3-day view
  const days = [baseDate, addDays(baseDate, 1), addDays(baseDate, 2)];
  const rangeStart = new Date(days[0]); rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(days[2]); rangeEnd.setHours(23, 59, 59, 999);

  const { data: events = [] } = useScheduleByRange(rangeStart, rangeEnd);
  const createMutation = scheduleHooks.useCreate();
  const updateMutation = scheduleHooks.useUpdate();
  const deleteMutation = scheduleHooks.useDelete();

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((e: any) => {
      const eStart = format(new Date(e.start_time), "yyyy-MM-dd");
      return eStart === dayStr;
    });
  };

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
      setDialogOpen(false); setEditingItem(null);
      resetForm();
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const resetForm = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setForm({ title: "", start_date: today, start_time: "09:00", end_date: today, end_time: "10:00", importance: "普通", status: "未开始", color: "", notes: "" });
  };

  const openEdit = (event: any) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    setEditingItem(event);
    setForm({
      title: event.title, start_date: format(start, "yyyy-MM-dd"), start_time: format(start, "HH:mm"),
      end_date: format(end, "yyyy-MM-dd"), end_time: format(end, "HH:mm"),
      importance: event.importance || "普通", status: event.status, color: event.color || "", notes: event.notes || ""
    });
    setDialogOpen(true);
  };

  // 7-day nav
  const navDays = Array.from({ length: 7 }, (_, i) => addDays(subDays(new Date(), 1), i));

  return (
    <AppLayout title="日程计划">
      <div className="space-y-4">
        {/* 7-day nav */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBaseDate(subDays(baseDate, 3))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-1 overflow-x-auto">
            {navDays.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const isSelected = days.some((day) => format(day, "yyyy-MM-dd") === dateStr);
              return (
                <Button key={dateStr} variant={isSelected ? "default" : "secondary"} size="sm" className="shrink-0 min-w-[52px]"
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
                <Button onClick={handleSave} className="w-full">保存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 3-day calendar grid */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-[50px_1fr_1fr_1fr] border-b border-border">
            <div className="p-2 text-xs text-muted-foreground" />
            {days.map((d) => (
              <div key={d.toISOString()} className="p-2 text-center border-l border-border">
                <div className="text-xs text-muted-foreground">{format(d, "EEE", { locale: zhCN })}</div>
                <div className="text-sm font-medium">{format(d, "MM/dd")}</div>
              </div>
            ))}
          </div>

          {/* Time grid - show 7am to 22pm for practicality */}
          <div className="max-h-[600px] overflow-y-auto">
            {hours.filter((h) => h >= 7 && h <= 22).map((hour) => (
              <div key={hour} className="grid grid-cols-[50px_1fr_1fr_1fr] min-h-[40px] border-b border-border/50">
                <div className="p-1 text-xs text-muted-foreground text-right pr-2">{String(hour).padStart(2, "0")}:00</div>
                {days.map((day) => {
                  const dayEvents = getEventsForDay(day).filter((e: any) => {
                    const eHour = new Date(e.start_time).getHours();
                    return eHour === hour;
                  });
                  return (
                    <div key={day.toISOString()} className="border-l border-border/50 p-0.5 relative">
                      {dayEvents.map((event: any) => {
                        const color = event.color || IMPORTANCE_COLORS[event.importance || "普通"] || "#0ea5e9";
                        const startH = new Date(event.start_time).getHours();
                        const endH = new Date(event.end_time).getHours();
                        const duration = Math.max(1, endH - startH);
                        return (
                          <div key={event.id}
                            className="rounded px-1.5 py-0.5 text-xs cursor-pointer hover:opacity-80 truncate"
                            style={{ background: color + "20", borderLeft: `3px solid ${color}`, color: color, minHeight: `${duration * 40 - 4}px` }}
                            onClick={() => openEdit(event)}
                          >
                            <span className="font-medium">{event.title}</span>
                            <span className="ml-1 opacity-70">{format(new Date(event.start_time), "HH:mm")}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
