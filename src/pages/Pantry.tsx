import { moduleFigure } from "@/components/concepts/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectionFeedback } from "@/components/concepts/CollectionFeedback";
import { useState, type CSSProperties } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import { pantryHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { DateField } from "@/components/arc/DateField";
import { ArcScope } from "@/components/arc/ArcScope";
import SegmentedControl from "@/vendor/uiarc/registry/components/segmented-control/segmented-control";
import { useLocalDate } from "@/hooks/useLocalDate";

const CATEGORIES = ["新鲜食材", "零食", "调料", "主食/干货", "饮品", "冷冻食品"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  "新鲜食材": "Fresh", "零食": "Snacks", "调料": "Seasonings",
  "主食/干货": "Staples", "饮品": "Drinks", "冷冻食品": "Frozen",
};
const FILTERS = ["全部", "即将过期", "已过期"] as const;
const FILTER_LABELS: Record<string, string> = { "全部": "All", "即将过期": "Expiring Soon", "已过期": "Expired" };
const STATUS_LABELS: Record<string, string> = { "充足": "OK", "已过期": "Expired", "即将过期": "Expiring Soon" };

type PantryItem = {
  id: string;
  name: string;
  category?: string | null;
  quantity?: string | null;
  purchase_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
};

function getCategoryLabel(category: string): string {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category) ? CATEGORY_LABELS[category] : category;
}

type Status = { label: string; tone: "ok" | "warn" | "danger"; days: number | null };

function getStatus(expiryDate: string | null | undefined, today: string): Status {
  if (!expiryDate) return { label: "充足", tone: "ok", days: null };
  // `expiry_date` is a calendar date from the database. Comparing parsed
  // instants makes date-only values shift across time zones, so compare local
  // calendar days instead.
  const expiryDay = expiryDate.slice(0, 10);
  const days = differenceInCalendarDays(parseISO(expiryDay), parseISO(today));
  if (days < 0) return { label: "已过期", tone: "danger", days };
  if (days <= 3) return { label: "即将过期", tone: "warn", days };
  return { label: "充足", tone: "ok", days };
}

function expiryNote(status: Status, lang: string) {
  const { days } = status;
  if (days === null) return "";
  const zh = lang === "zh";
  if (days < 0) return zh ? `${-days} 天前` : `${-days}d ago`;
  if (days === 0) return zh ? "今天" : "today";
  if (days <= 3) return zh ? `还剩 ${days} 天` : `${days}d left`;
  return "";
}

