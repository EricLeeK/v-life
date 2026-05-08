import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Edit2, Coffee, Sun, Moon, Cookie, Dumbbell } from "lucide-react";
import { useCaloriesByDate, calorieHooks, useSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";

const MEAL_TYPE_ICONS: Record<string, React.ElementType> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
  exercise: Dumbbell,
};

const MEAL_TYPES = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
  { key: "exercise", label: "运动" },
] as const;

export default function CaloriesPage() {
  const { t, lang } = useLang();
  const MEAL_TYPES_DISPLAY: Record<string, string> = {
    breakfast: t("早餐", "Breakfast"),
    lunch: t("午餐", "Lunch"),
    dinner: t("晚餐", "Dinner"),
    snack: t("加餐", "Snack"),
    exercise: t("运动", "Exercise"),
  };
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
    if (!form.food_name || !form.calories) { toast({ title: t("请填写食物名称和热量", "Please fill food name and calories"), variant: "destructive" }); return; }
    try {
      const payload = { food_name: form.food_name, calories: Number(form.calories), meal_type: form.meal_type, date: selectedDate, notes: form.notes || null };
      if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      else await createMutation.mutateAsync(payload);
      setDialogOpen(false); setEditingItem(null); setForm({ food_name: "", calories: "", meal_type: "lunch", notes: "" });
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout title={t("热量记录", "Calories")}>
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
                        {format(new Date(d), "EEE", { locale: lang === "zh" ? zhCN : undefined })}
                      </span>
                      <span className={`text-[13px] font-semibold leading-none mt-1 ${isSelected ? 'text-[#1f1a14]' : 'text-[#8a847a]'}`}>
                        {format(new Date(d), "dd")}
                      </span>
                      {isToday && (
                        <span className={`text-[8px] font-medium leading-none mt-[3px] ${isSelected ? 'text-[#5b88b5]' : 'text-[#8a847a]'}`}>{t("今天", "Today")}</span>
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
              <span className="text-foreground font-medium font-mono-data">{foodCalories} - {exerciseCalories} = {totalCalories} kcal</span>
              <span className="text-muted-foreground">/ {target} kcal</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Meal sections */}
        {MEAL_TYPES.map(({ key, label }) => {
          const mealRecords = records.filter((r: any) => r.meal_type === key);
          const mealTotal = mealRecords.reduce((sum: number, r: any) => sum + r.calories, 0);
          const MealIcon = MEAL_TYPE_ICONS[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">{MealIcon && <MealIcon className="h-4 w-4 text-[#8a847a]" />}{MEAL_TYPES_DISPLAY[key] || label} <span className="text-muted-foreground ml-1">{mealTotal} kcal</span></h3>
                <Dialog open={dialogOpen && form.meal_type === key} onOpenChange={(o) => { if (o) { setForm({ ...form, meal_type: key }); setDialogOpen(true); } else { setDialogOpen(false); setEditingItem(null); } }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7"><Plus className="h-3 w-3 mr-1" />{t("添加", "Add")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingItem ? t("编辑", "Edit") : t("添加", "Add")} {t("记录", "Record")}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>{t("食物名称", "Food Name")} *</Label><Input value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} /></div>
                      <div><Label>{t("热量", "Calories")} (kcal) *</Label><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /></div>
                      <div><Label>{t("餐次", "Meal Type")}</Label>
                        <Select value={form.meal_type} onValueChange={(v) => setForm({ ...form, meal_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{MEAL_TYPES.map((m) => { const MIcon = MEAL_TYPE_ICONS[m.key]; return <SelectItem key={m.key} value={m.key}><span className="flex items-center gap-1.5">{MIcon && <MIcon className="h-4 w-4 text-[#8a847a]" />}{MEAL_TYPES_DISPLAY[m.key] || m.label}</span></SelectItem>; })}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>{t("备注", "Notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                      <Button onClick={handleSave} className="w-full">{t("保存", "Save")}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {mealRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-2 mb-3">{t("暂无记录", "No records")}</p>
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
