import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, TrendingDown } from "lucide-react";
import { belongingsDailyHooks, belongingsDurableHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format } from "date-fns";

const DURABLE_CATEGORIES = ["电子产品", "家电", "家具", "交通工具", "其他"] as const;

function calcDurable(item: any) {
  const daysUsed = Math.max(1, differenceInDays(new Date(), new Date(item.purchase_date)));
  const expectedDailyCost = item.purchase_price / item.expected_lifespan_days;
  const actualDailyCost = item.purchase_price / daysUsed;
  const isOverdue = daysUsed > item.expected_lifespan_days;
  const savedAmount = isOverdue ? expectedDailyCost * (daysUsed - item.expected_lifespan_days) : 0;
  return { daysUsed, expectedDailyCost, actualDailyCost, isOverdue, savedAmount };
}

export default function BelongingsPage() {
  const [tab, setTab] = useState("daily");
  const [dailyDialog, setDailyDialog] = useState(false);
  const [durableDialog, setDurableDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [dailyForm, setDailyForm] = useState({ name: "", category: "", purchase_date: "", notes: "" });
  const [durableForm, setDurableForm] = useState({ name: "", category: "电子产品", purchase_price: "", purchase_date: "", expected_lifespan_days: "", notes: "" });
  const { toast } = useToast();

  const { data: dailyItems = [] } = belongingsDailyHooks.useList();
  const dailyCreate = belongingsDailyHooks.useCreate();
  const dailyUpdate = belongingsDailyHooks.useUpdate();
  const dailyDelete = belongingsDailyHooks.useDelete();

  const { data: durableItems = [] } = belongingsDurableHooks.useList();
  const durableCreate = belongingsDurableHooks.useCreate();
  const durableUpdate = belongingsDurableHooks.useUpdate();
  const durableDelete = belongingsDurableHooks.useDelete();

  const saveDailyItem = async () => {
    if (!dailyForm.name || !dailyForm.category) { toast({ title: "请填写名称和分类", variant: "destructive" }); return; }
    try {
      if (editingItem) await dailyUpdate.mutateAsync({ id: editingItem.id, ...dailyForm, purchase_date: dailyForm.purchase_date || null });
      else await dailyCreate.mutateAsync({ ...dailyForm, purchase_date: dailyForm.purchase_date || null });
      setDailyDialog(false); setEditingItem(null); setDailyForm({ name: "", category: "", purchase_date: "", notes: "" });
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const saveDurableItem = async () => {
    if (!durableForm.name || !durableForm.purchase_price || !durableForm.purchase_date || !durableForm.expected_lifespan_days) {
      toast({ title: "请填写所有必填字段", variant: "destructive" }); return;
    }
    try {
      const payload = { name: durableForm.name, category: durableForm.category, purchase_price: Number(durableForm.purchase_price), purchase_date: durableForm.purchase_date, expected_lifespan_days: Number(durableForm.expected_lifespan_days), notes: durableForm.notes || null };
      if (editingItem) await durableUpdate.mutateAsync({ id: editingItem.id, ...payload });
      else await durableCreate.mutateAsync(payload);
      setDurableDialog(false); setEditingItem(null); setDurableForm({ name: "", category: "电子产品", purchase_price: "", purchase_date: "", expected_lifespan_days: "", notes: "" });
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout title="用品管理">
      <div className="max-w-4xl">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="daily">日用消耗品</TabsTrigger>
              <TabsTrigger value="durable">大额耐用品</TabsTrigger>
            </TabsList>
            <Dialog open={tab === "daily" ? dailyDialog : durableDialog} onOpenChange={tab === "daily" ? setDailyDialog : setDurableDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />添加</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingItem ? "编辑" : "添加"}{tab === "daily" ? "日用品" : "耐用品"}</DialogTitle></DialogHeader>
                {tab === "daily" ? (
                  <div className="space-y-3">
                    <div><Label>名称 *</Label><Input value={dailyForm.name} onChange={(e) => setDailyForm({ ...dailyForm, name: e.target.value })} /></div>
                    <div><Label>分类 *</Label><Input value={dailyForm.category} onChange={(e) => setDailyForm({ ...dailyForm, category: e.target.value })} placeholder="如：清洁用品" /></div>
                    <div><Label>购入日期</Label><Input type="date" value={dailyForm.purchase_date} onChange={(e) => setDailyForm({ ...dailyForm, purchase_date: e.target.value })} /></div>
                    <div><Label>备注</Label><Input value={dailyForm.notes} onChange={(e) => setDailyForm({ ...dailyForm, notes: e.target.value })} /></div>
                    <Button onClick={saveDailyItem} className="w-full">保存</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div><Label>名称 *</Label><Input value={durableForm.name} onChange={(e) => setDurableForm({ ...durableForm, name: e.target.value })} placeholder="如：MacBook Pro 14&quot;" /></div>
                    <div><Label>分类 *</Label>
                      <Select value={durableForm.category} onValueChange={(v) => setDurableForm({ ...durableForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DURABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>购入价格 (CNY) *</Label><Input type="number" value={durableForm.purchase_price} onChange={(e) => setDurableForm({ ...durableForm, purchase_price: e.target.value })} /></div>
                    <div><Label>购入日期 *</Label><Input type="date" value={durableForm.purchase_date} onChange={(e) => setDurableForm({ ...durableForm, purchase_date: e.target.value })} /></div>
                    <div><Label>预期寿命 (天) *</Label><Input type="number" value={durableForm.expected_lifespan_days} onChange={(e) => setDurableForm({ ...durableForm, expected_lifespan_days: e.target.value })} /></div>
                    <div><Label>备注</Label><Input value={durableForm.notes} onChange={(e) => setDurableForm({ ...durableForm, notes: e.target.value })} /></div>
                    <Button onClick={saveDurableItem} className="w-full">保存</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="daily" className="space-y-1">
            {dailyItems.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">暂无日用品记录</p> :
              dailyItems.map((item: any) => (
                <Card key={item.id} className="hover:border-primary/20 transition-colors">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{item.name}</span>
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setDailyForm({ name: item.name, category: item.category, purchase_date: item.purchase_date || "", notes: item.notes || "" }); setDailyDialog(true); }}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => dailyDelete.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="durable" className="space-y-2">
            {durableItems.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">暂无耐用品记录</p> :
              durableItems.map((item: any) => {
                const calc = calcDurable(item);
                return (
                  <Card key={item.id} className={`hover:border-primary/20 transition-colors ${calc.isOverdue ? "border-success/30" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{item.name}</span>
                            <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                            {calc.isOverdue && <Badge className="bg-success/20 text-success text-xs">超值</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <p>预期日均 ¥{calc.expectedDailyCost.toFixed(2)}/天 · 当前日均 ¥{calc.actualDailyCost.toFixed(2)}/天</p>
                            <p>已使用 {calc.daysUsed} 天 / 预期 {item.expected_lifespan_days} 天</p>
                            {calc.isOverdue && (
                              <p className="text-success flex items-center gap-1">
                                <TrendingDown className="h-3 w-3" />已节省 ¥{calc.savedAmount.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingItem(item);
                            setDurableForm({ name: item.name, category: item.category, purchase_price: String(item.purchase_price), purchase_date: item.purchase_date, expected_lifespan_days: String(item.expected_lifespan_days), notes: item.notes || "" });
                            setDurableDialog(true);
                          }}><Edit2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => durableDelete.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