export default function PantryPage() {
  const { t, lang } = useLang();
  const today = useLocalDate();
  const [filter, setFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [form, setForm] = useState({ name: "", category: "新鲜食材" as string, quantity: "", purchase_date: "", expiry_date: "", notes: "" });
  const { toast } = useToast();

  const { data: rawItems = [], isLoading, error, refetch } = pantryHooks.useList();
  const items = rawItems as PantryItem[];
  const createMutation = pantryHooks.useCreate();
  const updateMutation = pantryHooks.useUpdate();
  const deleteMutation = pantryHooks.useDelete();

  const counts: Record<string, number> = { "全部": items.length, "即将过期": 0, "已过期": 0 };
  items.forEach((item) => {
    const { label } = getStatus(item.expiry_date, today);
    if (label in counts) counts[label] += 1;
  });

  const filtered = items.filter((item: PantryItem) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return filter === "全部" || getStatus(item.expiry_date, today).label === filter;
  });

  // Keep the built-in order while also rendering categories introduced by AI
  // or older data. Map avoids treating a category such as "__proto__" as an
  // object property and silently dropping it.
  const grouped = new Map<string, PantryItem[]>();
  filtered.forEach((item: PantryItem) => {
    const category = typeof item.category === "string" && item.category.trim() ? item.category : "未分类";
    const categoryItems = grouped.get(category) || [];
    categoryItems.push(item);
    grouped.set(category, categoryItems);
  });
  const categoryOrder = [
    ...CATEGORIES,
    ...Array.from(grouped.keys()).filter((category) => !CATEGORIES.includes(category as (typeof CATEGORIES)[number])),
  ];

  const handleSave = async () => {
    if (!form.name || !form.category) { toast({ title: t("请填写名称和分类", "Please fill name and category"), variant: "destructive" }); return; }
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, ...form, purchase_date: form.purchase_date || null, expiry_date: form.expiry_date || null });
      } else {
        await createMutation.mutateAsync({ ...form, purchase_date: form.purchase_date || null, expiry_date: form.expiry_date || null });
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: unknown) {
      toast({ title: t("保存失败", "Save failed"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const resetForm = () => { setForm({ name: "", category: "新鲜食材", quantity: "", purchase_date: "", expiry_date: "", notes: "" }); setEditingItem(null); };

  const openEdit = (item: PantryItem) => {
    setEditingItem(item);
    setForm({ name: item.name, category: item.category || "新鲜食材", quantity: item.quantity || "", purchase_date: item.purchase_date || "", expiry_date: item.expiry_date || "", notes: item.notes || "" });
    setDialogOpen(true);
  };

  const filterLabel = (f: string) => (lang === "zh" ? f : FILTER_LABELS[f] || f);
  const statusLabel = (label: string) => (lang === "zh" ? label : STATUS_LABELS[label] || label);

  const editor = (
    <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("添加食材", "Add Item")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingItem ? t("编辑食材", "Edit Item") : t("添加食材", "Add Item")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="pantry-name">{t("名称", "Name")} *</Label><Input id="pantry-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label htmlFor="pantry-category">{t("分类", "Category")} *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger id="pantry-category"><SelectValue /></SelectTrigger>
              <SelectContent>{[
                ...(form.category && !CATEGORIES.includes(form.category as (typeof CATEGORIES)[number]) ? [form.category] : []),
                ...CATEGORIES,
              ].map((c) => <SelectItem key={c} value={c}>{lang === "zh" ? c : getCategoryLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="pantry-quantity">{t("数量", "Quantity")}</Label><Input id="pantry-quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder={lang === "zh" ? "如：1袋、500g" : "e.g. 1 bag, 500g"} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="pantry-purchase-date">{t("购入日期", "Purchase Date")}</Label><DateField id="pantry-purchase-date" label={t("购入日期", "Purchase Date")} value={form.purchase_date} onChange={(purchase_date) => setForm({ ...form, purchase_date })} /></div>
            <div><Label htmlFor="pantry-expiry-date">{t("保质期", "Expiry Date")}</Label><DateField id="pantry-expiry-date" label={t("保质期", "Expiry Date")} value={form.expiry_date} onChange={(expiry_date) => setForm({ ...form, expiry_date })} /></div>
          </div>
          <div><Label htmlFor="pantry-notes">{t("备注", "Notes")}</Label><Input id="pantry-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button onClick={handleSave} className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>{t("保存", "Save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout
      title={t("食材管理", "Pantry")}
      description={t("库存和保质期，一眼看清。", "What's at home, and what needs eating first.")}
      actions={editor}
      concept={items.length > 0 ? moduleFigure.pantry : undefined}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("搜索食材...", "Search pantry...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <ArcScope>
            <SegmentedControl
              label={t("按保质期筛选", "Filter by expiry")}
              value={filter}
              onValueChange={setFilter}
              options={FILTERS.map((f) => ({
                value: f,
                label: filterLabel(f),
                accessory: counts[f] ? <span aria-hidden className="ml-1.5 font-mono-data text-[11px] opacity-60">{counts[f]}</span> : undefined,
              }))}
            />
          </ArcScope>
        </div>

        {grouped.size === 0 ? (
          <CollectionFeedback loading={isLoading} error={error} retry={refetch}>
            <EmptyState figure={moduleFigure.pantry}
              title={items.length === 0 ? t("买菜回来，顺手记一笔", "Make room for something fresh") : t("没有符合条件的食材。", "Nothing matches.")}
              hint={items.length === 0 ? t("记下食材和保质期，下次打开就知道先吃什么。", "Add what you bought and its expiry date, so you know what to eat first.") : t("试试其他关键词，或查看全部食材。", "Try another keyword or view all pantry items.")}
              action={<Button variant={items.length === 0 ? "default" : "outline"} onClick={() => { if (items.length === 0) { resetForm(); setDialogOpen(true); } else { setSearch(""); setFilter("全部"); } }}>{items.length === 0 ? t("添加第一份食材", "Add your first item") : t("清除筛选", "Clear filters")}</Button>}
            />
          </CollectionFeedback>
        ) : (
          <div>
            {categoryOrder.filter((cat) => grouped.has(cat)).map((cat) => {
              const catItems = grouped.get(cat) || [];
              return (
                <section key={cat} className="row-group">
                  <h3 className="row-group-title">{lang === "zh" ? cat : getCategoryLabel(cat)}<span className="count" aria-hidden>{catItems.length}</span></h3>
                  <ul className="row-list">
                    {catItems.map((item: PantryItem, i: number) => {
                      const status = getStatus(item.expiry_date, today);
                      const note = expiryNote(status, lang);
                      return (
                        <li key={item.id} style={{ "--i": i } as CSSProperties} className="row-item enter-up">
                          <div className="row-main">
                            <span className="row-title truncate">{item.name}</span>
                            {item.quantity && <span className="row-meta">{item.quantity}</span>}
                            <span className="ml-auto flex items-baseline gap-3 sm:grid sm:grid-cols-[6.5rem_8.5rem]">
                              <span>{status.tone !== "ok" && <span className={`status-text tone-${status.tone}`}>{statusLabel(status.label)}</span>}</span>
                              {item.expiry_date && (
                                <span className="row-meta sm:text-right">
                                  {format(parseISO(item.expiry_date.slice(0, 10)), "MM/dd")}{note && ` · ${note}`}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="row-actions">
                            <Button variant="ghost" size="icon" aria-label={t("编辑食材", "Edit item")} className="h-8 w-8" onClick={() => openEdit(item)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" aria-label={t("删除食材", "Delete item")} className="h-8 w-8" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
