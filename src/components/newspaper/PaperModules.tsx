import { useState } from "react";
import { ImagePlus } from "lucide-react";
import type {
  NewspaperEntry,
  NewspaperImageAsset,
  NewspaperReport,
} from "../../../supabase/functions/_shared/newspaperTypes";
import type { PaperLayout, PaperModule } from "./paperLayout";
import {
  FigurePlaceholder,
  type ImagePlacement,
  isRunningJob,
  NewspaperFigure,
} from "./NewspaperImages";

const STATUS: Record<NewspaperEntry["status"], string> = {
  completed: "已完成",
  planned: "计划 · 未标记完成",
  recorded: "记录",
};

export function clock(entry: NewspaperEntry, timezone: string) {
  if (!entry.time) return null;
  return new Date(entry.time).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function Body({ text, limit = 420, className = "np-body" }: { text: string; limit?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > limit;
  return (
    <>
      <p className={long && !open ? `${className} np-folded` : className}>{text}</p>
      {long && (
        <button
          type="button"
          className="np-text-link"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "收起正文" : "展开完整原文"}
        </button>
      )}
    </>
  );
}

function TimelineItem(
  { entry, timezone }: { entry: NewspaperEntry; timezone: string },
) {
  const time = clock(entry, timezone);
  return (
    <li className="np-tl-item">
      <time className={time ? "np-tl-time" : "np-tl-time np-tl-allday"}>{time ?? "当天"}</time>
      <div className="np-tl-body">
        <h3>
          {entry.title}
          {entry.status === "completed" && <span className="np-done">已完成</span>}
        </h3>
        <Body text={entry.body} limit={160} className="np-body np-body-small" />
      </div>
    </li>
  );
}

function StoryItem(
  { entry, timezone }: { entry: NewspaperEntry; timezone: string },
) {
  const time = clock(entry, timezone);
  return (
    <article className="np-story">
      <h3>{entry.title}</h3>
      <Body text={entry.body} />
      <p className="np-meta-line">
        <span>{time ?? "当天"} · {STATUS[entry.status]}</span>
      </p>
    </article>
  );
}

const QUANTITY = /-?\d[\d,]*(?:\.\d+)?\s?(?:[A-Z]{3}|千卡|kcal|kg|cm|元)/;

function LedgerItem({ entry }: { entry: NewspaperEntry }) {
  const value = QUANTITY.exec(entry.body)?.[0];
  const note = value
    ? entry.body.replace(value, "").replace(/^[\s·：:，,]+|[\s·：:，,]+$/g, "").replace(/\s·\s·\s/g, " · ")
    : entry.body;
  return (
    <li className="np-ledger-row">
      <div className="np-ledger-main">
        <span className="np-ledger-name">{entry.title}</span>
        {value && (
          <>
            <span className="np-ledger-leader" aria-hidden />
            <span className="np-ledger-value">{value}</span>
          </>
        )}
      </div>
      {note && <p className="np-ledger-note">{note}</p>}
    </li>
  );
}

function EssayItem(
  { entry, timezone }: { entry: NewspaperEntry; timezone: string },
) {
  const time = clock(entry, timezone);
  return (
    <article className="np-essay">
      <Body text={entry.body || entry.title} limit={360} className="np-essay-text" />
      <p className="np-meta-line">
        <span>{entry.body ? `《${entry.title}》` : ""}{time ? ` ${time}` : ""}</span>
      </p>
    </article>
  );
}

function PendingItem(
  { entry, timezone }: { entry: NewspaperEntry; timezone: string },
) {
  const time = clock(entry, timezone);
  return (
    <li className="np-pending-item">
      <span className="np-pending-box" aria-hidden />
      <div>
        <h3>{entry.title}</h3>
        <p className="np-meta-line">
          <span>{time ? `计划于 ${time}` : "当日计划"} · 未标记完成</span>
        </p>
      </div>
    </li>
  );
}

export function SectionModule(
  { module, report, onOpenAsset, onIllustrate }: {
    module: PaperModule;
    report: NewspaperReport;
    onOpenAsset: (a: NewspaperImageAsset) => void;
    onIllustrate: (p: ImagePlacement) => void;
  },
) {
  const tz = report.timezone;
  const job = module.section !== "pending"
    ? report.jobs.find((j) => j.section_id === module.section && isRunningJob(j))
    : undefined;
  const list = module.variant === "timeline" || module.variant === "ledger" ||
    module.variant === "pending";
  const items = module.items.map((entry) => {
    switch (module.variant) {
      case "timeline":
        return <TimelineItem key={entry.id} entry={entry} timezone={tz} />;
      case "ledger":
        return <LedgerItem key={entry.id} entry={entry} />;
      case "pending":
        return <PendingItem key={entry.id} entry={entry} timezone={tz} />;
      case "essay":
        return <EssayItem key={entry.id} entry={entry} timezone={tz} />;
      default:
        return <StoryItem key={entry.id} entry={entry} timezone={tz} />;
    }
  });
  return (
    <section
      id={`np-mod-${module.key}`}
      tabIndex={-1}
      className={`np-mod np-mod-${module.variant}`}
      aria-labelledby={`np-mod-${module.key}-title`}
    >
      <header className="np-mod-head">
        <h2 id={`np-mod-${module.key}-title`}>{module.title}</h2>
        <span className="np-mod-kicker">{module.items.length} 则</span>
        {module.section !== "pending" && (
          <button
            type="button"
            className="np-icon-button np-icon-quiet np-mod-illustrate"
            aria-label={`为${module.title}配图`}
            onClick={() => onIllustrate(module.section as ImagePlacement)}
          >
            <ImagePlus size={15} />
          </button>
        )}
      </header>
      {job && <FigurePlaceholder job={job} />}
      {module.figures.map((asset) => (
        <NewspaperFigure key={asset.id} asset={asset} onOpen={onOpenAsset} />
      ))}
      {module.variant === "pending" && (
        <p className="np-mod-note">这些是当天的计划，没有计入完成。</p>
      )}
      {list
        ? <ul className={`np-list np-list-${module.variant}`}>{items}</ul>
        : <div className="np-stack">{items}</div>}
    </section>
  );
}

export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
  el.focus?.({ preventScroll: true });
}

