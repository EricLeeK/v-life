import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Edit2, ChevronDown } from "lucide-react";
import { useFinanceByMonth, financeHooks, useSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const CATEGORIES = [
  { key: "餐饮", emoji: "🍜" }, { key: "日用", emoji: "🧴" }, { key: "交通", emoji: "🚃" },
  { key: "住房", emoji: "🏠" }, { key: "通讯/订阅", emoji: "📱" }, { key: "医疗", emoji: "🏥" },
  { key: "服饰", emoji: "👔" }, { key: "娱乐", emoji: "🎮" }, { key: "学习", emoji: "📚" },
  { key: "电子", emoji: "💻" }, { key: "大额", emoji: "🏷️" }, { key: "其他", emoji: "❓" },
] as const;

const PIE_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4", "#a855f7"];

function getWeekLabel(date: string) {
  const d = new Date(date);
  const ws = startOfWeek(d, { weekStartsOn: 1 });
  const we = endOfWeek(d, { weekStartsOn: 1 });
  return `${format(ws, "MM/dd")} - ${format(we, "MM/dd")}`;
}

function getWeekKey(date: string) {
  const d = new Date(date);
  const ws = startOfWeek(d, { weekStartsOn: 1 });
  return ws.toISOString().split("T")[0];
}

// 周三归属月：该周的周三落在哪个月，整周归属该月
function getWeekMonth(date: string): string {
  const d = new Date(date);
  const ws = startOfWeek(d, { weekStartsOn: 1 });
  const wednesday = addDays(ws, 2); // Monday + 2 = Wednesday
  return `${wednesday.getFullYear()}-${String(wednesday.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "餐饮", amount: "", currency: "JPY", date: new Date().toISOString().split("T")[0], notes: "" });
  const { toast } = useToast();

  const { data: records = [] } = useFinanceByMonth(year, month);
  const { data: settings } = useSettings();
  const createMutation = financeHooks.useCreate();
  const updateMutation = financeHooks.useUpdate();
  const deleteMutation = financeHooks.useDelete();

  const targetMonth = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = useMemo(() => 
    records.filter((r: any) => getWeekMonth(r.date) === targetMonth),
    [records, targetMonth]
  );

  const budget = settings?.monthly_budget || 5000;
  const exchangeRate = settings?.exchange_rate_jpy_to_cny || 0.048;
  const totalCny = monthRecords.reduce((sum: number, r: any) => sum + Number(r.amount_cny), 0);
  const budgetProgress = Math.min(100, (totalCny / budget) * 100);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    monthRecords.forEach((r: any) => { map[r.category] = (map[r.category] || 0) + Number(r.amount_cny); });
    return Object.entries(map).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value);
  }, [monthRecords]);

  const weeklyGroups = useMemo(() => {
    const targetMonth = `${year}-${String(month).padStart(2, "0")}`;
    const groups: Record<string, { label: string; items: any[] }> = {};
    records.forEach((r: any) => {
      // Only include records whose week's Wednesday falls in the selected month
      if (getWeekMonth(r.date) !== targetMonth) return;
      const key = getWeekKey(r.date);
      if (!groups[key]) groups[key] = { label: getWeekLabel(r.date), items: [] };
      groups[key].items.push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [records, year, month]);

  const handleSave = async () => {
    if (!form.name || !form.amount || !form.date) { toast({ title: "请填写必填字段", variant: "destructive" }); return; }
    try {
      const amount = Number(form.amount);
      const rate = form.currency === "JPY" ? exchangeRate : 1;
      const amountCny = form.currency === "JPY" ? amount * rate : amount;
      const payload = { name: form.name, category: form.category, amount, currency: form.currency, amount_cny: Number(amountCny.toFixed(2)), exchange_rate: rate, date: form.date, notes: form.notes || null };
      if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      else await createMutation.mutateAsync(payload);
      setDialogOpen(false); setEditingItem(null);
      setForm({ name: "", category: "餐饮", amount: "", currency: "JPY", date: new Date().toISOString().split("T")[0], notes: "" });
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout title="记账">
      <div className="max-w-4xl space-y-4">
        {/* Month selector + Add button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }}>←</Button>
            <span className="text-sm font-medium w-24 text-center">{year}年{month}月</span>
            <Button variant="secondary" size="sm" onClick={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }}>→</Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingItem(null); setForm({ name: "", category: "餐饮", amount: "", currency: "JPY", date: new Date().toISOString().split("T")[0], notes: "" }); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />记一笔</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingItem ? "编辑" : "新增"}记录</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>名称 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>分类 *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.emoji} {c.key}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>金额 *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                  <div><Label>货币</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNY">CNY ¥</SelectItem>
                        <SelectItem value="JPY">JPY ¥</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.currency === "JPY" && form.amount && (
                  <p className="text-xs text-muted-foreground">≈ ¥{(Number(form.amount) * exchangeRate).toFixed(2)} CNY (汇率: {exchangeRate})</p>
                )}
                <div><Label>日期 *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>备注</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleSave} className="w-full">保存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">本月支出</p>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-2xl font-semibold">¥{totalCny.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">/ ¥{budget.toLocaleString()}</span>
              </div>
              <Progress value={budgetProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{records.length} 笔记录</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">分类占比</p>
              {categoryData.length === 0 ? <p className="text-xs text-muted-foreground">暂无数据</p> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="value" stroke="none">
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1">
                    {categoryData.slice(0, 4).map((item, i) => {
                      const cat = CATEGORIES.find((c) => c.key === item.name);
                      return (
                        <div key={item.name} className="flex justify-between text-xs">
                          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: PIE_COLORS[i] }} />{cat?.emoji} {item.name}</span>
                          <span className="text-muted-foreground">¥{item.value.toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly breakdown */}
        <div className="space-y-2">
          {weeklyGroups.length === 0 ? <p className="text-muted-foreground text-sm py-4 text-center">本月暂无记录</p> :
            weeklyGroups.map(([key, group]) => {
              const weekTotal = group.items.reduce((sum: number, r: any) => sum + Number(r.amount_cny), 0);
              return (
                <Collapsible key={key}>
                  <CollapsibleTrigger className="w-full">
                    <Card className="hover:border-primary/20 transition-colors">
                      <CardContent className="p-3 flex items-center justify-between">
                        <span className="text-sm font-medium">{group.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-primary">¥{weekTotal.toFixed(2)}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-2 space-y-1 mt-1">
                    {group.items.map((r: any) => {
                      const cat = CATEGORIES.find((c) => c.key === r.category);
                      return (
                        <Card key={r.id} className="hover:border-primary/20 transition-colors">
                          <CardContent className="p-2 px-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm">{cat?.emoji}</span>
                              <span className="text-sm truncate">{r.name}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(r.date), "MM/dd")}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <span className="text-sm font-medium">¥{Number(r.amount_cny).toFixed(2)}</span>
                                {r.currency === "JPY" && <span className="text-xs text-muted-foreground ml-1">(¥{Number(r.amount).toFixed(0)} JPY)</span>}
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(r);
                                setForm({ name: r.name, category: r.category, amount: String(r.amount), currency: r.currency, date: r.date, notes: r.notes || "" });
                                setDialogOpen(true);
                              }}><Edit2 className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </div>
      </div>
    </AppLayout>
  );
}
