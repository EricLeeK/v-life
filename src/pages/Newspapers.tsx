import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Newspaper,
  Search,
  Settings2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useLang } from "@/contexts/LanguageContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  callNewspaper,
  useNewspaper,
  useNewspaperPreferences,
  useNewspapers,
} from "@/hooks/useNewspapers";
import {
  NewspaperReader,
  reportStatus,
} from "@/components/newspaper/NewspaperReader";
import {
  NewspaperImmersive,
  type NewspaperOrigin,
} from "@/components/newspaper/NewspaperImmersive";
import { reportDateAt } from "../../supabase/functions/_shared/newspaperDomain";
import type {
  NewspaperListItem,
  NewspaperReport,
} from "../../supabase/functions/_shared/newspaperTypes";

/* THESIS: Folded newspaper edges on a private archive shelf, drawn out into a full-window reading desk.
OWN-WORLD: Warm Desk Ledger ink and paper; visible folds, fine sheet edges, serif mastheads, month drawer pulls.
STORY: Find the date along a folded spine, draw that very paper out, read and annotate, return it to its place.
FIRST VIEWPORT: Slim overlapping paper folds expose dates and fragments inside horizontal month drawers.
FORM: User-pinned edge-on archive and immersive full-window newspaper. No right-pane reader or front-facing cards.
MOTION: One shared sheet expands from its actual shelf bounds over 720ms; return reverses the path. Reduced motion is instant.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md */
type ViewTransition = { finished: Promise<void>; skipTransition: () => void };
type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};
export default function NewspapersPage() {
  const { t } = useLang();
  const { isDemo } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requested = params.get("date");
  const preferences = useNewspaperPreferences();
  const today = reportDateAt(
    new Date(),
    preferences.data?.timezone || "Asia/Shanghai",
    preferences.data?.day_start_hour ?? 0,
  );
  const date = requested === "today"
    ? (preferences.data ? today : undefined)
    : requested || undefined;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<NewspaperListItem[]>([]);
  const list = useNewspapers(query, offset);
  const report = useNewspaper(date);
  const archiveRef = useRef<HTMLDivElement>(null);
  const scroll = useRef({ window: 0, main: 0 });
  const lastButton = useRef<string | null>(null);
  const restoringArchive = useRef(false);
  const [closed, setClosed] = useState<string[]>([]);
  const [restingArchive, setRestingArchive] = useState(false);
  const [silentReturnedFocus, setSilentReturnedFocus] = useState(false);
  const [locate, setLocate] = useState("");
  const [origin, setOrigin] = useState<NewspaperOrigin | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(requested);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const [nativeTransition, setNativeTransition] = useState(false);
  const transitionRef = useRef<ViewTransition | null>(null);
  const moving = useRef(false);
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => {
      setQuery(search);
      setOffset(0);
      setLoaded([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    if (list.data) {
      setLoaded((old) =>
        offset === 0 ? list.data!.items : [
          ...old,
          ...list.data!.items.filter((item) =>
            !old.some((row) => row.date === item.date)
          ),
        ]
      );
    }
  }, [list.data, offset]);
  const groups = useMemo(() => {
    const result: Record<string, NewspaperListItem[]> = {};
    for (const item of loaded) {
      const key = item.date.slice(0, 7);
      (result[key] ||= []).push(item);
    }
    return Object.entries(result).sort(([a], [b]) => b.localeCompare(a));
  }, [loaded]);
  useEffect(() => {
    if (date && (!selectedDate || selectedDate === "today")) {
      setSelectedDate(date);
      lastButton.current = date;
    }
  }, [date, selectedDate]);
  function transition(update: () => void, direction: "opening" | "closing") {
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as TransitionDocument;
    transitionRef.current?.skipTransition();
    if (doc.startViewTransition && !reduced) {
      document.documentElement.dataset.npTransition = direction;
      const running = doc.startViewTransition(() => flushSync(update));
      transitionRef.current = running;
      void running.finished.catch(() => {}).finally(() => {
        if (transitionRef.current === running) {
          transitionRef.current = null;
          delete document.documentElement.dataset.npTransition;
          moving.current = false;
        }
      });
      return true;
    }
    flushSync(update);
    moving.current = false;
    return false;
  }
  async function navigateDate(nextDate: string) {
    if (opening || moving.current) return;
    if (date) {
      setParams({ date: nextDate });
      document.querySelector(".np-immersive")?.scrollTo({ top: 0 });
      return;
    }
    const paper = document.getElementById(`paper-${nextDate}`);
    const bounds = paper?.getBoundingClientRect();
    scroll.current = {
      window: window.scrollY,
      main: archiveRef.current?.closest("main")?.scrollTop || 0,
    };
    lastButton.current = nextDate;
    flushSync(() => {
      setSelectedDate(nextDate);
      setOpening(nextDate);
      setOpenError("");
      setOrigin(
        bounds
          ? {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
          }
          : null,
      );
    });
    try {
      await qc.ensureQueryData({
        queryKey: ["newspaper", isDemo ? "demo" : user?.id, "get", {
          date: nextDate,
        }],
        queryFn: () =>
          callNewspaper<NewspaperReport>("get", { date: nextDate }, isDemo),
      });
      const native = !!(document as TransitionDocument).startViewTransition &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      flushSync(() => setNativeTransition(native));
      moving.current = true;
      transition(() => {
        setParams({ date: nextDate });
        setOpening(null);
      }, "opening");
    } catch (error) {
      setOpening(null);
      setOpenError((error as Error).message);
      moving.current = false;
    }
  }
  async function back() {
    if (moving.current && transitionRef.current) {
      transitionRef.current.skipTransition();
    }
    moving.current = true;
    setRestingArchive(true);
    setSilentReturnedFocus(true);
    restoringArchive.current = true;
    const doc = document as TransitionDocument;
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition && !reduced && origin) {
      const paper = document.querySelector<HTMLElement>(
        ".np-immersive .np-paper",
      );
      if (paper?.animate) {
        const rect = paper.getBoundingClientRect();
        paper.getAnimations?.().forEach((animation) => animation.cancel());
        const animation = paper.animate([{
          transform: "none",
          clipPath: "inset(0)",
          opacity: 1,
        }, {
          transform: `translate(${origin.left - rect.left}px,${
            origin.top - rect.top
          }px) scale(${origin.width / rect.width},${
            origin.height / Math.min(rect.height, window.innerHeight - 80)
          })`,
          clipPath: "inset(42% 0 42% 0)",
          opacity: .3,
        }], {
          duration: 520,
          easing: "cubic-bezier(.4,0,.2,1)",
          fill: "forwards",
        });
        await animation.finished.catch(() => {});
      }
    }
    transition(() => setParams({}), "closing");
  }
  useEffect(() => {
    if (requested || !restoringArchive.current) return;
    let cancelled = false;
    const restore = () => {
      if (cancelled) return;
      window.scrollTo({ top: scroll.current.window, behavior: "instant" as ScrollBehavior });
      archiveRef.current?.closest("main")?.scrollTo({ top: scroll.current.main });
      document.getElementById(`paper-${lastButton.current}`)?.focus({ preventScroll: true });
    };
    // A native transition can reset focus when its old document snapshot is removed.
    // Restore after that handoff and after the immersive root releases inert.
    void (transitionRef.current?.finished.catch(() => {}) ?? Promise.resolve())
      .then(() => requestAnimationFrame(restore));
    restoringArchive.current = false;
    return () => { cancelled = true; };
  }, [requested]);
  const sorted = loaded.map((r) => r.date).sort();
  const index = date ? sorted.indexOf(date) : -1;
  return (
    <>
      <AppLayout title={t("生活日报", "Life newspaper")}>
        <div
          className={`np-scope np-archive ${restingArchive ? "np-returned" : ""} ${silentReturnedFocus ? "np-returned-focus" : ""}`}
          ref={archiveRef}
          aria-hidden={requested ? true : undefined}
          onPointerMove={() => restingArchive && setRestingArchive(false)}
          onPointerDown={() => {
            setRestingArchive(false);
            setSilentReturnedFocus(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") setSilentReturnedFocus(false);
          }}
        >
          <header className="np-archive-header">
            <div>
              <h2>{t("日报档案", "Newspaper archive")}</h2>
              <p>
                {t(
                  "从纸页的折边，取出属于你的一天。",
                  "Draw a day from the folds of your life.",
                )}
              </p>
            </div>
            <div className="np-inline">
              <button
                className="np-button np-button-primary"
                disabled={preferences.isLoading || !!opening}
                onClick={() => void navigateDate(today)}
              >
                <Newspaper size={17} />
                {opening === today
                  ? "正在取报…"
                  : t("读今天的日报", "Read today’s paper")}
              </button>
              <Link
                to="/settings#settings-newspaper"
                className="np-icon-button"
                aria-label="日报设置"
              >
                <Settings2 size={18} />
              </Link>
            </div>
          </header>
          <div className="np-archive-tools">
            <label className="np-search">
              <Search size={18} />
              <span className="sr-only">搜索日报原文</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="找一句话、一件事、某一天…"
              />
            </label>
            <form
              className="np-date-locate"
              onSubmit={(e) => {
                e.preventDefault();
                if (locate) void navigateDate(locate);
              }}
            >
              <CalendarDays size={17} />
              <label className="sr-only" htmlFor="np-locate-date">
                按日期找报
              </label>
              <input
                id="np-locate-date"
                type="date"
                value={locate}
                max={today}
                onChange={(e) => setLocate(e.target.value)}
                required
              />
              <button
                className="np-text-button"
                type="submit"
                disabled={!!opening}
              >
                取报
              </button>
            </form>
          </div>
          <div className="np-archive-meta">
            <span>
              <Archive size={14} />
              {preferences.data?.enabled ? "每日自动收藏" : "手动收藏"} ·{" "}
              {preferences.data?.timezone || "Asia/Shanghai"} ·{" "}
              {String(preferences.data?.day_start_hour ?? 0).padStart(
                2,
                "0",
              )}:00 日界线
            </span>
            <span>
              {isDemo ? "演示档案 · 虚构记录" : `${loaded.length} 份已载入`}
            </span>
          </div>
          {openError && (
            <p className="np-notice np-error" role="alert">
              这份日报暂时没有打开：{openError}。请再试一次。
            </p>
          )}
          {list.isLoading && (
            <div className="np-loading" role="status">正在整理档案…</div>
          )}
          {list.error && (
            <div className="np-notice np-error" role="alert">
              日报库暂时无法读取：{list.error.message}
              <button className="np-text-button" onClick={() => list.refetch()}>
                重试
              </button>
            </div>
          )}
          <div className="np-cabinet">
            {groups.map(([month, papers]) => {
              const isClosed = closed.includes(month);
              const dates = papers.map((paper) => paper.date).sort();
              const toggle = () => setClosed((current) =>
                current.includes(month) ? current.filter((value) => value !== month) : [...current, month]
              );
              return (
              <section
                className={`np-shelf-drawer ${
                  isClosed ? "np-drawer-shut" : ""
                }`}
                key={month}
              >
                <button
                  id={`month-label-${month}`}
                  className="np-shelf-label"
                  aria-expanded={!isClosed}
                  aria-controls={`month-papers-${month}`}
                  onClick={toggle}
                >
                  <span className="np-shelf-label-date">
                    <span>{month.slice(0, 4)}</span>
                    <strong>
                      {Number(month.slice(5))}
                      <small>月</small>
                    </strong>
                  </span>
                  <span className="np-shelf-label-count">
                    {papers.length} 份日报
                  </span>
                  <ChevronDown size={17} />
                </button>
                <div className="np-drawer-body">
                  <div className="np-bundle-reveal" aria-hidden={!isClosed} ref={(node) => { if (node) node.inert = !isClosed; }}>
                    <div className="np-stack-clip">
                      <button className="np-month-bundle" onClick={() => {
                        toggle();
                        requestAnimationFrame(() => document.getElementById(`month-label-${month}`)?.focus({ preventScroll: true }));
                      }} tabIndex={isClosed ? 0 : -1} aria-label={`展开 ${month.slice(0, 4)}年${Number(month.slice(5))}月的 ${papers.length} 份日报`}>
                        <span className="np-bundle-leaves" aria-hidden="true" />
                        <span className="np-bundle-face">
                          <span className="np-bundle-mark" aria-hidden="true">V-Life</span>
                          <span className="np-bundle-title"><strong>{papers.length} 份日报</strong><span>{dates[0].slice(5).replace("-", ".")} — {dates[dates.length - 1].slice(5).replace("-", ".")}</span></span>
                          <span className="np-bundle-action">展开本月 <ArrowUpRight size={17} /></span>
                        </span>
                      </button>
                    </div>
                  </div>
                  <div id={`month-papers-${month}`} className="np-stack-reveal" aria-hidden={isClosed} ref={(node) => { if (node) node.inert = isClosed; }}>
                    <div className="np-stack-clip">
                  <div className="np-paper-stack">
                    {papers.map((paper, n) => (
                      <button
                        id={`paper-${paper.date}`}
                        key={paper.id || paper.date}
                        className={`np-folded-paper np-spine ${
                          opening === paper.date ? "np-extracting" : ""
                        } ${
                          requested && selectedDate === paper.date
                            ? "np-away"
                            : ""
                        }`}
                        style={{
                          viewTransitionName:
                            !requested && selectedDate === paper.date
                              ? "np-sheet"
                              : undefined,
                          "--np-sheet-index": n % 4,
                        } as React.CSSProperties}
                        onClick={() => void navigateDate(paper.date)}
                        disabled={!!opening}
                        aria-label={`展开 ${paper.date} 生活日报`}
                        aria-busy={opening === paper.date}
                      >
                        <span
                          className="np-spine-underleaf"
                          aria-hidden="true"
                        />
                        <span className="np-spine-fold" aria-hidden="true" />
                        <span className="np-spine-face">
                          <span className="np-spine-masthead">
                            <b>V-Life</b>
                            <span>生活日报</span>
                          </span>
                          <time className="np-spine-date" dateTime={paper.date}>
                            <b>{paper.date.slice(8)}</b>
                            <small>
                              {new Date(`${paper.date}T12:00:00`)
                                .toLocaleDateString("zh-CN", {
                                  weekday: "short",
                                })}
                            </small>
                          </time>
                          <span className="np-spine-story">
                            <strong>{paper.title}</strong>
                            <span>{paper.excerpt}</span>
                          </span>
                          {paper.thumbnail_url && (
                            <img
                              className="np-spine-thumbnail"
                              key={paper.thumbnail_url}
                              src={paper.thumbnail_url}
                              alt="本期配图缩略图"
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          <span className="np-spine-status">
                            <span>{reportStatus(paper.status)}</span>
                            <small>{paper.record_count} 则</small>
                          </span>
                          <ArrowUpRight className="np-spine-arrow" size={18} />
                        </span>
                      </button>
                    ))}
                  </div>
                    </div>
                  </div>
                </div>
              </section>
              );
            })}
          </div>
          {!list.isLoading && !list.error && !loaded.length && (
            <div className="np-empty-paper">
              <Newspaper size={38} />
              <h3>
                {search ? "还没有找到这段记录" : "第一份日报，从今天开始。"}
              </h3>
              <p>
                {search
                  ? "换一个词试试，或用日期直接取报。"
                  : "你在 V-Life 留下的记录，将在这里汇成每日的生活报纸。"}
              </p>
              <button
                className="np-button np-button-primary"
                disabled={!!opening}
                onClick={() => void navigateDate(today)}
              >
                打开今天
              </button>
            </div>
          )}
          {list.data?.hasMore && (
            <button
              className="np-button np-load-more"
              disabled={list.isFetching}
              onClick={() => setOffset(list.data!.nextOffset ?? offset + 100)}
            >
              再取出一些往期日报
            </button>
          )}
          <footer className="np-archive-footer">
            <span>V-Life 私人档案馆</span>
            <p>不是每一天都惊天动地，每一天都属于你。</p>
          </footer>
        </div>
      </AppLayout>
      {requested && (
        <NewspaperImmersive
          origin={origin}
          useNativeTransition={nativeTransition}
        >
          {(report.isLoading ||
            (requested === "today" && preferences.isLoading)) && (
            <div className="np-loading" role="status">
              <Newspaper size={36} />
              <p>正在展开 {date} 的日报…</p>
              <button
                data-newspaper-back
                className="np-button"
                onClick={() =>
                  void back()}
              >
                <ArrowLeft size={16} />收回档案馆
              </button>
            </div>
          )}
          {(report.error || preferences.error) && (
            <div className="np-empty-paper">
              <h2>这份日报暂时没有打开</h2>
              <p className="np-error">
                {report.error?.message || preferences.error?.message}
              </p>
              <div className="np-inline">
                <button className="np-button" onClick={() => report.refetch()}>
                  重新加载
                </button>
                <button
                  data-newspaper-back
                  className="np-button"
                  onClick={() => void back()}
                >
                  收回档案馆
                </button>
              </div>
            </div>
          )}
          {report.data && (
            <NewspaperReader
              key={date}
              report={report.data}
              onBack={() => void back()}
              onDate={(nextDate) => void navigateDate(nextDate)}
              previous={index > 0 ? sorted[index - 1] : undefined}
              next={index >= 0 ? sorted[index + 1] : undefined}
            />
          )}
        </NewspaperImmersive>
      )}
    </>
  );
}
