import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImagePlus,
  PenLine,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  NewspaperDraftContext,
  useNewspaperDrafts,
  useNewspaperSaveBarrier,
} from "./NewspaperDraftContext";
import { useNewspaperCommand } from "@/hooks/useNewspapers";
import { lunarFactsForDate } from "@/lib/fortune/lunarCalendar";
import { SupplementNotebook } from "./SupplementNotebook";
import {
  type ImagePlacement,
  ImageStudio,
  NewspaperImageLightbox,
  useImageJobPolling,
} from "./NewspaperImages";
import { buildPaperLayout } from "./paperLayout";
import { FrontPage, jumpTo, SectionModule } from "./PaperModules";
import { PaperFlow } from "./PaperFlow";
import { ReviewModule, useReviewGenerator } from "./ReviewModule";
import { NewspaperExportSheet, useNewspaperCopy } from "./NewspaperExportSheet";
import type {
  NewspaperImageAsset,
  NewspaperReport,
} from "../../../supabase/functions/_shared/newspaperTypes";

export const reportStatus = (status: string) =>
  status === "draft"
    ? "今日草稿"
    : status === "reconstructed"
    ? "历史补建"
    : "";

function shortDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
}

function ReaderToolbar(
  { report, onBack, onDate, previous, next, onSupplement, onStudio, onExport }: {
    report: NewspaperReport;
    onBack: () => void;
    onDate: (date: string) => void;
    previous?: string;
    next?: string;
    onSupplement: () => void;
    onStudio: () => void;
    onExport: () => void;
  },
) {
  const drafts = useNewspaperDrafts();
  const command = useNewspaperCommand();
  const review = useReviewGenerator(report);
  const copy = useNewspaperCopy(report);
  const needsRefresh = !report.id || report.source_changed;
  return (
    <div className="np-reader-toolbar">
      <button
        type="button"
        className="np-tool np-tool-back"
        data-newspaper-back
        onClick={async () => {
          if (await drafts.flush()) onBack();
          else toast.error("补充原文尚未保存，请重试后再收起日报。");
        }}
      >
        <ArrowLeft size={16} />收回档案馆
      </button>
      <div className="np-tool-date">
        <button
          type="button"
          className="np-tool np-tool-icon"
          aria-label="前一期日报"
          disabled={!previous}
          onClick={async () => {
            if (previous && await drafts.flush()) onDate(previous);
          }}
        >
          <ChevronLeft size={17} />
        </button>
        <span>{shortDate(report.date)}</span>
        <button
          type="button"
          className="np-tool np-tool-icon"
          aria-label="后一期日报"
          disabled={!next}
          onClick={async () => {
            if (next && await drafts.flush()) onDate(next);
          }}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="np-tool-actions">
        {needsRefresh && (
          <button
            type="button"
            className="np-tool np-tool-accent"
            disabled={command.isPending}
            onClick={async () => {
              try {
                if (!await drafts.flush()) throw new Error("请先保存补充原文。");
                await command.mutateAsync({ action: "refresh", input: { date: report.date } });
                toast.success(report.id ? "已按最新记录更新日报" : "这份日报已收进档案");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <RefreshCw size={15} />
            <span>{report.id ? "更新快照" : "收藏这份日报"}</span>
          </button>
        )}
        <button type="button" className="np-tool" onClick={onSupplement}>
          <PenLine size={15} /><span>补记</span>
        </button>
        <button type="button" className="np-tool" onClick={onStudio}>
          <ImagePlus size={15} /><span>配图</span>
        </button>
        <button
          type="button"
          className="np-tool"
          disabled={review.running}
          onClick={async () => {
            await review.generate();
            jumpTo("np-review-heading");
          }}
        >
          <Sparkles size={15} /><span>{report.review ? review.label : "AI 复盘"}</span>
        </button>
        <button type="button" className="np-tool" onClick={() => void copy()}>
          <Copy size={15} /><span>复制</span>
        </button>
        <button
          type="button"
          className="np-tool np-tool-icon"
          aria-label="导出与版面"
          onClick={onExport}
        >
          <Settings2 size={16} />
        </button>
      </div>
    </div>
  );
}

function Masthead({ report, count }: { report: NewspaperReport; count: number }) {
  const lunar = lunarFactsForDate(report.date);
  const day = new Date(`${report.date}T12:00:00`);
  return (
    <header className="np-masthead">
      <div className="np-masthead-rail">
        <span>V-Life · 私人生活档案</span>
        {lunar && (
          <span>
            农历{lunar.isLeapMonth ? "闰" : ""}{lunar.monthZh}月{lunar.dayZh} · {lunar.dayGanZhiZh}日
          </span>
        )}
        <span>{count} 则记录 · 第 {report.revision} 版</span>
      </div>
      <h1 className="np-title">
        <img src="/newspaper-paper/masthead.webp" alt="生活日报" width="2164" height="727" />
      </h1>
      <div className="np-masthead-bar">
        <time dateTime={report.date}>
          {day.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </time>
        {reportStatus(report.status) && <span>{reportStatus(report.status)}</span>}
        <span>
          更新于{" "}
          {new Date(report.updated_at).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: report.timezone,
          })}
        </span>
      </div>
    </header>
  );
}

function EditorNotes({ report }: { report: NewspaperReport }) {
  const missing = report.snapshot.coverage.filter((c) => c.state === "unavailable");
  const notes = [
    report.status === "reconstructed" &&
    "这是根据现有历史记录补建的日报，不是当天保存的档案。",
    report.source_changed &&
    "原始记录在归档后有改动。版面仍是保存时的快照，更新快照后才会纳入。",
    report.source_check_unavailable &&
    "暂时无法核对原始记录是否更新，已保存的快照仍可阅读。",
    missing.length > 0 &&
    `部分来源暂时读不到：${missing.map((c) => c.message || c.source).join("；")}。本期并非完整汇总。`,
  ].filter(Boolean) as string[];
  if (!notes.length) return null;
  return (
    <div className="np-editor-notes" role="note">
      <span className="np-editor-label">编者按</span>
      <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

export function NewspaperReader(
  { report, onBack, onDate, previous, next }: {
    report: NewspaperReport;
    onBack: () => void;
    onDate: (date: string) => void;
    previous?: string;
    next?: string;
  },
) {
  const drafts = useNewspaperSaveBarrier();
  const layout = useMemo(() => buildPaperLayout(report), [report]);
  const [lightbox, setLightbox] = useState<NewspaperImageAsset | null>(null);
  const [studio, setStudio] = useState(false);
  const [placement, setPlacement] = useState<ImagePlacement>("main");
  const [exportOpen, setExportOpen] = useState(false);
  const [addSignal, setAddSignal] = useState(0);
  useImageJobPolling(report);
  const illustrate = (p: ImagePlacement) => {
    setPlacement(p);
    setStudio(true);
  };
  const supplement = () => {
    jumpTo("np-supplements");
    setAddSignal((n) => n + 1);
  };
  const count = report.snapshot.sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <NewspaperDraftContext.Provider value={drafts}>
      <div className="np-reader-wrap">
        <ReaderToolbar
          report={report}
          onBack={onBack}
          onDate={onDate}
          previous={previous}
          next={next}
          onSupplement={supplement}
          onStudio={() => illustrate(placement)}
          onExport={() => setExportOpen(true)}
        />
        <article className="np-paper" aria-label={`${report.date} 生活日报`}>
          <Masthead report={report} count={count} />
          <EditorNotes report={report} />
          <PaperFlow edition={`${report.date}:${report.review?.generated_at ?? ""}:${report.assets.filter((asset) => asset.active).map((asset) => asset.id).join(",")}`}>
            <FrontPage
              report={report}
              layout={layout}
              onOpenAsset={setLightbox}
              onIllustrate={illustrate}
              onSupplement={supplement}
            />
            {layout.modules.map((module) => (
              <SectionModule
                key={module.key}
                module={module}
                report={report}
                onOpenAsset={setLightbox}
                onIllustrate={illustrate}
              />
            ))}
            <SupplementNotebook report={report} addSignal={addSignal} />
            <ReviewModule report={report} />
          </PaperFlow>
          <footer className="np-paper-footer">
            <span>V-Life 生活日报 · 原文为准，复盘为辅</span>
            <span>{report.date.replace(/-/g, ".")}</span>
          </footer>
        </article>
        <ImageStudio
          report={report}
          open={studio}
          onOpenChange={setStudio}
          placement={placement}
          onPlacement={setPlacement}
          onOpenAsset={setLightbox}
        />
        <NewspaperExportSheet report={report} open={exportOpen} onOpenChange={setExportOpen} />
        <NewspaperImageLightbox asset={lightbox} onClose={() => setLightbox(null)} />
      </div>
    </NewspaperDraftContext.Provider>
  );
}
