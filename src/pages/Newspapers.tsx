import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Newspaper,
  Search,
  Settings2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DateField } from "@/components/arc/DateField";
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
  type NewspaperFlight,
} from "@/components/newspaper/NewspaperImmersive";
import {
  foldPaper,
  paperMotionAllowed,
  rectOf,
  reverseOpeningPaper,
  visiblePaperRect,
} from "@/components/newspaper/paperFlight";
import { reportDateAt } from "../../supabase/functions/_shared/newspaperDomain";
import type {
  NewspaperListItem,
  NewspaperReport,
} from "../../supabase/functions/_shared/newspaperTypes";

/* THESIS: A private filing cabinet of folded newspapers; one is drawn out and opened on the desk.
STORY: Pull a month's drawer, lift a paper by its date tab, unfold it to read, fold it and file it back in its slot.
MOTION: A folded paper travels and opens on one timeline; closing returns it to the same slot.
Reduced motion is instant. */
const weekdayOf = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", { weekday: "long" });
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
  const [openMonths, setOpenMonths] = useState<string[] | null>(null);
  const [restingArchive, setRestingArchive] = useState(false);
  const [silentReturnedFocus, setSilentReturnedFocus] = useState(false);
  const [locate, setLocate] = useState("");
  const [flight, setFlight] = useState<NewspaperFlight | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [landing, setLanding] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const moving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
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
  // A cached first page is ready immediately; don't flash an empty archive while
  // the pagination accumulator catches up in its effect.
  const archiveItems = useMemo(() => offset === 0 ? (list.data?.items ?? []) : loaded, [offset, list.data, loaded]);
  const groups = useMemo(() => {
    const result: Record<string, NewspaperListItem[]> = {};
    for (const item of archiveItems) {
      const key = item.date.slice(0, 7);
      (result[key] ||= []).push(item);
    }
    return Object.entries(result).sort(([a], [b]) => b.localeCompare(a));
  }, [archiveItems]);
  /* Only the latest drawer is pulled out at first; a search pulls out every drawer with a match. */
  const isOpen = (month: string) =>
    query ? true : openMonths ? openMonths.includes(month) : month === groups[0]?.[0];
  const setMonthOpen = (month: string, open: boolean) =>
    setOpenMonths((current) => {
      const base = current ?? (groups[0] ? [groups[0][0]] : []);
      return open ? [...new Set([...base, month])] : base.filter((value) => value !== month);
    });
  const away = requested ? date : landing;

  /** The slot of a paper, only when its drawer is out and the slot can be seen. */
  function slotRect(paperDate: string) {
    const slot = document.getElementById(`paper-${paperDate}`);
    if (!slot || !slot.closest(".np-drawer-open")) return null;
    const sheet = rectOf(slot.querySelector(".np-file-sheet"));
    if (!sheet) return null;
    /* The file in front hides the lower part of this sheet; only the part above it is the slot. */
    const front = slot.nextElementSibling?.getBoundingClientRect().top;
    const height = front ? Math.min(sheet.height, front - sheet.top) : sheet.height;
    return { ...sheet, height: Math.max(24, height) };
  }

  async function navigateDate(nextDate: string) {
    if (opening || moving.current) return;
    if (date) {
      setParams({ date: nextDate });
      document.querySelector(".np-immersive")?.scrollTo({ top: 0 });
      return;
    }
    scroll.current = {
      window: window.scrollY,
      main: archiveRef.current?.closest("main")?.scrollTop || 0,
    };
    setOpening(nextDate);
    setOpenError("");
    try {
      await qc.ensureQueryData({
        queryKey: ["newspaper", isDemo ? "demo" : user?.id, "get", {
          date: nextDate,
        }],
        queryFn: () =>
          callNewspaper<NewspaperReport>("get", { date: nextDate }, isDemo),
      });
      if (!mounted.current) return;
      flushSync(() => {
        setFlight({
          from: slotRect(nextDate),
          cover: document.getElementById(`paper-${nextDate}`)?.querySelector<HTMLElement>(".np-file-sheet")?.cloneNode(true) as HTMLElement | undefined,
        });
        setParams({ date: nextDate });
        setOpening(null);
      });
    } catch (error) {
      if (!mounted.current) return;
      setOpening(null);
      setOpenError((error as Error).message);
    }
  }

  async function back() {
    const panel = document.querySelector<HTMLElement>(".np-immersive");
    if (moving.current) return;
    if (!date) { setParams({}); return; }
    moving.current = true;
    const current = date;
    const paper = panel?.querySelector<HTMLElement>(".np-paper") ?? null;
    const open = visiblePaperRect(paper);
    const month = current.slice(0, 7);
    flushSync(() => {
      setLanding(current);
      if (!isOpen(month)) setMonthOpen(month, true);
      setRestingArchive(true);
      setSilentReturnedFocus(true);
    });
    let settled = false;
    const land = () => {
      if (settled) return;
      settled = true;
      flushSync(() => setLanding(null));
    };
    const close = () => flushSync(() => { setParams({}); setFlight(null); });
    const restoreSlot = () => {
      window.scrollTo({ top: scroll.current.window, behavior: "instant" as ScrollBehavior });
      archiveRef.current?.closest("main")?.scrollTo({ top: scroll.current.main, behavior: "instant" });
      const slot = document.getElementById(`paper-${current}`);
      const r = slot?.getBoundingClientRect();
      if (slot && r && (r.top < 80 || r.bottom > window.innerHeight - 24)) {
        slot.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      }
      return slotRect(current);
    };
    try {
      if (panel && paper && open && paperMotionAllowed()) {
        const wasOpening = panel.dataset.flight === "unfolding";
        panel.dataset.flight = "folding";
        const reversed = wasOpening && await reverseOpeningPaper(paper);
        if (!reversed) await foldPaper({
          paper, open, desk: panel, to: restoreSlot,
          cover: document.getElementById(`paper-${current}`)?.querySelector<HTMLElement>(".np-file-sheet"),
        });
      } else restoreSlot();
    } finally {
      // Handoff happens once, after the travelling paper reaches its original slot.
      if (mounted.current) {
        close();
        land();
        document.getElementById(`paper-${current}`)?.focus({ preventScroll: true });
      }
      moving.current = false;
    }
  }

  const sorted = archiveItems.map((r) => r.date).sort();
  const index = date ? sorted.indexOf(date) : -1;
  return (
    <>
      <AppLayout title={t("生活日报", "Life newspaper")} header={false}>
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
              <h1>{t("日报档案", "Newspaper archive")}</h1>
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
              <DateField
                id="np-locate-date"
                inline
                label="按日期找报"
                value={locate}
                max={today}
                onChange={setLocate}
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
            <span>{preferences.data?.enabled ? t("每日自动收藏", "Collected daily") : t("按日收藏", "Collected by day")}</span>
            <span>
              {isDemo ? "演示档案 · 虚构记录" : `${archiveItems.length} 份已载入`}
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
              const open = isOpen(month);
              const dates = papers.map((paper) => paper.date).sort();
              const toggle = () => setMonthOpen(month, !open);
              return (
              <section
                className={`np-drawer ${open ? "np-drawer-open" : ""}`}
                key={month}
              >
                <button
                  id={`month-label-${month}`}
                  className="np-drawer-front"
                  aria-expanded={open}
                  aria-controls={`month-papers-${month}`}
                  aria-label={`${month.slice(0, 4)}年${Number(month.slice(5))}月，${papers.length} 份日报`}
                  onClick={toggle}
                >
                  <span className="np-drawer-holder">
                    <span className="np-drawer-card">
                      <small>{month.slice(0, 4)}</small>
                      <strong>{Number(month.slice(5))}<small>月</small></strong>
                    </span>
                  </span>
                  <span className="np-drawer-handle" aria-hidden="true"><span /></span>
                  <span className="np-drawer-count">
                    <b>{papers.length} 份</b>
                    <span>{dates[0].slice(5).replace("-", ".")} — {dates[dates.length - 1].slice(5).replace("-", ".")}</span>
                  </span>
                </button>
                <div
                  id={`month-papers-${month}`}
                  className="np-drawer-tray"
                  aria-hidden={!open}
                  ref={(node) => { if (node) node.inert = !open; }}
                >
                  <div className="np-tray-clip">
                    <div className="np-tray">
                      {papers.map((paper) => (
                        <button
                          id={`paper-${paper.date}`}
                          key={paper.id || paper.date}
                          className={`np-file ${opening === paper.date ? "np-extracting" : ""} ${
                            away === paper.date ? "np-away" : ""
                          }`}
                          onClick={() => void navigateDate(paper.date)}
                          disabled={!!opening}
                          aria-label={`展开 ${paper.date} 生活日报：${paper.title}`}
                          aria-busy={opening === paper.date}
                        >
                          <span className="np-file-tab">
                            <b>{paper.date.slice(8)}</b>
                            <small>{weekdayOf(paper.date).replace("星期", "周")}</small>
                          </span>
                          <span className="np-file-sheet">
                            <span className="np-file-story">
                              <strong>{paper.title}</strong>
                              <span title={paper.excerpt}>{query ? paper.excerpt : paper.excerpt.split(" · ")[0]}</span>
                            </span>
                            {paper.thumbnail_url && (
                              <img
                                className="np-file-thumb"
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
                            <span className="np-file-status">
                              <span>{reportStatus(paper.status)}</span>
                              <ArrowUpRight size={17} className="np-file-read" aria-hidden="true" />
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              );
            })}
          </div>
          {!list.isLoading && !list.error && !archiveItems.length && (
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
        </div>
      </AppLayout>
      {requested && (
        <NewspaperImmersive
          flight={flight}
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
