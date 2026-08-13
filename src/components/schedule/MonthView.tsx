import { useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { IMPORTANCE_COLORS } from "./EventBlock";

export function MonthView({ baseDate, events, onEdit, onCreateAt }: {
  baseDate: Date;
  events: any[];
  onEdit: (e: any) => void;
  onCreateAt: (start: Date, end: Date) => void;
}) {
  const { t, lang } = useLang();
  const today = new Date();
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      rows.push(week);
    }
    return rows;
  }, [calStart, calEnd]);

  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((e: any) => format(new Date(e.start_time), "yyyy-MM-dd") === dayStr);
  };

  const weekDays = lang === "zh" ? ["一", "二", "三", "四", "五", "六", "日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Week header */}
      <div className="grid grid-cols-7 bg-card border-b border-border">
        {weekDays.map((d) => (
          <div key={d} className="p-2 text-center text-xs text-muted-foreground font-medium">{d}</div>
        ))}
      </div>
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((day) => {
            const isCurrentMonth = isSameMonth(day, baseDate);
            const isToday = isSameDay(day, today);
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={day.toISOString()}
                role="button"
                tabIndex={0}
                aria-label={format(day, "yyyy-MM-dd")}
                className={`min-h-[80px] p-1 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors ${
                  !isCurrentMonth ? "opacity-40" : ""
                }`}
                onClick={() => {
                  const start = new Date(day);
                  start.setHours(9, 0, 0, 0);
                  const end = new Date(day);
                  end.setHours(10, 0, 0, 0);
                  onCreateAt(start, end);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const start = new Date(day);
                    start.setHours(9, 0, 0, 0);
                    const end = new Date(day);
                    end.setHours(10, 0, 0, 0);
                    onCreateAt(start, end);
                  }
                }}
              >
                <div className={`text-xs text-right mb-1 ${
                  isToday
                    ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center ml-auto"
                    : "text-muted-foreground"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev: any) => {
                    const color = ev.color || IMPORTANCE_COLORS[ev.importance || "普通"] || "#0ea5e9";
                    return (
                      <div
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${ev.title} ${format(new Date(ev.start_time), "HH:mm")}`}
                        className="text-[10px] truncate rounded px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        style={{ background: color + "20", color }}
                        onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            e.preventDefault();
                            onEdit(ev);
                          }
                        }}
                      >
                        {format(new Date(ev.start_time), "HH:mm")} {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
