import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { thoughtHooks, useSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PRESET_TAGS = [
  { tag: "科研", emoji: "🔬" }, { tag: "生活", emoji: "🏠" },
  { tag: "AI", emoji: "🤖" }, { tag: "杂念", emoji: "💭" },
];

export default function ThoughtsPage() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", tags: [] as string[], icon: "", newTag: "" });
  const { toast } = useToast();

  const { data: thoughts = [] } = thoughtHooks.useList();
  const { data: settings } = useSettings();
  const createMutation = thoughtHooks.useCreate();
  const updateMutation = thoughtHooks.useUpdate();
  const deleteMutation = thoughtHooks.useDelete();

  const customTags = (settings?.custom_thought_tags as string[] | null) || [];

  // Collect all unique tags from actual thought data + presets + custom settings tags
  const allTags = useMemo(() => {
    const presetTagNames = PRESET_TAGS.map(p => p.tag);
    const dataTagSet = new Set<string>();
    thoughts.forEach((t: any) => t.tags?.forEach((tag: string) => dataTagSet.add(tag)));
    customTags.forEach(t => dataTagSet.add(t));

    // Preset tags always first, then additional tags from data/settings (not in presets)
    const extraTags = Array.from(dataTagSet).filter(t => !presetTagNames.includes(t));
    return [
      ...PRESET_TAGS,
      ...extraTags.map(tag => ({ tag, emoji: "🏷️" })),
    ];
  }, [thoughts, customTags]);

  const filtered = selectedTag
    ? thoughts.filter((t: any) => t.tags?.includes(selectedTag))
    : thoughts;

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const addCustomTag = () => {
    const tag = form.newTag.trim();
    if (!tag || form.tags.includes(tag)) return;
    setForm(f => ({ ...f, tags: [...f.tags, tag], newTag: "" }));
  };

  const handleSave = async () => {
    if (!form.content) { toast({ title: "请填写内容", variant: "destructive" }); return; }
    try {
      const payload = { title: form.title || null, content: form.content, tags: form.tags, icon: form.icon || null };
      if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      else await createMutation.mutateAsync(payload);
      setDialogOpen(false); setEditingItem(null); setForm({ title: "", content: "", tags: [], icon: "", newTag: "" });
    } catch (e: any) { toast({ title: "保存失败", description: e.message, variant: "destructive" }); }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({ title: item.title || "", content: item.content, tags: item.tags || [], icon: item.icon || "", newTag: "" });
    setDialogOpen(true);
  };

  return (
    <AppLayout title="随想">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={!selectedTag ? "default" : "secondary"} size="sm" onClick={() => setSelectedTag(null)}>全部</Button>
          {allTags.map(({ tag, emoji }) => (
            <Button key={tag} variant={selectedTag === tag ? "default" : "secondary"} size="sm" onClick={() => setSelectedTag(tag)}>
              {emoji} {tag}
            </Button>
          ))}
          <div className="flex-1" />
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingItem(null); setForm({ title: "", content: "", tags: [], icon: "", newTag: "" }); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />新随想</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingItem ? "编辑随想" : "新随想"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_60px] gap-2">
                  <div><Label>标题（可选）</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label>图标</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="😊" className="text-center" /></div>
                </div>
                <div><Label>内容 *（支持 Markdown）</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} /></div>
                <div>
                  <Label>标签</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {allTags.map(({ tag, emoji }) => (
                      <Button key={tag} variant={form.tags.includes(tag) ? "default" : "secondary"} size="sm" className="h-7 text-xs" onClick={() => toggleTag(tag)}>
                        {emoji} {tag}
                      </Button>
                    ))}
                    {/* Show any form tags not in allTags (newly added) */}
                    {form.tags.filter(t => !allTags.some(at => at.tag === t)).map(tag => (
                      <Button key={tag} variant="default" size="sm" className="h-7 text-xs" onClick={() => toggleTag(tag)}>
                        🏷️ {tag}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input value={form.newTag} onChange={(e) => setForm({ ...form, newTag: e.target.value })}
                      placeholder="添加新标签" className="flex-1 h-8 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())} />
                    <Button size="sm" className="h-8 text-xs" onClick={addCustomTag}>+</Button>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full">保存</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">暂无随想</p>
        ) : (
          /* Masonry layout using CSS columns */
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {filtered.map((thought: any) => (
              <Card key={thought.id} className="break-inside-avoid hover:border-primary/20 transition-colors overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {thought.icon && <span className="text-lg">{thought.icon}</span>}
                      <span className="font-medium text-sm truncate">{thought.title || thought.content.split("\n")[0].slice(0, 30)}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(thought)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(thought.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{thought.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {thought.tags?.map((tag: string) => {
                      const preset = allTags.find((t) => t.tag === tag);
                      return <Badge key={tag} variant="secondary" className="text-xs">{preset?.emoji || "🏷️"} {tag}</Badge>;
                    })}
                    <span className="text-xs text-muted-foreground ml-auto">{format(new Date(thought.created_at), "MM/dd HH:mm")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
