import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { useCaloriesByDate, calorieHooks, useSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";

const MEAL_TYPES = [
  { key: "breakfast", label: "🌅 早餐" },
  { key: "lunch", label: "☀️ 午餐" },
  { key: "dinner", label: "🌙 晚餐" },
  { key: "snack", label: "🍿 加餐" },
  { key: "exercise", label: "🏃 运动" },
] as const;

export default function CaloriesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ food_name: "", calories: "", meal_type: "lunch", notes: "" });
  const { toast } = useToast();

  const { data: records = [] } = useCaloriesByDate(selectedDate);
  const { data: settings } = useSettings();
  const createMutation = calorieHooks.useCreate();
  const updateMutation = calorieHooks.useUpdate();
  const deleteMutation = calorieHooks.useDelete();

  const target = settings?.calorie_target || 2000;
  const foodCalories = records.filter((r: any) => r.meal_type !== "exercise").reduce((sum: number, r: any) => sum + r.calories, 0);
  const exerciseCalories = records.filter((r: any) => r.meal_type === "exercise").reduce((sum: number, r: any) => sum + r.calories, 0);
  const totalCalories = foodCalories - exerciseCalories;
  const progress = Math.min(100, (totalCalories / target) * 100);

  // Generate 7-day nav (yesterday + today + 5 days)
  const today = new Date();
  const navDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(subDays(today, 1), i);
    return d.toISOString().split("T")[0];
  });

  const handleSave = async () => {
    if (!form.food_name || !form.calories) { toast({ title: "请填写食物名称和热量", variant: "destructive" }); return; }
    try {
      const payload = { food_name: form.food_name, calories: Number(form.calories), meal_type: form.meal_type, date: selectedDate, notes: form.notes || null };
      if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      else await createMutation.mutateAsync(payload);
      setDialogOpen(false); setEditingItem(null); setForm({ food_name: "", calories: "", meal_type: "lunch", notes: "" });
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout title="热量记录">
      <div className="space-y-4">
        {/* Day nav — recessed groove with sliding indicator */}
        {(() => {
          const selIdx = navDays.indexOf(selectedDate);
          const n = navDays.length;
          return (
            <div className="relative bg-[#e6e3d9] rounded-[11px] p-[5px] shadow-[inset_0_1.5px_4px_rgba(0,0,0,0.07)] overflow-hidden">
              {/* Sliding indicator */}
              <div
                className="absolute top-[5px] bottom-[5px] bg-white rounded-[8px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  width: `calc((100% - 10px) / ${n})`,
                  left: `calc(5px + ${selIdx} * (100% - 10px) / ${n})`,
                }}
              />
              {/* Day items */}
              <div className="relative flex">
                {navDays.map((d) => {
                  const isToday = d === new Date().toISOString().split("T")[0];
                  const isSelected = d === selectedDate;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className="flex-1 flex flex-col items-center justify-center py-2.5 z-10 transition-colors duration-200 cursor-pointer"
                    >
                      <span className={`text-[10px] font-medium leading-none ${isSelected ? 'text-[#1f1a14]' : 'text-[#8a847a]'}`}>
                        {format(new Date(d), "EEE", { locale: zhCN })}
                      </span>
                      <span className={`text-[13px] font-semibold leading-none mt-1 ${isSelected ? 'text-[#1f1a14]' : 'text-[#8a847a]'}`}>
                        {format(new Date(d), "dd")}
                      </span>
                      {isToday && (
                        <span className={`text-[8px] font-medium leading-none mt-[3px] ${isSelected ? 'text-[#5b88b5]' : 'text-[#8a847a]'}`}>今天</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-foreground font-medium">{foodCalories} - {exerciseCalories} = {totalCalories} kcal</span>
              <span className="text-muted-foreground">/ {target} kcal</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Meal sections */}
        {MEAL_TYPES.map(({ key, label }) => {
          const mealRecords = records.filter((r: any) => r.meal_type === key);
          const mealTotal = mealRecords.reduce((sum: number, r: any) => sum + r.calories, 0);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{label} <span className="text-muted-foreground ml-1">{mealTotal} kcal</span></h3>
                <Dialog open={dialogOpen && form.meal_type === key} onOpenChange={(o) => { if (o) { setForm({ ...form, meal_type: key }); setDialogOpen(true); } else { setDialogOpen(false); setEditingItem(null); } }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7"><Plus className="h-3 w-3 mr-1" />添加</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingItem ? "编辑" : "添加"}记录</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>食物名称 *</Label><Input value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} /></div>
                      <div><Label>热量 (kcal) *</Label><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /></div>
                      <div><Label>餐次</Label>
                        <Select value={form.meal_type} onValueChange={(v) => setForm({ ...form, meal_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{MEAL_TYPES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>备注</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                      <Button onClick={handleSave} className="w-full">保存</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {mealRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-2 mb-3">暂无记录</p>
              ) : (
                <div className="space-y-1 mb-3">
                  {mealRecords.map((r: any) => (
                    <Card key={r.id} className="hover:border-primary/20 transition-colors">
                      <CardContent className="p-2 px-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm">{r.food_name}</span>
                          <span className="text-xs text-[#d17847] font-medium">{r.calories} kcal</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setEditingItem(r);
                            setForm({ food_name: r.food_name, calories: String(r.calories), meal_type: r.meal_type, notes: r.notes || "" });
                            setDialogOpen(true);
                          }}><Edit2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
