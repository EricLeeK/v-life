import { useState, type ReactNode } from "react";
import { BookOpen, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StudyMarkdown } from "./StudyMarkdown";
import type { PrepQuestion } from "@/lib/preparation/domain";

type Field = "explanation_md" | "analysis_md";
export function QuestionAnalysis({ question, onSave, onSaved, onEditingChange, disabled = false, children }: {
  question: PrepQuestion;
  onSave: (base: PrepQuestion, patch: Partial<PrepQuestion>) => Promise<PrepQuestion>;
  onSaved: (next: PrepQuestion, base: PrepQuestion) => void;
  onEditingChange?: (editing: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState<Field | null>(null);
  const [base, setBase] = useState(question);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const conflict = !!editing && base.revision !== question.revision;
  const close = () => { setEditing(null); setError(""); onEditingChange?.(false); };
  const body = (field: Field, title: string) => editing === field ? (
    <form className="prep-markdown-editor" onSubmit={async (event) => {
      event.preventDefault();
      if (saving || disabled || conflict) return;
      setSaving(true); setError("");
      try {
        const next = await onSave(base, { [field]: draft });
        onSaved(next, base);
        close();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String((cause as { message?: string })?.message || "保存失败");
        setError(message.includes("revision conflict") ? "内容已在其他位置更新，请核对最新内容。你的输入已保留。" : `保存失败：${message}。你的输入已保留，可以重试。`);
      } finally { setSaving(false); }
    }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <label className="text-xs text-muted-foreground" htmlFor={`prep-${field}`}>{title}内容 · Markdown</label>
        <Button size="sm" variant="ghost" type="button" onClick={() => setPreview(!preview)}>{preview ? "继续编辑" : "预览"}</Button>
      </div>
      {preview ? <div className="prep-markdown-preview"><StudyMarkdown variant="question">{draft || "暂无内容。"}</StudyMarkdown></div> : <Textarea id={`prep-${field}`} className="min-h-48" value={draft} disabled={saving} onChange={(event) => setDraft(event.target.value)} />}
      {(error || conflict) && <p role="alert" className="text-sm text-destructive mt-3">{conflict ? "题目已在其他位置更新。请核对最新内容，你的草稿仍然保留。" : error}</p>}
      {conflict && <div className="mt-3 space-y-3">
        <details><summary className="text-sm cursor-pointer">查看最新内容</summary><StudyMarkdown variant="question">{question[field] || "暂无内容。"}</StudyMarkdown></details>
        <Button size="sm" variant="outline" type="button" onClick={() => { setBase(question); setError(""); }}>保留草稿，使用最新版本</Button>
      </div>}
      <div className="flex gap-2 mt-4">
        <Button className="prep-primary" disabled={saving || disabled || conflict}>{saving ? "保存中…" : `保存${title}`}</Button>
        <Button type="button" variant="outline" disabled={saving} onClick={close}>取消</Button>
      </div>
    </form>
  ) : <StudyMarkdown variant="question">{question[field] || (field === "explanation_md" ? "解析待补充。" : "记录当时的错误思路，下次更容易识别。")}</StudyMarkdown>;
  const heading = (field: Field, title: string, label: string, icon: ReactNode) => (
    <div className="prep-analysis-heading-row">
      <h2 className="prep-analysis-heading">{icon}{label}</h2>
      {editing !== field && <Button size="sm" variant="ghost" disabled={disabled || !!editing} onClick={() => {
        setEditing(field); setBase(question); setDraft(question[field]); setPreview(false); setError(""); onEditingChange?.(true);
      }}>编辑{title}</Button>}
    </div>
  );
  return <div className="prep-analysis-body">
    <div className="prep-explanation">
      {heading("explanation_md", "解析", "答案解析", <BookOpen size={16} />)}
      {question.question_type === "text" && <StudyMarkdown variant="question">{typeof question.correct_answer === "string" ? question.correct_answer : ""}</StudyMarkdown>}
      {body("explanation_md", "解析")}
    </div>
    <aside className="prep-mistake">
      {heading("analysis_md", "错因", "我的错因", <PencilLine size={16} />)}
      {body("analysis_md", "错因")}
      {children}
    </aside>
  </div>;
}
