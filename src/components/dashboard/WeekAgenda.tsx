import { useEffect, useRef, useState, type CSSProperties } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { useLang } from "@/contexts/LanguageContext";
import { IMPORTANCE_COLORS } from "@/components/schedule/EventBlock";
import "@/styles/week-agenda.css";

type AgendaEvent = Pick<Tables<"schedule_events">,
  "id" | "title" | "start_time" | "end_time" | "color" | "importance" | "recurrence" | "parent_event_id"
>;

function isOccurrence(event: AgendaEvent) {
  const rule = event.recurrence as { type?: string; days_of_week?: number[] } | null;
  if (event.parent_event_id || rule?.type !== "weekly" || !rule.days_of_week?.length) return true;
  return rule.days_of_week.includes(new Date(event.start_time).getDay() || 7);
}

export function WeekAgenda({ events, weekStart, today, loading, failed, onRetry }: {
  events: AgendaEvent[];
  weekStart: Date;
  today: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t, lang } = useLang();
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const labels = lang === "zh" ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const occurrences = events.filter(isOccurrence);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const end = addDays(date, 1);
    return {
      date, end, key: format(date, "yyyy-MM-dd"), label: labels[index],
      events: occurrences.filter((event) => new Date(event.start_time) < end && new Date(event.end_time) > date)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    };
  });

  useEffect(() => {
    const container = scroller.current;
    const current = container?.querySelector<HTMLElement>("[data-today]");
    if (container && current && container.scrollWidth > container.clientWidth) {
      container.scrollLeft = current.offsetLeft - container.offsetLeft - 8;
    }
  }, [today]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="week-agenda card-premium" aria-label={t("本周日程预览", "This week's agenda")} aria-busy={loading}>
      <header className="agenda-heading">
        <div className="agenda-heading-title">
          <h2 className="heading-font">{t("这一周的安排", "The week ahead")}</h2>
          <span className="agenda-range">{format(weekStart, "M.d")} — {format(addDays(weekStart, 6), "M.d")}</span>
        </div>
        <Link to={`/schedule?date=${today}`} className="agenda-open">{t("完整日程", "Full calendar")}<ArrowRight size={14} /></Link>
      </header>
      {failed ? (
        <div className="agenda-notice" role="alert">
          <p>{t("暂时没能读到日程", "The schedule could not be loaded")}</p>
          <button type="button" onClick={onRetry}>{t("重新加载", "Try again")}</button>
        </div>
      ) : (
        <div className="agenda-scroll" ref={scroller}>
          {days.map((day) => {
            const isToday = day.key === today;
            const next = isToday ? day.events.findIndex((event) => new Date(event.end_time).getTime() > now) : 0;
            // Keep one recent event as context, followed by the next two arrangements.
            const start = isToday ? Math.min(Math.max(0, next < 0 ? day.events.length - 3 : next - 1), Math.max(0, day.events.length - 3)) : 0;
            const preview = day.events.slice(start, start + 3);
            return (
              <div key={day.key} className={`agenda-day${isToday ? " agenda-today" : ""}`} data-today={isToday || undefined}>
                <Link className="agenda-day-heading" to={`/schedule?date=${day.key}`} aria-current={isToday ? "date" : undefined}
                  aria-label={`${format(day.date, "M.d")} ${day.label}${isToday ? ` · ${t("今天", "Today")}` : ""}`}>
                  <span>{isToday ? t("今天", "Today") : day.label}</span><span>{format(day.date, "d")}</span>
                </Link>
                <div className="agenda-events">
                  {loading ? Array.from({ length: 3 }, (_, i) => <div className="agenda-placeholder" key={i} aria-hidden="true" />) : preview.map((event) => {
                    const start = parseISO(event.start_time);
                    const end = parseISO(event.end_time);
                    const color = event.color || IMPORTANCE_COLORS[event.importance ?? "普通"] || IMPORTANCE_COLORS["普通"];
                    const time = start < day.date ? t("跨日", "Ongoing") : format(start, "HH:mm");
                    const fullTime = `${time} — ${end > day.end ? t("次日", "Next day") : format(end, "HH:mm")}`;
                    return (
                      <Link key={event.id} className="agenda-event" style={{ "--agenda-color": color } as CSSProperties}
                        to={`/schedule?date=${day.key}`} aria-label={`${event.title}，${fullTime}`} title={`${event.title} · ${fullTime}`}>
                        <span className="agenda-event-time">{time}</span>
                        <span className="agenda-event-title">{event.title}</span>
                      </Link>
                    );
                  })}
                  {!loading && day.events.length === 0 && <Link className="agenda-free" to={`/schedule?date=${day.key}`}>{t("留一点空白", "Room to breathe")}<span>{t("安排这一天", "Plan the day")}<ChevronRight size={12} /></span></Link>}
                </div>
                {!loading && day.events.length > 3 && <Link className="agenda-more" to={`/schedule?date=${day.key}`}>{t(`还有 ${day.events.length - 3} 项`, `${day.events.length - 3} more`)}<ChevronRight size={12} /></Link>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
