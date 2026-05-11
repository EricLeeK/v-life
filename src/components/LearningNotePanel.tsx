import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Edit2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/contexts/LanguageContext";
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

export function LearningNotePanel({ course, notes, onCreateNote, onSaveNote, onDeleteNote }: LearningNotePanelProps) {
  const { t } = useLang();
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(() => notes[0]?.id);
  const [draftNoteId, setDraftNoteId] = useState<string | undefined>(() => notes[0]?.id);
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState(() => ({
    title: notes[0]?.title || "",
    content: notes[0]?.content || "",
    tagsText: tagsToText(notes[0]?.tags),
    note_date: notes[0]?.note_date || todayString(),
  }));

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
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#f9f7f1]">
      <div className="border-b border-[#e4e1d7] bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: course.color || "#5b88b5" }} />
              <h2 className="text-lg font-semibold text-[#1f1a14] truncate">{course.name}</h2>
            </div>
            {course.description && <p className="mt-1 text-sm text-[#8a847a]">{course.description}</p>}
          </div>
          <Button onClick={handleCreate} size="sm" className="bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white">
            <Plus className="h-4 w-4 mr-1" />
            {t("新建笔记", "New Note")}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[#8a847a] px-6">
          <BookOpen className="h-10 w-10 mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#1f1a14]">{t("这个课程还没有笔记", "No notes in this course yet")}</p>
          <p className="text-xs mt-1">{t("添加第一条 Markdown 学习笔记。", "Add your first Markdown learning note.")}</p>
          <Button onClick={handleCreate} size="sm" className="mt-4 bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white">
            <Plus className="h-4 w-4 mr-1" />
            {t("新建笔记", "New Note")}
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className="min-h-0 border-b lg:border-b-0 lg:border-r border-[#e4e1d7] bg-white">
            <div className="max-h-56 lg:max-h-none lg:h-full overflow-y-auto p-3 space-y-2">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                    selectedNote?.id === note.id
                      ? "border-[#1f1a14]/20 bg-[#f4f3ee]"
                      : "border-[#e4e1d7] bg-white hover:bg-[#f9f7f1]"
                  }`}
                >
                  <span className="block text-sm font-medium text-[#1f1a14] truncate">{note.title}</span>
                  <span className="block mt-1 text-[11px] text-[#8a847a]">
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
            <Tabs defaultValue="edit" className="min-h-0 flex-1 flex flex-col">
              <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
                <TabsList>
                  <TabsTrigger value="edit">
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    {t("编辑", "Edit")}
                  </TabsTrigger>
                  <TabsTrigger value="preview">{t("预览", "Preview")}</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDelete} className="border-[#e4e1d7] text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("删除", "Delete")}
                  </Button>
                  <Button size="sm" onClick={handleSave} className="bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white">
                    <Save className="h-4 w-4 mr-1" />
                    {t("保存", "Save")}
                  </Button>
                </div>
              </div>

              <TabsContent value="edit" className="mt-0 min-h-0 flex-1">
                <div className="h-full min-h-0 flex flex-col gap-3 rounded-2xl border border-[#e4e1d7] bg-white p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
                    <div>
                      <Label className="text-[#1f1a14] text-sm">{t("标题", "Title")}</Label>
                      <Input
                        value={form.title}
                        onChange={(e) => { setForm({ ...form, title: e.target.value }); setIsDirty(true); }}
                        className="border-[#e4e1d7] text-[#1f1a14]"
                      />
                    </div>
                    <div>
                      <Label className="text-[#1f1a14] text-sm">{t("日期", "Date")}</Label>
                      <Input
                        type="date"
                        value={form.note_date}
                        onChange={(e) => { setForm({ ...form, note_date: e.target.value }); setIsDirty(true); }}
                        className="border-[#e4e1d7] text-[#1f1a14]"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#1f1a14] text-sm">{t("标签（逗号分隔）", "Tags (comma separated)")}</Label>
                    <Input
                      value={form.tagsText}
                      onChange={(e) => { setForm({ ...form, tagsText: e.target.value }); setIsDirty(true); }}
                      placeholder={t("例如：lecture, 重点", "e.g. lecture, important")}
                      className="border-[#e4e1d7] text-[#1f1a14]"
                    />
                  </div>
                  <div className="min-h-0 flex-1 flex flex-col">
                    <Label className="text-[#1f1a14] text-sm">{t("内容", "Content")} (Markdown)</Label>
                    <Textarea
                      value={form.content}
                      onChange={(e) => { setForm({ ...form, content: e.target.value }); setIsDirty(true); }}
                      className="min-h-[300px] flex-1 resize-none border-[#e4e1d7] text-[#1f1a14] font-mono text-sm"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0 min-h-0 flex-1">
                <div className="h-full min-h-[360px] overflow-y-auto rounded-2xl border border-[#e4e1d7] bg-white p-5">
                  <div className="mb-4 border-b border-[#e4e1d7] pb-3">
                    <h3 className="text-xl font-semibold text-[#1f1a14]">{form.title || t("未命名笔记", "Untitled Note")}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#8a847a]">
                      {form.note_date && <span>{format(new Date(`${form.note_date}T00:00:00`), "yyyy/MM/dd")}</span>}
                      {textToTags(form.tagsText).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-[#1f1a14]">
                    {form.content.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content}</ReactMarkdown>
                    ) : (
                      <p className="text-sm text-[#8a847a]">{t("还没有内容。", "No content yet.")}</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}
    </div>
  );
}
