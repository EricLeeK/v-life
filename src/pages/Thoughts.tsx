import { markdownTypography } from "@/components/ui/typography";
import { moduleFigure } from "@/components/concepts/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectionFeedback } from "@/components/concepts/CollectionFeedback";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Edit2, FlaskConical, Home, Bot, Brain, Tag,
  Lightbulb, Sparkles, PenLine, BookOpen, Compass, Quote, Coffee, Moon, Sun,
  Cloud, Leaf, Heart, Star, Zap, Anchor, Music, Camera, Target, Clock, Feather, Mountain, Focus,
} from "lucide-react";
import { thoughtHooks, useSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLang } from "@/contexts/LanguageContext";
import { ThoughtZen, type ThoughtZenDraft } from "@/components/ThoughtZen";
import type { Tables } from "@/integrations/supabase/types";

const TAG_ICON_MAP: Record<string, React.ElementType> = {
  "科研": FlaskConical,
  "生活": Home,
  "AI": Bot,
  "杂念": Brain,
};

const PRESET_TAGS = [
  { tag: "科研" }, { tag: "生活" },
  { tag: "AI" }, { tag: "杂念" },
];

const TAG_LABELS: Record<string, string> = {
  "科研": "Research", "生活": "Life", "AI": "AI", "杂念": "Random",
};

type ThoughtRecord = Pick<Tables<"thoughts">, "id" | "title" | "content" | "tags" | "icon" | "created_at">;

function sameDraft(left: ThoughtZenDraft, right: ThoughtZenDraft) {
  return left.title === right.title && left.content === right.content;
}

/** Curated lucide set for thought icons — stored by name in thoughts.icon.
 *  Legacy rows with emoji strings still render through ThoughtIcon's fallback. */
const THOUGHT_ICONS: Record<string, React.ElementType> = {
  lightbulb: Lightbulb, sparkles: Sparkles, pen: PenLine, book: BookOpen,
  compass: Compass, quote: Quote, coffee: Coffee, moon: Moon, sun: Sun,
  cloud: Cloud, leaf: Leaf, heart: Heart, star: Star, zap: Zap,
  anchor: Anchor, music: Music, camera: Camera, target: Target,
  clock: Clock, feather: Feather, brain: Brain, mountain: Mountain,
};

/** Renders a stored thought icon: lucide by name (hairline 1.5), raw string
 *  (legacy emoji) otherwise, nothing when empty. */
function ThoughtIcon({ name, className }: { name?: string | null; className?: string }) {
  if (!name) return null;
  const Icon = THOUGHT_ICONS[name];
  if (Icon) return <Icon className={className ?? "h-4 w-4 text-muted-foreground"} strokeWidth={1.5} />;
  return <span className="text-lg leading-none">{name}</span>;
}

