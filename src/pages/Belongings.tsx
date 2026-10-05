import { useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { belongingsDailyHooks, belongingsDurableHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { SubscriptionPanel } from "@/components/belongings/SubscriptionPanel";
import { useLang } from "@/contexts/LanguageContext";
import { DateField } from "@/components/arc/DateField";

const DURABLE_CATEGORIES = ["电子产品", "家电", "家具", "交通工具", "其他"] as const;
const DURABLE_CATEGORY_LABELS: Record<string, string> = {
  "电子产品": "Electronics", "家电": "Appliances", "家具": "Furniture",
  "交通工具": "Vehicles", "其他": "Other",
};

function calcDurable(item: any) {
  const daysUsed = Math.max(1, differenceInDays(new Date(), new Date(item.purchase_date)));
  const expectedDailyCost = item.purchase_price / item.expected_lifespan_days;
  const actualDailyCost = item.purchase_price / daysUsed;
  const isOverdue = daysUsed > item.expected_lifespan_days;
  const savedAmount = isOverdue ? expectedDailyCost * (daysUsed - item.expected_lifespan_days) : 0;
  return { daysUsed, expectedDailyCost, actualDailyCost, isOverdue, savedAmount };
}

export default function BelongingsPage() {
  const { t, lang } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = ["daily", "durable", "subscriptions"].includes(searchParams.get("tab") || "") ? searchParams.get("tab")! : "daily";
  const setTab = (value: string) => setSearchParams({ tab: value }, { replace: true });
  const [dailyDialog, setDailyDialog] = useState(false);
  const [durableDialog, setDurableDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [dailyForm, setDailyForm] = useState({ name: "", category: "", purchase_date: "", notes: "" });
  const [durableForm, setDurableForm] = useState({ name: "", category: "电子产品", purchase_price: "", purchase_date: "", expected_lifespan_days: "", notes: "" });
  const { toast } = useToast();
  const saveInFlight = useRef(false);
  const [saving, setSaving] = useState(false);

  const { data: dailyItems = [] } = belongingsDailyHooks.useList();
  const dailyCreate = belongingsDailyHooks.useCreate();
  const dailyUpdate = belongingsDailyHooks.useUpdate();
  const dailyDelete = belongingsDailyHooks.useDelete();

  const { data: durableItems = [] } = belongingsDurableHooks.useList();
  const durableCreate = belongingsDurableHooks.useCreate();
  const durableUpdate = belongingsDurableHooks.useUpdate();
  const durableDelete = belongingsDurableHooks.useDelete();

  const isSaving = saving || dailyCreate.isPending || dailyUpdate.isPending || durableCreate.isPending || durableUpdate.isPending;
  const resetEditor = () => {
    setEditingItem(null);
    setDailyForm({ name: "", category: "", purchase_date: "", notes: "" });
    setDurableForm({ name: "", category: "电子产品", purchase_price: "", purchase_date: "", expected_lifespan_days: "", notes: "" });
  };
  const changeDialog = (open: boolean) => {
    if (isSaving) return;
    if (tab === "daily") setDailyDialog(open);
    else setDurableDialog(open);
    if (!open) resetEditor();
  };

  const saveDailyItem = async () => {
    if (saveInFlight.current || isSaving) return;
    if (!dailyForm.name.trim() || !dailyForm.category.trim()) { toast({ title: t("请填写名称和分类", "Please fill name and category"), variant: "destructive" }); return; }
    saveInFlight.current = true; setSaving(true);
    try {
      if (editingItem) await dailyUpdate.mutateAsync({ id: editingItem.id, ...dailyForm, purchase_date: dailyForm.purchase_date || null });
      else await dailyCreate.mutateAsync({ ...dailyForm, purchase_date: dailyForm.purchase_date || null });
      setDailyDialog(false); setEditingItem(null); setDailyForm({ name: "", category: "", purchase_date: "", notes: "" });
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
    finally { saveInFlight.current = false; setSaving(false); }
  };

  const saveDurableItem = async () => {
    if (saveInFlight.current || isSaving) return;
    const price = Number(durableForm.purchase_price);
    const lifespan = Number(durableForm.expected_lifespan_days);
    if (!durableForm.name.trim() || !durableForm.purchase_date || !Number.isFinite(price) || price <= 0 || !Number.isFinite(lifespan) || lifespan <= 0) {
      toast({ title: t("请填写所有必填字段", "Please fill all required fields"), variant: "destructive" }); return;
    }
    saveInFlight.current = true; setSaving(true);
    try {
      const payload = { name: durableForm.name.trim(), category: durableForm.category, purchase_price: price, purchase_date: durableForm.purchase_date, expected_lifespan_days: lifespan, notes: durableForm.notes || null };
      if (editingItem) await durableUpdate.mutateAsync({ id: editingItem.id, ...payload });
      else await durableCreate.mutateAsync(payload);
      setDurableDialog(false); setEditingItem(null); setDurableForm({ name: "", category: "电子产品", purchase_price: "", purchase_date: "", expected_lifespan_days: "", notes: "" });
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
    finally { saveInFlight.current = false; setSaving(false); }
  };

  return (
    <AppLayout title={t("用品管理", "Belongings")} description={t("消耗品、耐用品和订阅，花在哪里都看得见。", "Consumables, durables and subscriptions in one place.")}>
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(value) => { if (isSaving) return; setTab(value); setDailyDialog(false); setDurableDialog(false); resetEditor(); }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <TabsList className="max-w-full h-auto flex-wrap">
              <TabsTrigger value="daily">{t("日用消耗品", "Daily Consumables")}</TabsTrigger>
              <TabsTrigger value="durable">{t("大额耐用品", "Durable Goods")}</TabsTrigger>
              <TabsTrigger value="subscriptions" className="min-h-11">{t("订阅服务", "Subscriptions")}</TabsTrigger>
            </TabsList>
            {tab !== "subscriptions" && <Dialog open={tab === "daily" ? dailyDialog : durableDialog} onOpenChange={changeDialog}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetEditor}><Plus className="h-4 w-4 mr-1" />{t("添加", "Add")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingItem ? t("编辑", "Edit") : t("添加", "Add")} {tab === "daily" ? t("日用品", "Consumable") : t("耐用品", "Durable")}</DialogTitle><DialogDescription>{t("填写用品信息并保存。", "Enter the item details and save.")}</DialogDescription></DialogHeader>
                {tab === "daily" ? (
                  <div className="space-y-3">
                    <div><Label htmlFor="daily-name">{t("名称", "Name")} *</Label><Input id="daily-name" value={dailyForm.name} onChange={(e) => setDailyForm({ ...dailyForm, name: e.target.value })} /></div>
                    <div><Label htmlFor="daily-category">{t("分类", "Category")} *</Label><Input id="daily-category" value={dailyForm.category} onChange={(e) => setDailyForm({ ...dailyForm, category: e.target.value })} placeholder={lang === "zh" ? "如：清洁用品" : "e.g. Cleaning"} /></div>
                    <div><Label htmlFor="daily-purchase-date">{t("购入日期", "Purchase Date")}</Label><DateField id="daily-purchase-date" label={t("购入日期", "Purchase Date")} value={dailyForm.purchase_date} onChange={(purchase_date) => setDailyForm({ ...dailyForm, purchase_date })} /></div>
                    <div><Label htmlFor="daily-notes">{t("备注", "Notes")}</Label><Input id="daily-notes" value={dailyForm.notes} onChange={(e) => setDailyForm({ ...dailyForm, notes: e.target.value })} /></div>
                    <Button onClick={saveDailyItem} className="w-full" disabled={isSaving}>{saving ? t("保存中…", "Saving…") : t("保存", "Save")}</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div><Label htmlFor="durable-name">{t("名称", "Name")} *</Label><Input id="durable-name" value={durableForm.name} onChange={(e) => setDurableForm({ ...durableForm, name: e.target.value })} placeholder="如：MacBook Pro 14&quot;" /></div>
                    <div><Label htmlFor="durable-category">{t("分类", "Category")} *</Label>
                      <Select value={durableForm.category} onValueChange={(v) => setDurableForm({ ...durableForm, category: v })}>
                        <SelectTrigger id="durable-category"><SelectValue /></SelectTrigger>
                        <SelectContent>{DURABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{DURABLE_CATEGORY_LABELS[c] || c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label htmlFor="durable-price">{t("购入价格", "Purchase Price")} (CNY) *</Label><Input id="durable-price" type="number" value={durableForm.purchase_price} onChange={(e) => setDurableForm({ ...durableForm, purchase_price: e.target.value })} /></div>
                    <div><Label htmlFor="durable-purchase-date">{t("购入日期", "Purchase Date")} *</Label><DateField id="durable-purchase-date" label={t("购入日期", "Purchase Date")} required value={durableForm.purchase_date} onChange={(purchase_date) => setDurableForm({ ...durableForm, purchase_date })} /></div>
                    <div><Label htmlFor="durable-lifespan">{t("预期寿命", "Expected Lifespan")} ({t("天", "days")}) *</Label><Input id="durable-lifespan" type="number" value={durableForm.expected_lifespan_days} onChange={(e) => setDurableForm({ ...durableForm, expected_lifespan_days: e.target.value })} /></div>
                    <div><Label htmlFor="durable-notes">{t("备注", "Notes")}</Label><Input id="durable-notes" value={durableForm.notes} onChange={(e) => setDurableForm({ ...durableForm, notes: e.target.value })} /></div>
                    <Button onClick={saveDurableItem} className="w-full" disabled={isSaving}>{saving ? t("保存中…", "Saving…") : t("保存", "Save")}</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>}
          </div>

          <TabsContent value="subscriptions"><SubscriptionPanel /></TabsContent>
          <TabsContent value="daily">
            {dailyItems.length === 0 ? <p className="text-muted-foreground text-sm py-12 text-center">{t("还没有日用品。家里常备的东西，记下来就不会重复买。", "No daily items yet.")}</p> : (
              <ul className="row-list">
                {dailyItems.map((item: any, i: number) => (
                  <li key={item.id} style={{ ['--i' as any]: i }} className="row-item enter-up">
                    <div className="row-main">
                      <span className="row-title">{item.name}</span>
                      <span className="row-meta">{item.category}</span>
                      {item.purchase_date && <span className="row-meta ml-auto">{t("购于", "Bought")} {String(item.purchase_date).slice(5, 10).replace("-", "/")}</span>}
                    </div>
                    <div className="row-actions">
                      <Button variant="ghost" size="icon" aria-label={t("编辑日用品", "Edit item")} className="h-8 w-8" onClick={() => { setEditingItem(item); setDailyForm({ name: item.name, category: item.category, purchase_date: item.purchase_date || "", notes: item.notes || "" }); setDailyDialog(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" aria-label={t("删除日用品", "Delete item")} className="h-8 w-8" onClick={() => dailyDelete.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="durable">
            {durableItems.length === 0 ? <p className="text-muted-foreground text-sm py-12 text-center">{t("还没有耐用品。记下价格和预期寿命，就能看到每天花了多少。", "No durable items yet.")}</p> : (
              <ul className="row-list">
                {durableItems.map((item: any, i: number) => {
                  const calc = calcDurable(item);
                  const used = Math.min(1, calc.daysUsed / Math.max(1, Number(item.expected_lifespan_days) || 1));
                  return (
                    <li key={item.id} style={{ ['--i' as any]: i }} className="row-item enter-up items-start py-4">
                      <div className="min-w-0 flex-1">
                        <div className="row-main">
                          <span className="row-title">{item.name}</span>
                          <span className="row-meta">{DURABLE_CATEGORY_LABELS[item.category] && lang !== "zh" ? DURABLE_CATEGORY_LABELS[item.category] : item.category}</span>
                          {calc.isOverdue && <span className="status-text text-success">{t("超值", "Worth it")}</span>}
                          <span className="ml-auto font-mono-data text-sm text-foreground">¥{calc.actualDailyCost.toFixed(2)}<span className="row-meta"> / {t("天", "day")}</span></span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-[3px] flex-1 max-w-xs bg-muted" aria-hidden>
                            <div className="h-full bg-foreground/70" style={{ width: `${used * 100}%` }} />
                          </div>
                          <span className="row-meta">
                            {t("已用", "Used")} {calc.daysUsed} / {item.expected_lifespan_days} {t("天", "days")} · {t("预期", "Planned")} ¥{calc.expectedDailyCost.toFixed(2)}/{t("天", "day")}
                            {calc.isOverdue && <span className="text-success"> · {t("已节省", "Saved")} ¥{calc.savedAmount.toFixed(2)}</span>}
                          </span>
                        </div>
                      </div>
                      <div className="row-actions">
                        <Button variant="ghost" size="icon" aria-label={t("编辑耐用品", "Edit item")} className="h-8 w-8" onClick={() => {
                          setEditingItem(item);
                          setDurableForm({ name: item.name, category: item.category, purchase_price: String(item.purchase_price), purchase_date: item.purchase_date, expected_lifespan_days: String(item.expected_lifespan_days), notes: item.notes || "" });
                          setDurableDialog(true);
                        }}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" aria-label={t("删除耐用品", "Delete item")} className="h-8 w-8" onClick={() => durableDelete.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
