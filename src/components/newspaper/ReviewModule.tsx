import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNewspaperDrafts } from "./NewspaperDraftContext";
import {
  useNewspaperCommand,
  usePendingNewspaperRequest,
} from "@/hooks/useNewspapers";
import type { NewspaperReport } from "../../../supabase/functions/_shared/newspaperTypes";

/** One review request path shared by the toolbar and the paper itself. */
export function useReviewGenerator(report: NewspaperReport) {
  const drafts = useNewspaperDrafts();
  const command = useNewspaperCommand();
  const pending = usePendingNewspaperRequest("review_generate", report.date);
  const [running, setRunning] = useState(false);
  async function generate() {
    setRunning(true);
    try {
      if (!await drafts.flush()) {
        throw new Error("请先保存补充原文，再生成复盘。");
      }
      if (!report.id) {
        await command.mutateAsync({ action: "refresh", input: { date: report.date } });
      }
      await command.mutateAsync({
        action: "review_generate",
        input: { date: report.date },
      });
      toast.success("复盘已写进这期日报");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  const label = running
    ? "正在复盘…"
    : pending.length
    ? "检查复盘结果"
    : report.review
    ? report.review_stale ? "更新复盘" : "重新复盘"
    : "生成 AI 复盘";
  return { generate, running, pending: pending.length > 0, label };
}

function Suggestions({ report }: { report: NewspaperReport }) {
  if (!report.review?.suggestions.length) return null;
  return (
    <div className="np-review-next">
      <h3>明日建议</h3>
      <ol>
        {report.review.suggestions.map((suggestion, i) => (
          <li key={i}><p>{suggestion}</p></li>
        ))}
      </ol>
    </div>
  );
}

export function ReviewModule({ report }: { report: NewspaperReport }) {
  const review = useReviewGenerator(report);
  const r = report.review;
  if (!r) {
    return (
      <section className="np-mod np-mod-review np-review-empty" aria-labelledby="np-review-heading">
        <header className="np-mod-head">
          <h2 id="np-review-heading">编辑部复盘</h2>
          <span className="np-mod-kicker">可选</span>
        </header>
        <p>
          从今天的记录里，读出一点收获。AI 复盘不会改动原文。
        </p>
        <button
          type="button"
          className="np-button"
          disabled={review.running}
          onClick={() => void review.generate()}
        >
          <Sparkles size={15} />{review.label}
        </button>
        {review.pending && (
          <p className="np-muted">
            上一次请求的结果尚未确认。检查结果会沿用同一次请求，不会重复调用 AI。
          </p>
        )}
      </section>
    );
  }
  const columns: [string, string[]][] = [
    ["完成与收获", r.achievements],
    ["困难与状态", r.difficulties],
    ["复盘观察", r.observations],
  ];
  return (
    <section className="np-mod np-mod-review" aria-labelledby="np-review-heading">
      <header className="np-mod-head">
        <h2 id="np-review-heading">编辑部复盘</h2>
        <span className="np-ai-stamp">AI 分析</span>
      </header>
      {(report.review_stale || review.pending) && (
        <div className="np-stale">
          <span>
            {review.pending
              ? "上一次复盘的结果尚未确认，检查不会重复调用 AI。"
              : "有新内容，可更新复盘"}
          </span>
          <button
            type="button"
            className="np-text-link"
            disabled={review.running}
            onClick={() => void review.generate()}
          >
            {review.label}
          </button>
        </div>
      )}
      <p className="np-review-overview">{r.overview}</p>
      <div className="np-review-cols">
        {columns.filter(([, items]) => items.length).map(([label, items]) => (
          <div key={label}>
            <h3>{label}</h3>
            <ul>
              {items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <Suggestions report={report} />
      <p className="np-mod-foot">
        写于{" "}
        {new Date(r.generated_at).toLocaleString("zh-CN", {
          timeZone: report.timezone,
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" "}· 依据第 {r.source_revision} 版记录
      </p>
    </section>
  );
}
