import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { todoHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";

const IMPORTANCE_LEVELS = [
  { key: "紧急", color: "bg-destructive/20 text-destructive" },
  { key: "重要", color: "bg-warning/20 text-warning" },
  { key: "普通", color: "bg-primary/20 text-primary" },
  { key: "低优先", color: "bg-muted text-muted-foreground" },
] as const;

type ViewMode = "category" | "importance" | "all";

export default function TodosPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("category");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", detail: "", importance: "普通", category: "未分类" });
  const [hideCompleted, setHideCompleted] = useState(false);
  const { toast } = useToast();

  const { data: todos = [] } = todoHooks.useList();
  const createMutation = todoHooks.useCreate();
  const updateMutation = todoHooks.useUpdate();
  const deleteMutation = todoHooks.useDelete();

  const filteredTodos = hideCompleted ? todos.filter((t: any) => !t.is_completed) : todos;

  // Sort: incomplete first, then by importance
  const importanceOrder: Record<string, number> = { "紧急": 0, "重要": 1, "普通": 2, "低优先": 3 };
  const sorted = [...filteredTodos].sort((a: any, b: any) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return (importanceOrder[a.importance] ?? 2) - (importanceOrder[b.importance] ?? 2);
  });

  const grouped = viewMode === "category"
    ? sorted.reduce((acc: Record<string, any[]>, t: any) => { (acc[t.category] = acc[t.category] || []).push(t); return acc; }, {})
    : viewMode === "importance"
    ? sorted.reduce((acc: Record<string, any[]>, t: any) => { (acc[t.importance] = acc[t.importance] || []).push(t); return acc; }, {})
    : { "全部": sorted };

  const handleSave = async () => {
    if (!form.title) { toast({ title: "请填写标题", variant: "destructive" }); return; }
    try {
      await createMutation.mutateAsync({ title: form.title, detail: form.detail || null, importance: form.importance, category: form.category });
      setDialogOpen(false); setForm({ title: "", detail: "", importance: "普通", category: "未分类" });
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const toggleComplete = (item: any) => {
    updateMutation.mutate({ id: item.id, is_completed: !item.is_completed });
  };

  const TodoItem = ({ item }: { item: any }) => {
    const imp = IMPORTANCE_LEVELS.find((l) => l.key === item.importance);
    const [expanded, setExpanded] = useState(false);
    return (
      <Card className={`transition-colors ${item.is_completed ? "opacity-50" : "hover:border-primary/20"}`}>
        <CardContent className="p-2 px-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={item.is_completed} onCheckedChange={() => toggleComplete(item)} />
            <span className={`text-sm flex-1 ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
            <Badge variant="secondary" className={`text-xs ${imp?.color}`}>{item.importance}</Badge>
            {item.detail && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
          {expanded && item.detail && <p className="text-xs text-muted-foreground mt-2 pl-6">{item.detail}</p>}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout title="待办事项">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(["category", "importance", "all"] as const).map((mode) => (
              <Button key={mode} variant={viewMode === mode ? "default" : "secondary"} size="sm"
                onClick={() => setViewMode(mode)}>
                {mode === "category" ? "按分类" : mode === "importance" ? "按重要性" : "全览"}
              </Button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setHideCompleted(!hideCompleted)}>
            {hideCompleted ? "显示已完成" : "隐藏已完成"}
          </Button>
          <div className="flex-1" />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />添加待办</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>添加待办</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>标题 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>详细说明</Label><Input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>重要性</Label>
                    <Select value={form.importance} onValueChange={(v) => setForm({ ...form, importance: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{IMPORTANCE_LEVELS.map((l) => <SelectItem key={l.key} value={l.key}>{l.key}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>分类</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="未分类" /></div>
                </div>
                <Button onClick={handleSave} className="w-full">添加</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">暂无待办事项</p>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              {viewMode !== "all" && <h3 className="text-sm font-medium text-muted-foreground mb-2">{group}</h3>}
              <div className="space-y-1">
                {(items as any[]).map((item) => <TodoItem key={item.id} item={item} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
