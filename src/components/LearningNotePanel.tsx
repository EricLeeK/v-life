import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  BookOpen,
  Edit2,
  Eye,
  Plus,
  Save,
  Trash2,
  Sparkles,
  Wand2,
  FileText,
  Check,
  Copy,
  Loader2,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { messageFromAiInvoke } from "@/lib/aiErrors";
import type { Tables } from "@/integrations/supabase/types";

type LearningCourse = Tables<"learning_courses">;
type LearningNote = Tables<"learning_notes">;
export type LearningNoteCreateValues = Pick<LearningNote, "course_id" | "title" | "content" | "tags" | "note_date">;
export type LearningNoteSaveValues = LearningNoteCreateValues & { id: string };
export type LearningNoteDeleteValues = Pick<LearningNote, "id" | "course_id">;

interface LearningNotePanelProps {
  course: LearningCourse;
  notes: LearningNote[];
  onCreateNote: (values: LearningNoteCreateValues) => Promise<LearningNote | undefined> | LearningNote | undefined;
  onSaveNote: (values: LearningNoteSaveValues) => Promise<unknown> | unknown;
  onDeleteNote: (values: LearningNoteDeleteValues) => Promise<unknown> | unknown;
}

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function tagsToText(tags: string[] | null | undefined) {
  return (tags || []).join(", ");
}

function textToTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const POLISH_PROMPTS = {
  academic: "请对以下学习笔记内容进行【学术与技术规范化润色】。要求：1. 纠正错别字与语法错误；2. 规范学术/技术专业术语；3. 采用严谨、流畅、客观的学术表达；4. 严禁改变或遗漏原始笔记中的核心知识点与结论。保持 Markdown 格式不变。",
  accessible: "请对以下学习笔记内容进行【通俗易懂化重写】。要求：1. 用生动清晰、通俗易懂的语言解释复杂概念；2. 适当使用直观比喻或生活化场景帮助理解；3. 保持结构层次清晰；4. 保持核心知识点准确。保持 Markdown 格式不变。",
  concise: "请对以下学习笔记内容进行【逻辑提炼与精简】。要求：1. 提取核心干货与要点；2. 去除废话与冗余修饰；3. 采用清晰的层次结构与列表展现；4. 保留所有关键数据与结论。保持 Markdown 格式不变。",
  elaborate: "请对以下学习笔记内容进行【专业深度扩充】。要求：1. 在保留原笔记全部内容的基础上，补充相关的背景知识、核心定义释义；2. 对关键推导或原理进行进一步说明；3. 补充易错点提示或总结。保持 Markdown 格式不变。",
};

const FORMAT_PROMPT = `你是一位精通 Markdown 和 Obsidian 知识管理的排版专家。请对以下学习笔记进行【Obsidian 级别的 Markdown 格式排版优化】。

优化规则：
1. **层级标题**：根据内容逻辑结构，合理添加或调整 Markdown 标题 (#, ##, ###)，使大纲一目了然。
2. **段落与空行**：段落、标题、公式块、代码块之间增加合理空行，保持良好呼吸感。
3. **列表与缩进**：适合列举的内容改写为无序列表 (- ) 或有序列表 (1. )，嵌套要点保持 2~4 空格缩进。
4. **重点高亮**：对核心概念、关键术语、核心结论进行 **加粗** 或 \`行内代码\` 强调。
5. **数学公式标准化**：自动识别数学表达式，将其规范书写为标准 LaTeX 格式（行内公式用 $ ... $，独立块公式用 $$ ... $$）。
6. **引用块**：将核心直觉、总结、重要提醒提炼为引用块 (> )。
7. **代码块**：包含代码时使用带有语言标识的代码块 (\`\`\`python, \`\`\`js 等)。
8. **忠实原文**：绝不改变或删减笔记原本的思想、事实与知识点内容，只重构排版视觉体验。

只直接返回优化后的 Markdown 文本，不要包含任何前言或总结废话。`;