export default function ThoughtsPage() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ThoughtRecord | null>(null);
  const [form, setForm] = useState({ title: "", content: "", tags: [] as string[], icon: "", newTag: "" });
  const [zenOpen, setZenOpen] = useState(false);
  const [zenDraft, setZenDraft] = useState<ThoughtZenDraft>({ title: "", content: "" });
  const zenDraftRef = useRef(zenDraft);
  zenDraftRef.current = zenDraft;
  const [zenSaved, setZenSaved] = useState(false);
  const [zenThoughtId, setZenThoughtId] = useState<string | undefined>();
  const zenSavingRef = useRef(false);
  const zenTriggerRef = useRef<HTMLButtonElement>(null);
  const wasZenOpen = useRef(false);
  const { toast } = useToast();
  const { t, lang } = useLang();

  const { data: thoughtsData = [], isLoading, error, refetch } = thoughtHooks.useList();
  const thoughts = thoughtsData as ThoughtRecord[];
  const { data: settings } = useSettings();
  const createMutation = thoughtHooks.useCreate();
  const updateMutation = thoughtHooks.useUpdate();
  const deleteMutation = thoughtHooks.useDelete();

  useEffect(() => {
    if (wasZenOpen.current && !zenOpen) zenTriggerRef.current?.focus();
    wasZenOpen.current = zenOpen;
  }, [zenOpen]);

  const customThoughtTags = settings?.custom_thought_tags as string[] | null | undefined;
  const customTags = useMemo(() => customThoughtTags || [], [customThoughtTags]);

  // Collect all unique tags from actual thought data + presets + custom settings tags
  const allTags = useMemo(() => {
    const presetTagNames = PRESET_TAGS.map(p => p.tag);
    const dataTagSet = new Set<string>();
    thoughts.forEach((thought) => thought.tags?.forEach((tag) => dataTagSet.add(tag)));
    customTags.forEach(t => dataTagSet.add(t));

    // Preset tags always first, then additional tags from data/settings (not in presets)
    const extraTags = Array.from(dataTagSet).filter(t => !presetTagNames.includes(t));
    return [
      ...PRESET_TAGS,
      ...extraTags.map(tag => ({ tag })),
    ];
  }, [thoughts, customTags]);

  const filtered = selectedTag
    ? thoughts.filter((thought) => thought.tags?.includes(selectedTag))
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
    if (!form.content) { toast({ title: t("请填写内容", "Please fill content"), variant: "destructive" }); return; }
    try {
      const payload = { title: form.title || null, content: form.content, tags: form.tags, icon: form.icon || null };
      if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      else await createMutation.mutateAsync(payload);
      setDialogOpen(false); setEditingItem(null); setForm({ title: "", content: "", tags: [], icon: "", newTag: "" });
    } catch (error: unknown) { toast({ title: t("保存失败", "Save failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" }); }
  };

  const openEdit = (item: ThoughtRecord) => {
    setEditingItem(item);
    setForm({ title: item.title || "", content: item.content, tags: item.tags || [], icon: item.icon || "", newTag: "" });
    setDialogOpen(true);
  };

  const saveZenThought = async (draft: ThoughtZenDraft) => {
    if (zenSavingRef.current) throw new Error(t("正在保存，请稍候。", "A save is already in progress."));
    zenSavingRef.current = true;
    try {
      const existing = zenThoughtId ? thoughts.find((thought) => thought.id === zenThoughtId) : undefined;
      const payload = { title: draft.title.trim() || null, content: draft.content, tags: existing?.tags || [], icon: existing?.icon || null };
      if (zenThoughtId) {
        await updateMutation.mutateAsync({ id: zenThoughtId, ...payload });
      } else {
        const created = await createMutation.mutateAsync(payload) as Pick<ThoughtRecord, "id">;
        if (created?.id) setZenThoughtId(created.id);
      }
      if (sameDraft(zenDraftRef.current, draft)) setZenSaved(true);
    } finally {
      zenSavingRef.current = false;
    }
  };

  const openZenEdit = async (thought: ThoughtRecord) => {
    const currentDraft = { ...zenDraftRef.current };
    if (!zenSaved && (currentDraft.content.trim() || currentDraft.title.trim())) {
      if (!currentDraft.content.trim()) {
        toast({ title: t("随想尚未保存", "Thought is not saved"), description: t("先补充内容，再切换到另一条随想。", "Add content before switching to another thought."), variant: "destructive" });
        return;
      }
      try {
        await saveZenThought(currentDraft);
      } catch (error: unknown) {
        toast({ title: t("保存失败", "Save failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
        return;
      }
      if (!sameDraft(zenDraftRef.current, currentDraft)) {
        toast({ title: t("随想有新的修改", "Thought changed"), description: t("保存期间内容又有变化，请再次保存后切换。", "The draft changed during saving. Save again before switching."), variant: "destructive" });
        return;
      }
    }
    setZenThoughtId(thought.id);
    setZenDraft({ title: thought.title || "", content: thought.content || "" });
    setZenSaved(true);
    setZenOpen(true);
  };

  const startNewZenThought = async () => {
    const currentDraft = { ...zenDraftRef.current };
    if (!zenSaved && currentDraft.content.trim()) {
      await saveZenThought(currentDraft);
      if (!sameDraft(zenDraftRef.current, currentDraft)) {
        throw new Error(t("保存期间内容又有变化，草稿已保留。", "The draft changed during saving and has been kept."));
      }
    } else if (!zenSaved && currentDraft.title.trim()) {
      throw new Error(t("先写下一些内容，再开始新随想。", "Write some content before starting another thought."));
    }
    setZenThoughtId(undefined);
    setZenDraft({ title: "", content: "" });
    setZenSaved(false);
  };

  const updateZenDraft = (draft: ThoughtZenDraft) => {
    zenDraftRef.current = draft;
    setZenDraft(draft);
    setZenSaved(false);
  };

  return (
    <AppLayout title={t("随想", "Thoughts")} description={t("把一闪而过的念头，留在这里。", "A place for passing thoughts.")} concept={thoughts.length > 0 ? moduleFigure.thoughts : undefined}>
      <div className="space-y-4" inert={zenOpen} aria-hidden={zenOpen || undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={!selectedTag ? "default" : "secondary"} size="sm" onClick={() => setSelectedTag(null)}>{t("全部", "All")}</Button>
          {allTags.map(({ tag }) => {
            const TagIcon = TAG_ICON_MAP[tag] || Tag;
            return (
              <Button key={tag} variant={selectedTag === tag ? "default" : "secondary"} size="sm" onClick={() => setSelectedTag(tag)}>
                <TagIcon className="h-4 w-4 mr-1" />{lang === "zh" ? tag : (TAG_LABELS[tag] || tag)}
              </Button>
            );
          })}
          <div className="flex-1" />
          <Button ref={zenTriggerRef} variant="outline" size="sm" onClick={() => setZenOpen(true)}>
            <PenLine className="h-4 w-4 mr-1" />{t("专注写作", "Focus writing")}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingItem(null); setForm({ title: "", content: "", tags: [], icon: "", newTag: "" }); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("新随想", "New Thought")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingItem ? t("编辑随想", "Edit Thought") : t("新随想", "New Thought")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_60px] gap-2">
                  <div><Label htmlFor="thought-title">{t("标题（可选）", "Title (optional)")}</Label><Input id="thought-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div>
                    <Label htmlFor="thought-icon">{t("图标", "Icon")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="thought-icon"
                          type="button"
                          variant="outline"
                          aria-label={t("选择图标", "Pick an icon")}
                          title={t("再次点击已选图标可移除", "Click the selected icon again to remove it")}
                          className="w-full h-9 px-0 justify-center"
                        >
                          {form.icon ? (
                            <ThoughtIcon name={form.icon} className="h-4 w-4 text-foreground" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.5} />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="end">
                        <div className="grid grid-cols-6 gap-1">
                          {Object.entries(THOUGHT_ICONS).map(([name, Icon]) => {
                            const active = form.icon === name;
                            return (
                              <button
                                key={name}
                                type="button"
                                aria-label={name}
                                aria-pressed={active}
                                onClick={() => setForm((f) => ({ ...f, icon: active ? "" : name }))}
                                className={`h-8 w-8 rounded-md inline-flex items-center justify-center transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                <Icon className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div><Label htmlFor="thought-content">{t("内容", "Content")} * (Markdown)</Label><Textarea id="thought-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} /></div>
                <div>
                  <Label htmlFor="thought-new-tag">{t("标签", "Tags")}</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {allTags.map(({ tag }) => {
                      const TagIcon = TAG_ICON_MAP[tag] || Tag;
                      return (
                        <Button key={tag} variant={form.tags.includes(tag) ? "default" : "secondary"} size="sm" className="h-7 text-xs" onClick={() => toggleTag(tag)}>
                          <TagIcon className="h-4 w-4 mr-1" />{lang === "zh" ? tag : (TAG_LABELS[tag] || tag)}
                        </Button>
                      );
                    })}
                    {/* Show any form tags not in allTags (newly added) */}
                    {form.tags.filter(t => !allTags.some(at => at.tag === t)).map(tag => (
                      <Button key={tag} variant="default" size="sm" className="h-7 text-xs" onClick={() => toggleTag(tag)}>
                        <Tag className="h-4 w-4 mr-1" />{tag}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input id="thought-new-tag" value={form.newTag} onChange={(e) => setForm({ ...form, newTag: e.target.value })}
                      placeholder={t("添加新标签", "Add new tag")} className="flex-1 h-8 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())} />
                    <Button size="sm" className="h-8 text-xs" onClick={addCustomTag}>+</Button>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full">{t("保存", "Save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {filtered.length === 0 ? (
          <CollectionFeedback loading={isLoading} error={error} retry={refetch}>
            <EmptyState figure={moduleFigure.thoughts}
              title={selectedTag ? t("这个标签下还没有随想", "No thoughts with this tag") : t("先留下一个念头", "Leave a thought here")}
              hint={selectedTag ? t("换个标签，看看其他记录。", "Choose another tag to find your thoughts.") : t("一句话、一个问题，或今天值得记住的小事。", "A sentence, a question, or something worth remembering.")}
              action={<Button variant={selectedTag ? "outline" : "default"} onClick={() => selectedTag ? setSelectedTag(null) : setDialogOpen(true)}>{selectedTag ? t("查看全部", "View all") : t("写下第一条随想", "Write your first thought")}</Button>}
            />
          </CollectionFeedback>
        ) : (
          /* Masonry layout using CSS columns */
          <div className="thought-masonry" role="list" aria-label={t("随想卡片", "Thought cards")}>
            {filtered.map((thought, i) => (
              <Card key={thought.id} role="listitem" style={{ "--i": i } as React.CSSProperties & { "--i": number }} className="thought-card enter-up hover:border-primary/20 transition-colors overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {thought.icon && <ThoughtIcon name={thought.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="font-medium text-sm truncate">{thought.title || thought.content.split("\n")[0].slice(0, 30)}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" aria-label={t("编辑随想", "Edit thought")} className="h-7 w-7" onClick={() => openEdit(thought)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" aria-label={t("专注编辑随想", "Focus edit thought")} className="h-7 w-7" onClick={() => { void openZenEdit(thought); }}><Focus className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" aria-label={t("删除随想", "Delete thought")} className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(thought.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="thought-card-markdown">
                    <ReactMarkdown components={markdownTypography} remarkPlugins={[remarkGfm]}>{thought.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {thought.tags?.map((tag: string) => {
                      const TagIcon = TAG_ICON_MAP[tag] || Tag;
                      return <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1"><TagIcon className="h-3 w-3" />{lang === "zh" ? tag : (TAG_LABELS[tag] || tag)}</Badge>;
                    })}
                    <span className="text-xs text-muted-foreground ml-auto">{format(new Date(thought.created_at), "MM/dd HH:mm")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {zenOpen && (
        <ThoughtZen
          draft={zenDraft}
          saved={zenSaved}
          onDraftChange={updateZenDraft}
          onSave={saveZenThought}
          onStartNew={startNewZenThought}
          onExit={() => setZenOpen(false)}
        />
      )}
    </AppLayout>
  );
}
