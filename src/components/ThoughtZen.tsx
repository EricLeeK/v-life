import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Check, Eye, LoaderCircle, PencilLine, Save } from "lucide-react";
import { markdownTypography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/contexts/LanguageContext";
import { trapTabFocus } from "@/components/zenFocus";
import "./zen-workspace.css";

export type ThoughtZenDraft = { title: string; content: string };

interface ThoughtZenProps {
  draft: ThoughtZenDraft;
  saved: boolean;
  onDraftChange: (draft: ThoughtZenDraft) => void;
  onSave: (draft: ThoughtZenDraft) => Promise<unknown>;
  onStartNew: () => Promise<unknown>;
  onExit: () => void;
}

export function ThoughtZen({ draft, saved, onDraftChange, onSave, onStartNew, onExit }: ThoughtZenProps) {
  const { t } = useLang();
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onExit();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  const updateDraft = (patch: Partial<ThoughtZenDraft>) => {
    setSaveError(null);
    onDraftChange({ ...draft, ...patch });
  };

  const saveDraft = async () => {
    if (!draft.content.trim() || isSaving || saved) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("保存失败，请稍后重试。", "Save failed. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const startNew = async () => {
    if (isSaving || isStartingNew) return;
    setIsStartingNew(true);
    setSaveError(null);
    try {
      await onStartNew();
      setShowPreview(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("暂时无法新建随想。", "Unable to start a new thought."));
    } finally {
      setIsStartingNew(false);
    }
  };

  return (
    <section className="zen-workspace thought-zen" role="dialog" aria-modal="true" aria-label={t("专注写作工作区", "Focused writing workspace")} onKeyDown={trapTabFocus}>
      <header className="zen-workspace__header">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onExit} aria-label={t("退出专注写作", "Exit focused writing")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />{t("返回随想", "Back to thoughts")}
          </Button>
          <span className="hidden h-5 border-l border-border sm:block" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("专注写作", "Focused writing")}</p>
            <p className="text-xs text-muted-foreground">{t("先把念头写下来，之后再整理。", "Capture the thought first. Organize it later.")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline" role="status" aria-live="polite">
            {saveError ? t("保存未完成", "Save failed") : saved ? t("已保存", "Saved") : ""}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview((value) => !value)} aria-pressed={showPreview}>
            {showPreview ? <><PencilLine className="mr-1.5 h-4 w-4" />{t("继续编辑", "Continue editing")}</> : <><Eye className="mr-1.5 h-4 w-4" />{t("预览", "Preview")}</>}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={startNew} disabled={isSaving || isStartingNew}>
            {t("新随想", "New thought")}
          </Button>
          <Button type="button" size="sm" onClick={saveDraft} disabled={!draft.content.trim() || isSaving || saved} aria-label={t("保存随想", "Save thought")}>
            {isSaving ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : saved ? <Check className="mr-1.5 h-4 w-4" /> : <Save className="mr-1.5 h-4 w-4" />}
            {isSaving ? t("正在保存", "Saving") : saved ? t("已保存", "Saved") : t("保存随想", "Save thought")}
          </Button>
        </div>
      </header>

      <div className="zen-workspace__body">
        <div className="thought-zen__surface">
          <Label htmlFor="thought-zen-title" className="sr-only">{t("标题（可选）", "Title (optional)")}</Label>
          <Input
            id="thought-zen-title"
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            placeholder={t("给这个念头一个标题（可选）", "Give this thought a title (optional)")}
            className="thought-zen__title font-heading"
          />
          {showPreview ? (
            <div className="thought-zen__preview thought-card-markdown" aria-label={t("随想预览", "Thought preview")}>
              {draft.content.trim() ? <ReactMarkdown components={markdownTypography} remarkPlugins={[remarkGfm]}>{draft.content}</ReactMarkdown> : <p>{t("内容会显示在这里。", "Your writing will appear here.")}</p>}
            </div>
          ) : (
            <div className="thought-zen__editor-wrap">
              <Label htmlFor="thought-zen-content" className="sr-only">{t("随想内容", "Thought content")}</Label>
              <Textarea
                id="thought-zen-content"
                value={draft.content}
                onChange={(event) => updateDraft({ content: event.target.value })}
                placeholder={t("从一句话开始……", "Start with a sentence…")}
                className="thought-zen__editor"
                autoFocus
              />
              {saveError && <p className="pt-3 text-sm text-destructive" role="alert">{saveError}</p>}
            </div>
          )}
          {saveError && showPreview && <p className="mt-4 text-sm text-destructive" role="alert">{saveError}</p>}
        </div>
      </div>
    </section>
  );
}
