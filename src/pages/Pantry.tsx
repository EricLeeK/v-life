import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import { pantryHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

const CATEGORIES = ["新鲜食材", "零食", "调料", "主食/干货", "饮品", "冷冻食品"] as const;
const FILTERS = ["全部", "即将过期", "已过期"] as const;

function getStatus(expiryDate: string | null): { label: string; color: string } {
  if (!expiryDate) return { label: "充足", color: "bg-success/20 text-success" };
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: "已过期", color: "bg-destructive/20 text-destructive" };
  if (days <= 3) return { label: "即将耗尽", color: "bg-warning/20 text-warning" };
  return { label: "充足", color: "bg-success/20 text-success" };
}

export default function PantryPage() {
  const [filter, setFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "新鲜食材" as string, quantity: "", purchase_date: "", expiry_date: "", notes: "" });
  const { toast } = useToast();

  const { data: items = [], isLoading } = pantryHooks.useList();
  const createMutation = pantryHooks.useCreate();
  const updateMutation = pantryHooks.useUpdate();
  const deleteMutation = pantryHooks.useDelete();

  const filtered = items.filter((item: any) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "即将过期") {
      const status = getStatus(item.expiry_date);
      return status.label === "即将耗尽";
    }
    if (filter === "已过期") {
      const status = getStatus(item.expiry_date);
      return status.label === "已过期";
    }
    return true;
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter((i: any) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, any[]>);

  const handleSave = async () => {
    if (!form.name || !form.category) { toast({ title: "请填写名称和分类", variant: "destructive" }); return; }
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, ...form, purchase_date: form.purchase_date || null, expiry_date: form.expiry_date || null });
      } else {
        await createMutation.mutateAsync({ ...form, purchase_date: form.purchase_date || null, expiry_date: form.expiry_date || null });
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const resetForm = () => { setForm({ name: "", category: "新鲜食材", quantity: "", purchase_date: "", expiry_date: "", notes: "" }); setEditingItem(null); };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({ name: item.name, category: item.category, quantity: item.quantity || "", purchase_date: item.purchase_date || "", expiry_date: item.expiry_date || "", notes: item.notes || "" });
    setDialogOpen(true);
  };

  return (
    <AppLayout title="食材管理">
      <div className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索食材..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <Button key={f} variant={filter === f ? "default" : "secondary"} size="sm" onClick={() => setFilter(f)}>{f}</Button>
            ))}
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />添加食材</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingItem ? "编辑食材" : "添加食材"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>名称 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>分类 *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>数量</Label><Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="如：1袋、500g" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>购入日期</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
                  <div><Label>保质期</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
                </div>
                <div><Label>备注</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleSave} className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>保存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : Object.keys(grouped).length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">暂无食材记录</p>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h3>
              <div className="space-y-1">
                {catItems.map((item: any) => {
                  const status = getStatus(item.expiry_date);
                  return (
                    <Card key={item.id} className="hover:border-primary/20 transition-colors">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          {item.quantity && <span className="text-xs text-muted-foreground">{item.quantity}</span>}
                          <Badge variant="secondary" className={`text-xs ${status.color}`}>{status.label}</Badge>
                          {item.expiry_date && <span className="text-xs text-muted-foreground">{format(new Date(item.expiry_date), "MM/dd")}</span>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Edit2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
