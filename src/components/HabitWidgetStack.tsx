import { Flame, Minus, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import {
  habitStreak,
  isHabitMetToday,
  weekCheckins,
  type HabitLogLike,
} from "@/lib/habits";

export type HabitWidget = {
  id: string;
  title: string;
  habit_type?: string | null;
  habit_target?: number | null;
  habit_unit?: string | null;
  created_at?: string;
};

export type HabitLogRow = HabitLogLike & { todo_id: string; log_date: string };

type Props = {
  habits: HabitWidget[];
  logs: HabitLogRow[];
  today: string;
  onChange: (todoId: string, patch: { value?: number | null; broken?: boolean; remove?: boolean }) => void;
};

export function HabitWidgetStack({ habits, logs, today, onChange }: Props) {
  const { t } = useLang();
  if (habits.length === 0) return null;

  const metCount = habits.filter((h) => {
    const log = logs.find((l) => l.todo_id === h.id && l.log_date === today);
    return isHabitMetToday(h, log);
  }).length;

  return (
    <section className="space-y-2" aria-label={t("今日习惯", "Today's habits")}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("今日习惯", "Habits")}
        </h3>
        <span className="text-xs font-mono-data text-muted-foreground">
          {metCount} / {habits.length}
        </span>
      </div>
      <div className="space-y-2">
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            logs={logs.filter((l) => l.todo_id === habit.id)}
            today={today}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function HabitRow({
  habit,
  logs,
  today,
  onChange,
}: {
  habit: HabitWidget;
  logs: HabitLogRow[];
  today: string;
  onChange: Props["onChange"];
}) {
  const { t } = useLang();
  const todayLog = logs.find((l) => l.log_date === today);
  const since = habit.created_at ? habit.created_at.slice(0, 10) : undefined;
  const streak = habitStreak(habit, logs, today, since);
  const week = weekCheckins(habit, logs, today);
  const met = isHabitMetToday(habit, todayLog);
  const value = Number(todayLog?.value) || 0;
  const target = Number(habit.habit_target) || 0;
  const unit = habit.habit_unit || (habit.habit_type === "duration" ? t("分钟", "min") : "");
  const isPersist = habit.habit_type === "checkin" || habit.habit_type === "avoidance";

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Repeat className="h-3.5 w-3.5 text-cat-orange" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{habit.title}</span>
          {streak > 0 && (
            <span className="text-[10px] font-medium text-cat-orange flex items-center gap-0.5">
              <Flame className="h-2.5 w-2.5" /> {streak}
            </span>
          )}
        </div>
        {isPersist && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("本周", "Week")} {week}/7
          </p>
        )}
        {(habit.habit_type === "count" || habit.habit_type === "duration") && (
          <div className="mt-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-cat-green"
                style={{ width: `${Math.min(100, target ? (value / target) * 100 : 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {value} / {target} {unit}
            </p>
          </div>
        )}
      </div>
      {isPersist && (
        <Button
          size="sm"
          className={`h-7 text-xs ${met ? "bg-primary text-primary-foreground" : ""}`}
          variant={met ? "default" : "outline"}
          onClick={() => onChange(habit.id, met ? { remove: true } : { value: 1 })}
        >
          {habit.habit_type === "avoidance"
            ? met
              ? t("已坚持", "Held")
              : t("继续坚持", "Keep going")
            : met
              ? t("已打卡", "Done")
              : t("今日打卡", "Check in")}
        </Button>
      )}
      {(habit.habit_type === "count" || habit.habit_type === "duration") && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-7 w-7"
            aria-label={t("减少", "Decrease")}
            onClick={() => {
              const next = Math.max(0, value - (habit.habit_type === "duration" ? 5 : 1));
              if (next === 0) onChange(habit.id, { remove: true });
              else onChange(habit.id, { value: next });
            }}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-7 w-7 bg-primary text-primary-foreground"
            aria-label={t("增加", "Increase")}
            onClick={() => onChange(habit.id, { value: value + (habit.habit_type === "duration" ? 5 : 1) })}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
