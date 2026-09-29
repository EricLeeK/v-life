import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  ImagePlus,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./NewspaperDialog";
import { useDemoMode } from "@/contexts/DemoModeContext";
import {
  NewspaperDraftContext,
  useNewspaperDrafts,
  useNewspaperSaveBarrier,
} from "./NewspaperDraftContext";
import {
  callNewspaper,
  useNewspaperCommand,
  usePendingNewspaperRequest,
} from "@/hooks/useNewspapers";
import { todoHooks, useAddToToday, useTodayTasks } from "@/hooks/useData";
import {
  buildPortableNewspaper,
  newspaperMarkdown,
  saveBlob,
} from "@/lib/newspaperExport";
import { SupplementNotebook } from "./SupplementNotebook";
import {
  NewspaperFigure,
  NewspaperImageLightbox,
  NewspaperImages,
} from "./NewspaperImages";
import type {
  NewspaperEntry,
  NewspaperImageAsset,
  NewspaperReport,
  NewspaperSectionId,
} from "../../../supabase/functions/_shared/newspaperTypes";
export const reportStatus = (status: string) =>
  status === "draft"
    ? "今日草稿"
    : status === "reconstructed"
    ? "历史补建"
    : "已归档";
const english: Record<string, string> = {
  chronicle: "THE DAY",
  learning: "LEARNING",
  finance: "THE LEDGER",
  health: "WELLBEING",
  thoughts: "MARGINALIA",
};
function OriginalEntry(
  { entry, timezone, onSource }: {
    entry: NewspaperEntry;
    timezone: string;
    onSource: (e: NewspaperEntry) => void;
  },
) {
  const [expanded, setExpanded] = useState(false);
  const long = entry.body.length > 420;
  return (
    <article className="np-entry">
      <div className="np-entry-meta">
        <span>
          {entry.time
            ? new Date(entry.time).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: timezone,
            })
            : "当天记录"}
        </span>
        <span>
          {entry.status === "completed"
            ? "已完成"
            : entry.status === "planned"
            ? "计划 · 未标记完成"
            : "记录"}
        </span>
      </div>
      <h3>{entry.title}</h3>
      <div
        className={`np-original ${
          long && !expanded ? "np-original-folded" : ""
        }`}
      >
        {entry.body}
      </div>
      {long && (
        <button
          className="np-text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "收起正文" : "展开完整原文"}
        </button>
      )}
      <button className="np-source-link" onClick={() => onSource(entry)}>
        查看来源 <ExternalLink size={12} />
      </button>
    </article>
  );
}
function ReviewPanel({ report }: { report: NewspaperReport }) {
  const drafts = useNewspaperDrafts();
  const pendingReview = usePendingNewspaperRequest(
    "review_generate",
    report.date,
  );
  const command = useNewspaperCommand();
  const create = todoHooks.useCreate();
  const add = useAddToToday();
  const today = useTodayTasks();
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const created = useRef<Record<string, string>>({});
  async function addSuggestion(suggestion: string) {
    setAdding(suggestion);
    try {
      let id = created.current[suggestion];
      if (!id) {
        const todo = await create.mutateAsync({
          title: suggestion,
          importance: "medium",
          category: "生活",
          detail: null,
          is_archived: false,
          is_completed: false,
          kind: "once",
        });
        id = todo.id;
        created.current[suggestion] = id;
      }
      await add.mutateAsync({
        todo_id: id,
        difficulty: "medium",
        base_points: 20,
        metadata: { source: "newspaper_review", report_date: report.date },
      });
      const result = await today.refetch?.();
      if (result?.error) {
        throw new Error(
          "任务已创建，但暂时无法核对今日列表，请到今日待办查看。",
        );
      }
      setAdded((a) => [...a, suggestion]);
      toast.success("已加入今日待办");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(null);
    }
  }
  return (
    <section className="np-review" aria-labelledby="np-review-heading">
      <div className="np-split">
        <div>
          <h2 id="np-review-heading">与这一天，再聊一会儿</h2>
          <p className="np-muted">AI 复盘是对记录的解读，原文始终保留。</p>
        </div>
        <button
          className="np-button"
          disabled={command.isPending}
          onClick={async () => {
            try {
              if (!await drafts.flush()) {
                throw new Error(
                  "请先保存补充原文，再生成复盘。",
                );
              }
              if (!report.id) {
                await command.mutateAsync({
                  action: "refresh",
                  input: { date: report.date },
                });
              }
              await command.mutateAsync({
                action: "review_generate",
                input: { date: report.date },
              });
              toast.success("复盘已保存");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <Sparkles size={16} />
          {command.isPending
            ? "正在复盘…"
            : pendingReview.length
            ? "检查复盘结果"
            : report.review
            ? "重新生成复盘"
            : "生成 AI 复盘"}
        </button>
      </div>
      {!!pendingReview.length && (
        <p className="np-notice">
          这次复盘的结果尚未确认。检查结果会继续使用同一次请求，不会重复调用
          AI。刷新页面后也可以继续查看。
        </p>
      )}
      {report.review_stale && (
        <p className="np-notice">
          记录或补充已经改变。这份复盘基于旧版本，可按需重新生成。
        </p>
      )}
      {report.review
        ? (
          <>
            <div className="np-review-overview">
              <span className="np-status">AI 分析</span>
              <p>{report.review.overview}</p>
            </div>
            <div className="np-review-grid">
              {[["今天的收获", report.review.achievements], [
                "遇到的困难",
                report.review.difficulties,
              ], ["值得留意", report.review.observations]].map((
                [label, items],
              ) => (
                <div key={label as string}>
                  <h3>{label as string}</h3>
                  <ul>
                    {(items as string[]).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {!!report.review.suggestions.length && (
              <div className="np-suggestions">
                <h3>可以试试</h3>
                {report.review.suggestions.map((suggestion, i) => (
                  <div className="np-suggestion" key={i}>
                    <p>{suggestion}</p>
                    <button
                      className="np-button"
                      disabled={!!adding || added.includes(suggestion)}
                      onClick={() =>
                        void addSuggestion(suggestion)}
                    >
                      {added.includes(suggestion)
                        ? <Check size={15} />
                        : <Plus size={15} />} {added.includes(suggestion)
                        ? "已加入"
                        : adding === suggestion
                        ? "添加中…"
                        : "加入今日待办"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="np-muted">
              生成于{" "}
              {new Date(report.review.generated_at).toLocaleString("zh-CN", {
                timeZone: report.timezone,
              })} · 记录修订 {report.review.source_revision}
            </p>
          </>
        )
        : (
          <p className="np-empty-note">
            记录已经收好。需要时，再请 AI 帮你看看其中的收获、困难与下一步。
          </p>
        )}
    </section>
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
  const { isDemo } = useDemoMode();
  const command = useNewspaperCommand();
  const [requestedSection, setRequestedSection] = useState<
    { id: NewspaperSectionId; nonce: number }
  >();
  const [lightbox, setLightbox] = useState<NewspaperImageAsset | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rawOnly, setRawOnly] = useState(false);
  const [selectedSections, setSelectedSections] = useState<
    NewspaperSectionId[]
  >(report.snapshot.sections.map((s) => s.id));
  const [source, setSource] = useState<
    { entry: NewspaperEntry; available?: boolean; error?: string } | null
  >(null);
  async function showSource(entry: NewspaperEntry) {
    setSource({ entry });
    try {
      const result = await command.mutateAsync({
        action: "source_get",
        input: {
          date: report.date,
          source: entry.source,
          source_id: entry.source_id,
        },
      });
      setSource({ entry, available: result.available });
    } catch (e) {
      setSource({ entry, error: (e as Error).message });
    }
  }
  const main = report.assets.find((a) => a.section_id === "main" && a.active);
  const day = new Date(`${report.date}T12:00:00`);
  const count = report.snapshot.sections.reduce(
    (n, s) => n + s.items.length,
    0,
  );
  return (
    <NewspaperDraftContext.Provider value={drafts}>
      <div className="np-reader-wrap">
        <div className="np-reader-toolbar">
          <button
            className="np-button"
            data-newspaper-back
            onClick={async () => {
              if (await drafts.flush()) onBack();
              else toast.error("补充原文尚未保存，请重试后再收起日报。");
            }}
          >
            <ArrowLeft size={16} />收回档案馆
          </button>
          <div className="np-inline">
            <button
              className="np-icon-button"
              aria-label="前一期日报"
              disabled={!previous}
              onClick={async () => {
                if (previous && await drafts.flush()) onDate(previous);
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="np-muted">{report.date}</span>
            <button
              className="np-icon-button"
              aria-label="后一期日报"
              disabled={!next}
              onClick={async () => {
                if (next && await drafts.flush()) onDate(next);
              }}
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="np-button"
              disabled={command.isPending}
              onClick={async () => {
                try {
                  if (!await drafts.flush()) {
                    throw new Error(
                      "请先保存补充原文。",
                    );
                  }
                  await command.mutateAsync({
                    action: "refresh",
                    input: { date: report.date },
                  });
                  toast.success("已按最新记录更新日报");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <RefreshCw size={15} />
              {report.id ? "更新快照" : "收藏这份日报"}
            </button>
          </div>
        </div>
        {report.source_check_unavailable && (
          <div className="np-notice">
            暂时无法核对原始记录是否更新，已保存快照仍可阅读。
          </div>
        )}
        {report.source_changed && (
          <div className="np-notice">
            原始记录已发生变化。当前展示保存的快照，点击「更新快照」后才会纳入修改。
          </div>
        )}
        {report.status === "reconstructed" && (
          <div className="np-notice">
            这是根据现有历史记录补建的日报，不是当天保存的档案。
          </div>
        )}
        <article className="np-paper" aria-label={`${report.date} 生活日报`}>
          <header className="np-masthead">
            <div className="np-masthead-top">
              <span>一期一日 · 留住生活</span>
              <span>{count} 则记录 · 修订 {report.revision}</span>
            </div>
            <div className="np-name">
              <span>V-Life</span>
              <h1>生活日报</h1>
            </div>
            <div className="np-masthead-bottom">
              <time dateTime={report.date}>
                {day.toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </time>
              <span>{reportStatus(report.status)}</span>
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
          <div className="np-dateline">
            <span>
              按 {report.timezone} ·{" "}
              {String(report.day_start_hour).padStart(2, "0")}:00 划分一天
            </span>
            <span>每一个普通日子，都有值得收藏的片刻。</span>
          </div>
          {!!report.snapshot.metrics.length && (
            <div className="np-metrics">
              {report.snapshot.metrics.map((m, i) => (
                <p key={i}>
                  <span>{m.label}</span>
                  <strong>{m.value.toLocaleString()}</strong>
                  <span>{m.unit}</span>
                </p>
              ))}
            </div>
          )}
          <div className={`np-editorial-grid ${main ? "np-has-main-art" : ""}`}>
            {main && <NewspaperFigure asset={main} onOpen={setLightbox} />}{" "}
            {report.snapshot.sections.filter((s) =>
              s.items.length && !report.hidden_sections.includes(s.id)
            ).map((section) => (
              <section
                className={`np-section np-section-${section.id}`}
                key={section.id}
              >
                <header className="np-section-heading">
                  <h2>{section.title}</h2>
                  <div className="np-inline">
                    <span className="np-section-english">
                      {english[section.id]}
                    </span>
                    <button
                      className="np-section-image-button"
                      aria-label={`为${section.title}配图`}
                      onClick={() => {
                        setRequestedSection({
                          id: section.id,
                          nonce: Date.now(),
                        });
                        document.getElementById("np-image-controls")
                          ?.scrollIntoView({
                            behavior: window.matchMedia(
                                "(prefers-reduced-motion: reduce)",
                              ).matches
                              ? "instant" as ScrollBehavior
                              : "smooth",
                            block: "start",
                          });
                      }}
                    >
                      <ImagePlus size={15} />
                    </button>
                  </div>
                </header>
                {report.assets.filter((a) =>
                  a.section_id === section.id && a.active
                ).map((a) => (
                  <NewspaperFigure key={a.id} asset={a} onOpen={setLightbox} />
                ))}
                {section.items.map((entry) => (
                  <OriginalEntry
                    key={entry.id}
                    entry={entry}
                    timezone={report.timezone}
                    onSource={showSource}
                  />
                ))}
              </section>
            ))}
          </div>
          {count === 0 && (
            <div className="np-empty-paper">
              <h2>这一天的纸页，还是空白的。</h2>
              <p>
                尚未找到可归入这一天的记录。你可以先补充一段经历，或记录生活后更新快照。
              </p>
              <Link className="np-text-button" to="/today">去今日待办</Link>
            </div>
          )}
          {!!report.snapshot.coverage.filter((c) => c.state === "unavailable")
            .length && (
            <p className="np-notice">
              部分记录暂时无法读取：{report.snapshot.coverage.filter((c) =>
                c.state === "unavailable"
              ).map((c) => c.message || c.source).join(
                "；",
              )}。本期并非完整汇总。
            </p>
          )}
          {report.supplements.length > 0 && (
            <SupplementNotebook report={report} />
          )}
          {report.review && <ReviewPanel report={report} />}
          <footer className="np-paper-footer">
            <span>V-Life · 生活的私人档案</span>
            <span>{report.date.replace(/-/g, ".")}</span>
          </footer>
        </article>
        <details className="np-reading-options">
          <summary>
            <Eye size={15} />版面显示与完整导出
          </summary>
          <div className="np-form-grid">
            <div>
              <h3>阅读时显示的版块</h3>
              <p className="np-muted">空版块自动收起；隐藏不会删除原文。</p>
              {report.snapshot.sections.map((section) => (
                <label className="np-check" key={section.id}>
                  <input
                    type="checkbox"
                    checked={!report.hidden_sections.includes(section.id)}
                    onChange={async (e) => {
                      const hidden = e.target.checked
                        ? report.hidden_sections.filter((id) =>
                          id !== section.id
                        )
                        : [...report.hidden_sections, section.id];
                      try {
                        if (!report.id) {
                          await command.mutateAsync({
                            action: "refresh",
                            input: { date: report.date },
                          });
                        }
                        await command.mutateAsync({
                          action: "report_update",
                          input: { date: report.date, hidden_sections: hidden },
                        });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                  {section.title} · {section.items.length}
                </label>
              ))}
            </div>
            <div>
              <h3>复制与下载选项</h3>
              <label className="np-check">
                <input
                  type="checkbox"
                  checked={rawOnly}
                  onChange={(e) => setRawOnly(e.target.checked)}
                />只要原始记录与补充，不含 AI 复盘
              </label>
              {report.snapshot.sections.map((section) => (
                <label className="np-check" key={section.id}>
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(section.id)}
                    onChange={(e) =>
                      setSelectedSections(
                        e.target.checked
                          ? [...selectedSections, section.id]
                          : selectedSections.filter((s) =>
                            s !== section.id
                          ),
                      )}
                  />
                  {section.title}
                </label>
              ))}
            </div>
          </div>
        </details>
        <div className="np-export-bar">
          <p className="np-muted">完整原文、补充、复盘与图注，都可以带走。</p>
          <div className="np-inline">
            <button
              className="np-button"
              onClick={async () => {
                try {
                  if (!await drafts.flush()) {
                    throw new Error(
                      "请先保存补充原文。",
                    );
                  }
                  const current = await callNewspaper<NewspaperReport>("get", {
                    date: report.date,
                  }, isDemo);
                  await navigator.clipboard.writeText(
                    newspaperMarkdown(current, {
                      rawOnly,
                      sections: selectedSections,
                    }),
                  );
                  toast.success("完整正文已复制，包含折叠及隐藏原文");
                } catch (e) {
                  toast.error("复制失败，请使用下载文件，或检查剪贴板权限。");
                }
              }}
            >
              <Copy size={16} />复制完整正文
            </button>
            <button
              className="np-button"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  if (!await drafts.flush()) {
                    throw new Error(
                      "请先保存补充原文。",
                    );
                  }
                  const current = await callNewspaper<NewspaperReport>("get", {
                    date: report.date,
                  }, isDemo);
                  const zip = await buildPortableNewspaper(current, {
                    rawOnly,
                    sections: selectedSections,
                  });
                  saveBlob(zip, `V-Life-${report.date}.zip`);
                  toast.success("日报已打包，包含 Markdown 与原始图片");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Download size={16} />
              {exporting ? "正在打包…" : "下载日报 ZIP"}
            </button>
          </div>
        </div>
        {report.supplements.length === 0 && (
          <SupplementNotebook report={report} />
        )} {!report.review && <ReviewPanel report={report} />}
        <NewspaperImages
          report={report}
          onOpen={setLightbox}
          requestedSection={requestedSection}
        />
        <NewspaperImageLightbox
          asset={lightbox}
          onClose={() => setLightbox(null)}
        />
        <Dialog
          open={!!source}
          onOpenChange={(open) => !open && setSource(null)}
        >
          <DialogContent className="max-h-[85vh] overflow-auto">
            <DialogTitle>{source?.entry.title}</DialogTitle>
            <DialogDescription>
              {source?.error || source?.available === false
                ? "原始记录已删除或不可用，以下仍保留归档时的原文。"
                : source?.available
                ? "原始记录仍可查看。下方是本期日报保存的原文。"
                : "正在核对记录来源…"}
            </DialogDescription>
            {source?.error && <p className="np-error">{source.error}</p>}
            <p className="np-original">{source?.entry.body}</p>
            {source?.available && (
              <Link className="np-button" to={source.entry.source_url}>
                <ExternalLink size={15} />打开来源页面
              </Link>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </NewspaperDraftContext.Provider>
  );
}
