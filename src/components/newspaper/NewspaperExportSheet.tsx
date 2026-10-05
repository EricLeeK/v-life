import { useState } from "react";
import { Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { callNewspaper, useNewspaperCommand } from "@/hooks/useNewspapers";
import {
  buildPortableNewspaper,
  newspaperMarkdown,
  saveBlob,
} from "@/lib/newspaperExport";
import { useNewspaperDrafts } from "./NewspaperDraftContext";
import { NewspaperSheet } from "./NewspaperSheet";
import type {
  NewspaperReport,
  NewspaperSectionId,
} from "../../../supabase/functions/_shared/newspaperTypes";

/** Copy always reads the saved report again, so folded and hidden text is never lost. */
export function useNewspaperCopy(report: NewspaperReport) {
  const drafts = useNewspaperDrafts();
  const { isDemo } = useDemoMode();
  return async (
    { rawOnly = false, sections }: { rawOnly?: boolean; sections?: NewspaperSectionId[] } = {},
  ) => {
    try {
      if (!await drafts.flush()) throw new Error("请先保存补充原文。");
      const current = await callNewspaper<NewspaperReport>("get", { date: report.date }, isDemo);
      await navigator.clipboard.writeText(
        newspaperMarkdown(current, {
          rawOnly,
          sections: sections ?? current.snapshot.sections.map((s) => s.id),
        }),
      );
      toast.success(rawOnly ? "原始素材已复制，不含 AI 复盘" : "完整日报已复制，包含折叠与隐藏的原文");
    } catch {
      toast.error("复制失败，请改用下载，或检查剪贴板权限。");
    }
  };
}

export function NewspaperExportSheet(
  { report, open, onOpenChange }: {
    report: NewspaperReport;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  },
) {
  const drafts = useNewspaperDrafts();
  const { isDemo } = useDemoMode();
  const command = useNewspaperCommand();
  const copy = useNewspaperCopy(report);
  const [sections, setSections] = useState<NewspaperSectionId[]>(
    report.snapshot.sections.map((s) => s.id),
  );
  const [withReview, setWithReview] = useState(true);
  const [exporting, setExporting] = useState(false);
  const toggle = (id: NewspaperSectionId, on: boolean) =>
    setSections((list) => on ? [...list, id] : list.filter((s) => s !== id));

  return (
    <NewspaperSheet
      open={open}
      onOpenChange={onOpenChange}
      title="导出与版面"
      description="复制为 Markdown，或打包下载原文与原图。导出不含任何密钥与临时链接。"
    >
      <fieldset className="np-sheet-group">
        <legend>导出哪些类别</legend>
        {report.snapshot.sections.map((s) => (
          <label className="np-check" key={s.id}>
            <input
              type="checkbox"
              checked={sections.includes(s.id)}
              onChange={(e) => toggle(s.id, e.target.checked)}
            />
            <span>{s.title}</span>
            <span className="np-check-count">{s.items.length}</span>
          </label>
        ))}
        <p className="np-muted">补充原文始终随日报导出。</p>
      </fieldset>
      <div className="np-sheet-actions">
        <button
          type="button"
          className="np-button np-button-primary"
          onClick={() => void copy({ sections })}
        >
          <Copy size={15} />复制完整日报
        </button>
        <button
          type="button"
          className="np-button"
          onClick={() => void copy({ sections, rawOnly: true })}
        >
          仅复制原始素材
        </button>
      </div>
      <fieldset className="np-sheet-group">
        <legend>打包下载</legend>
        <label className="np-check">
          <input
            type="checkbox"
            checked={withReview}
            onChange={(e) => setWithReview(e.target.checked)}
          />
          <span>包含 AI 复盘（标注为分析）</span>
        </label>
        <button
          type="button"
          className="np-button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              if (!await drafts.flush()) throw new Error("请先保存补充原文。");
              const current = await callNewspaper<NewspaperReport>("get", { date: report.date }, isDemo);
              const zip = await buildPortableNewspaper(current, { rawOnly: !withReview, sections });
              saveBlob(zip, `V-Life-${report.date}.zip`);
              toast.success("已打包：Markdown 正文与原始图片");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download size={15} />{exporting ? "正在打包…" : "下载 ZIP"}
        </button>
      </fieldset>
      <fieldset className="np-sheet-group">
        <legend>阅读时显示的版块</legend>
        <p className="np-muted">隐藏只影响版面，不会删除原文，导出时仍可选择。</p>
        {report.snapshot.sections.map((section) => (
          <label className="np-check" key={section.id}>
            <input
              type="checkbox"
              checked={!report.hidden_sections.includes(section.id)}
              onChange={async (e) => {
                const hidden = e.target.checked
                  ? report.hidden_sections.filter((id) => id !== section.id)
                  : [...report.hidden_sections, section.id];
                try {
                  if (!report.id) {
                    await command.mutateAsync({ action: "refresh", input: { date: report.date } });
                  }
                  await command.mutateAsync({
                    action: "report_update",
                    input: { date: report.date, hidden_sections: hidden },
                  });
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
            <span>{section.title}</span>
            <span className="np-check-count">{section.items.length}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="np-sheet-group">
        <legend>快照</legend>
        <p className="np-muted">
          日报保存的是当时的快照。原始记录改动后，更新快照才会纳入；补充与配图不受影响。
        </p>
        <button
          type="button"
          className="np-button"
          disabled={command.isPending}
          onClick={async () => {
            try {
              if (!await drafts.flush()) throw new Error("请先保存补充原文。");
              await command.mutateAsync({ action: "refresh", input: { date: report.date } });
              toast.success("已按最新记录更新日报");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <RefreshCw size={15} />按最新记录更新快照
        </button>
      </fieldset>
    </NewspaperSheet>
  );
}