export function LearningNotePanel({ course, notes, onCreateNote, onSaveNote, onDeleteNote }: LearningNotePanelProps) {
  const { t } = useLang();
  const { toast } = useToast();
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(() => notes[0]?.id);
  const [draftNoteId, setDraftNoteId] = useState<string | undefined>(() => notes[0]?.id);
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState(() => ({
    title: notes[0]?.title || "",
    content: notes[0]?.content || "",
    tagsText: tagsToText(notes[0]?.tags),
    note_date: notes[0]?.note_date || todayString(),
  }));

  // AI Note Assistant Dialog State
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiToolMode, setAiToolMode] = useState<"polish" | "format">("polish");
  const [polishStyle, setPolishStyle] = useState<"academic" | "accessible" | "concise" | "elaborate">("academic");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || notes[0],
    [notes, selectedNoteId],
  );

  useEffect(() => {
    if (!selectedNote && notes.length === 0) {
      setSelectedNoteId(undefined);
      setDraftNoteId(undefined);
      setForm({ title: "", content: "", tagsText: "", note_date: todayString() });
      setIsDirty(false);
      return;
    }

    if (selectedNote && selectedNote.id !== selectedNoteId) {
      setSelectedNoteId(selectedNote.id);
    }

    if (selectedNote && (draftNoteId !== selectedNote.id || !isDirty)) {
      setForm({
        title: selectedNote.title || "",
        content: selectedNote.content || "",
        tagsText: tagsToText(selectedNote.tags),
        note_date: selectedNote.note_date || todayString(),
      });
      setDraftNoteId(selectedNote.id);
      setIsDirty(false);
    }
  }, [notes, selectedNote, selectedNoteId, draftNoteId, isDirty]);

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);
    setActiveTab("preview");
  };

  const handleCreate = async () => {
    const created = await onCreateNote({
      course_id: course.id,
      title: t("新笔记", "New Note"),
      content: "",
      tags: [],
      note_date: todayString(),
    });
    if (created?.id) {
      setSelectedNoteId(created.id);
      setDraftNoteId(created.id);
      setForm({
        title: created.title || t("新笔记", "New Note"),
        content: created.content || "",
        tagsText: tagsToText(created.tags),
        note_date: created.note_date || todayString(),
      });
      setIsDirty(false);
      setActiveTab("edit");
    }
  };

  const handleSave = async () => {
    if (!selectedNote) return;
    await onSaveNote({
      id: selectedNote.id,
      course_id: course.id,
      title: form.title.trim() || t("未命名笔记", "Untitled Note"),
      content: form.content,
      tags: textToTags(form.tagsText),
      note_date: form.note_date || null,
    });
    setIsDirty(false);
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    await onDeleteNote({ id: selectedNote.id, course_id: course.id });
    const remaining = notes.filter((note) => note.id !== selectedNote.id);
    setSelectedNoteId(remaining[0]?.id);
    setDraftNoteId(remaining[0]?.id);
    setIsDirty(false);
    setActiveTab("preview");
  };

  const handleOpenAiDialog = (mode: "polish" | "format" = "polish") => {
    setAiToolMode(mode);
    setGeneratedResult(null);
    setCopied(false);
    setIsAiDialogOpen(true);
  };

  const handleRunAi = async () => {
    if (!form.content.trim()) {
      toast({
        title: t("笔记内容为空", "Note content is empty"),
        description: t("请先在笔记中输入内容，再使用 AI 优化助手。", "Please enter note content first."),
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      let systemInstruction = "";
      if (aiToolMode === "format") {
        systemInstruction = FORMAT_PROMPT;
      } else {
        if (customPrompt.trim()) {
          systemInstruction = `你是一位专业的内容编辑。请对学习笔记进行优化，具体要求：${customPrompt.trim()}。请保持知识点准确，按 Markdown 格式直接输出结果，不要包含任何对话废话。`;
        } else {
          systemInstruction = POLISH_PROMPTS[polishStyle];
        }
      }

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: form.content },
          ],
          mode: "direct",
        },
      });

      const errText = await messageFromAiInvoke(data, error);
      if (errText) {
        toast({ title: t("AI 优化失败", "AI Optimization Failed"), description: errText, variant: "destructive" });
        return;
      }

      let content = typeof data?.content === "string" ? data.content.trim() : "";
      content = content.replace(/^```markdown\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

      setGeneratedResult(content);
      toast({ title: t("AI 优化成功", "AI Optimization Complete") });
    } catch (e: any) {
      toast({ title: t("调用异常", "Invocation error"), description: e.message || String(e), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAiResult = () => {
    if (!generatedResult) return;
    setForm((prev) => ({ ...prev, content: generatedResult }));
    setIsDirty(true);
    setIsAiDialogOpen(false);
    setActiveTab("preview");
    toast({ title: t("已应用 AI 优化内容并切回预览", "Applied to note content") });
  };

  const handleCopyResult = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: t("已复制到剪贴板", "Copied to clipboard") });
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: course.color || "#5b88b5" }} />
              <h2 className="text-lg font-semibold text-foreground truncate">{course.name}</h2>
            </div>
            {course.description && <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>}
          </div>
          <Button onClick={handleCreate} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" />
            {t("新建笔记", "New Note")}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground px-6">
          <BookOpen className="h-10 w-10 mb-3 opacity-60" />
          <p className="text-sm font-medium text-foreground">{t("这个课程还没有笔记", "No notes in this course yet")}</p>
          <p className="text-xs mt-1">{t("添加第一条 Markdown 学习笔记。", "Add your first Markdown learning note.")}</p>
          <Button onClick={handleCreate} size="sm" className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" />
            {t("新建笔记", "New Note")}
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className="min-h-0 border-b lg:border-b-0 lg:border-r border-border bg-card">
            <div className="max-h-56 lg:max-h-none lg:h-full overflow-y-auto p-3 space-y-2">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => handleSelectNote(note.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                    selectedNote?.id === note.id
                      ? "border-primary/30 bg-muted"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground truncate">{note.title}</span>
                  <span className="block mt-1 text-[11px] text-muted-foreground">
                    {note.note_date ? format(new Date(`${note.note_date}T00:00:00`), "yyyy/MM/dd") : t("未设置日期", "No date")}
                  </span>
                  {(note.tags || []).length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">
                      {(note.tags || []).slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <section className="min-h-0 flex flex-col p-4">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "preview" | "edit")} className="min-h-0 flex-1 flex flex-col">
              <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
                <TabsList>
                  <TabsTrigger value="preview">
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    {t("预览", "Preview")}
                  </TabsTrigger>
                  <TabsTrigger value="edit">
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    {t("编辑", "Edit")}
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  {/* AI Assistant Menu Button */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:text-amber-900 shadow-2xs font-medium text-xs h-8"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-600 animate-pulse" />
                        {t("AI 助手", "AI Assistant")}
                        <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-md">
                      <DropdownMenuItem
                        onClick={() => handleOpenAiDialog("polish")}
                        className="cursor-pointer text-xs rounded-lg py-2"
                      >
                        <Wand2 className="h-4 w-4 mr-2 text-indigo-500" />
                        <span>{t("✨ 内容润色", "✨ Content Polish")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenAiDialog("format")}
                        className="cursor-pointer text-xs rounded-lg py-2"
                      >
                        <FileText className="h-4 w-4 mr-2 text-emerald-500" />
                        <span>{t("🎨 格式排版优化", "🎨 Format Optimization")}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {activeTab === "preview" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("edit")}
                      className="border-border text-foreground hover:bg-muted text-xs h-8"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      {t("编辑笔记", "Edit Note")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleDelete} className="border-border text-destructive hover:text-destructive text-xs h-8">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {t("删除", "Delete")}
                  </Button>
                  <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8">
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {t("保存", "Save")}
                  </Button>
                </div>
              </div>

              <TabsContent value="preview" className="mt-0 min-h-0 flex-1">
                <div className="h-full min-h-[360px] overflow-y-auto rounded-2xl border border-border bg-card p-6">
                  <div className="mb-6 border-b border-border pb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground tracking-tight">{form.title || t("未命名笔记", "Untitled Note")}</h3>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {form.note_date && <span className="font-mono bg-muted/60 px-2 py-0.5 rounded-md">{format(new Date(`${form.note_date}T00:00:00`), "yyyy/MM/dd")}</span>}
                        {textToTags(form.tagsText).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[11px] px-2 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("edit")}
                      className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      {t("编辑", "Edit")}
                    </Button>
                  </div>
                  <div className="obsidian-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {form.content || t("*(尚无内容)*", "*(No content yet)*")}
                    </ReactMarkdown>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="edit" className="mt-0 min-h-0 flex-1">
                <div className="h-full min-h-0 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
                    <div>
                      <Label htmlFor="learning-note-title" className="text-foreground text-sm">{t("标题", "Title")}</Label>
                      <Input
                        id="learning-note-title"
                        value={form.title}
                        onChange={(e) => { setForm({ ...form, title: e.target.value }); setIsDirty(true); }}
                        className="border-border text-foreground"
                      />
                    </div>
                    <div>
                      <Label htmlFor="learning-note-date" className="text-foreground text-sm">{t("日期", "Date")}</Label>
                      <Input
                        id="learning-note-date"
                        type="date"
                        value={form.note_date}
                        onChange={(e) => { setForm({ ...form, note_date: e.target.value }); setIsDirty(true); }}
                        className="border-border text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="learning-note-tags" className="text-foreground text-sm">{t("标签（逗号分隔）", "Tags (comma separated)")}</Label>
                    <Input
                      id="learning-note-tags"
                      value={form.tagsText}
                      onChange={(e) => { setForm({ ...form, tagsText: e.target.value }); setIsDirty(true); }}
                      placeholder={t("例如：lecture, 重点", "e.g. lecture, important")}
                      className="border-border text-foreground"
                    />
                  </div>
                  <div className="min-h-0 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="learning-note-content" className="text-foreground text-sm">{t("内容", "Content")} (Markdown + LaTeX)</Label>
                      <span className="text-[11px] text-muted-foreground font-mono">支持 $E=mc^2$, $$\int f(x)dx$$, - [ ] 列表</span>
                    </div>
                    <Textarea
                      id="learning-note-content"
                      value={form.content}
                      onChange={(e) => { setForm({ ...form, content: e.target.value }); setIsDirty(true); }}
                      className="min-h-[300px] flex-1 resize-none border-border text-foreground font-mono text-sm leading-relaxed p-3"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}

      {/* AI Note Assistant Dialog */}
      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader className="pb-2 border-b border-border flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-amber-500" />
              {t("AI 笔记优化助手", "AI Note Assistant")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-5">
            {/* Mode Switcher Pills */}
            <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => { setAiToolMode("polish"); setGeneratedResult(null); }}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  aiToolMode === "polish"
                    ? "bg-white text-stone-900 shadow-2xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t("✨ 内容润色", "✨ Content Polish")}
              </button>
              <button
                type="button"
                onClick={() => { setAiToolMode("format"); setGeneratedResult(null); }}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  aiToolMode === "format"
                    ? "bg-white text-stone-900 shadow-2xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t("🎨 格式排版优化", "🎨 Format Optimization")}
              </button>
            </div>

            {/* Mode 1: Polish Options */}
            {aiToolMode === "polish" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-stone-700 mb-2 block">{t("选择预设润色风格", "Select Preset Style")}</Label>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      { key: "academic", label: "🎓 学术规范", desc: "规范学术术语与严谨口吻" },
                      { key: "accessible", label: "💡 通俗易懂", desc: "生动比喻与浅显表达拆解难点" },
                      { key: "concise", label: "⚡ 逻辑精简", desc: "提炼核心干货并去除冗余" },
                      { key: "elaborate", label: "📚 专业扩充", desc: "补充定义背景与延伸推导" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => { setPolishStyle(item.key as any); setCustomPrompt(""); }}
                        className={`text-left p-3 rounded-xl border text-xs transition-all ${
                          polishStyle === item.key && !customPrompt.trim()
                            ? "border-[#5b88b5] bg-[#f0f5fa] text-[#2c5282] ring-1 ring-[#5b88b5]"
                            : "border-stone-200 bg-white hover:border-stone-300 text-stone-700"
                        }`}
                      >
                        <span className="font-semibold block">{item.label}</span>
                        <span className="text-[11px] text-stone-500 mt-1 block leading-tight">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="custom-polish-prompt" className="text-xs font-semibold text-stone-700">{t("个性化提示词（可选）", "Custom Instruction (Optional)")}</Label>
                  <Input
                    id="custom-polish-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={t("例如：用高中理科生听得懂的口吻解释，并在末尾总结核心要点...", "e.g., Explain in a simple tone and summarize key points at the end...")}
                    className="mt-1 text-xs h-9"
                  />
                </div>
              </div>
            )}

            {/* Mode 2: Format Rules Explanation */}
            {aiToolMode === "format" && (
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
                <p className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  {t("Obsidian 级别 Markdown 排版优化规则", "Obsidian Markdown Optimization Rules")}
                </p>
                <ul className="list-disc pl-4 space-y-1 text-emerald-800">
                  <li>{t("自动构建清晰的标题层级（H1 / H2 / H3）", "Auto-structure title hierarchy (H1/H2/H3)")}</li>
                  <li>{t("调整段落、列表、代码块与公式块的呼吸感空行", "Add proper breathing space and empty lines between sections")}</li>
                  <li>{t("黑体高亮核心术语与关键结论，强化视读体验", "Bold highlight key terms and core conclusions")}</li>
                  <li>{t("自动规范数学公式为 标准 LaTeX 格式 ($...$ 与 $$...$$)", "Normalize math equations into standard LaTeX ($...$ & $$...$$)")}</li>
                  <li>{t("提炼核心直觉为 Markdown 引用块 (> )", "Extract core insights into blockquotes (> )")}</li>
                </ul>
              </div>
            )}

            {/* Generate Action Button */}
            {!generatedResult && (
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleRunAi}
                  disabled={isGenerating || !form.content.trim()}
                  className="bg-[#5b88b5] hover:bg-[#4a77a4] text-white rounded-xl text-xs px-5 h-9"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("AI 正在思考处理中...", "AI is processing...")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      {aiToolMode === "format" ? t("一键智能排版", "Run Auto Formatting") : t("一键内容润色", "Run Polish")}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Result Preview & Diff */}
            {generatedResult && (
              <div className="space-y-3 pt-3 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {t("AI 优化生成结果预览", "AI Result Preview")}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRunAi}
                    disabled={isGenerating}
                    className="text-xs text-stone-500 hover:text-stone-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t("重新生成", "Regenerate")}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original Content */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50 flex flex-col max-h-[300px]">
                    <span className="text-[11px] font-semibold text-stone-500 mb-2">{t("原文", "Original")}</span>
                    <div className="overflow-y-auto flex-1 font-mono text-xs text-stone-600 whitespace-pre-wrap">
                      {form.content}
                    </div>
                  </div>

                  {/* AI Optimized Markdown Preview */}
                  <div className="border border-emerald-200 rounded-xl p-3 bg-white flex flex-col max-h-[300px] shadow-2xs">
                    <span className="text-[11px] font-semibold text-emerald-700 mb-2">{t("AI 优化效果预览", "AI Optimized Preview")}</span>
                    <div className="overflow-y-auto flex-1 obsidian-markdown text-xs">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {generatedResult}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyResult}
                    className="text-xs h-9 rounded-xl"
                  >
                    {copied ? <Check className="h-4 w-4 mr-1 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1 text-stone-500" />}
                    {copied ? t("已复制", "Copied") : t("复制优化内容", "Copy Content")}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApplyAiResult}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl px-4"
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    {t("应用并覆盖原笔记", "Apply & Replace Note")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