function factualDeck(report: NewspaperReport, layout: PaperLayout) {
  const parts: string[] = [];
  if (layout.completed) parts.push(`完成 ${layout.completed} 件事`);
  const recorded = layout.total - layout.planned;
  if (recorded) parts.push(`留下 ${recorded} 条记录`);
  if (layout.planned) parts.push(`${layout.planned} 项计划待续`);
  if (report.supplements.length) parts.push(`另有 ${report.supplements.length} 段亲笔补充`);
  return parts.length ? `这一天，${parts.join("，")}。` : "";
}

export function FrontPage(
  { report, layout, onOpenAsset, onIllustrate, onSupplement }: {
    report: NewspaperReport;
    layout: PaperLayout;
    onOpenAsset: (a: NewspaperImageAsset) => void;
    onIllustrate: (p: ImagePlacement) => void;
    onSupplement: () => void;
  },
) {
  const lead = layout.lead;
  const main = report.assets.find((a) => a.section_id === "main" && a.active);
  const mainJob = report.jobs.find((j) => j.section_id === "main" && isRunningJob(j));
  const leadTime = lead ? clock(lead, report.timezone) : null;
  const leadSection = report.snapshot.sections.find((s) => s.id === layout.leadSection);
  const visible = report.snapshot.sections.filter((s) =>
    s.items.length && !report.hidden_sections.includes(s.id)
  );
  return (
    <>
      <div className="np-front-lead">
        {mainJob ? <FigurePlaceholder job={mainJob} lead /> : main && (
          <NewspaperFigure asset={main} onOpen={onOpenAsset} lead />
        )}
        {lead
          ? (
            <article className="np-lead">
              <p className="np-lead-meta">
                头条 · {leadSection?.title}
                {leadTime ? ` · ${leadTime}` : ""} · {STATUS[lead.status]}
              </p>
              <h2 className="np-headline">{lead.title}</h2>
              {report.review?.overview
                ? (
                  <p className="np-deck">
                    <span className="np-ai-stamp">AI 概述</span>
                    {report.review.overview}
                  </p>
                )
                : <p className="np-deck">{factualDeck(report, layout)}</p>}
              <Body text={lead.body} limit={640} className="np-body np-lead-body" />
            </article>
          )
          : (
            <div className="np-front-empty">
              <h2 className="np-headline">这一天的纸页，还是空白的。</h2>
              <p>
                还没有归入这一天的记录。可以先写下一段经历；之后在网站里记录的事，更新快照后会排进版面。
              </p>
              <button type="button" className="np-button" onClick={onSupplement}>
                写一段补充
              </button>
            </div>
          )}
      </div>
      <aside className="np-index" aria-labelledby="np-index-title">
        <h2 id="np-index-title">本期导读</h2>
        {report.snapshot.metrics.length > 0 && (
          <dl className="np-figures">
            {report.snapshot.metrics.map((m, i) => (
              <div key={i}>
                <dt>{m.label}</dt>
                <dd>
                  <strong>{m.value.toLocaleString("zh-CN")}</strong>
                  <span>{m.unit}</span>
                </dd>
              </div>
            ))}
            {layout.planned > 0 && (
              <div>
                <dt>计划待续</dt>
                <dd><strong>{layout.planned}</strong><span>项</span></dd>
              </div>
            )}
          </dl>
        )}
        {visible.length > 0 && (
          <ol className="np-toc">
            {visible.map((s) => {
              const target = layout.modules.some((m) => m.key === s.id) ? `np-mod-${s.id}` : undefined;
              return (
                <li key={s.id}>
                  {target
                    ? <button type="button" onClick={() => jumpTo(target)}>{s.title}</button>
                    : <span>{s.title}</span>}
                  <span className="np-toc-leader" aria-hidden />
                  <span className="np-toc-count">{s.items.length}</span>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={() => jumpTo("np-supplements")}>我的补充</button>
              <span className="np-toc-leader" aria-hidden />
              <span className="np-toc-count">{report.supplements.length}</span>
            </li>
          </ol>
        )}
        {!main && !mainJob && (
          <button
            type="button"
            className="np-index-art"
            onClick={() => onIllustrate("main")}
          >
            <ImagePlus size={16} aria-hidden />
            <span>
              为头版配一幅图
              <small>{report.status === "draft" ? "今天的日报" : "往期也可以补图"}</small>
            </span>
          </button>
        )}
      </aside>
    </>
  );
}
