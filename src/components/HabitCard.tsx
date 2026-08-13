import { memo } from "react";
import { Repeat, Flame } from "lucide-react";
import { useHabitLogs, useToggleHabitLog } from "@/hooks/useData";
import { useLang } from "@/contexts/LanguageContext";

interface HabitCardProps {
  task: any;
  projectId: string;
}

function CircularProgress({ value }: { value: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg className="w-10 h-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          className="text-border"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[9px] font-medium text-muted-foreground">{Math.round(value)}%</span>
    </div>
  );
}

function HabitCardInner({ task, projectId }: HabitCardProps) {
  const { t, lang } = useLang();
  const { data: logs = [] } = useHabitLogs(task.id);
  const toggleMutation = useToggleHabitLog();

  const today = new Date().toISOString().split("T")[0];
  const isCompletedToday = logs.some((log: any) => log.log_date === today);

  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const weeklyGoal = 7;
  const completedThisWeek = logs.filter((log: any) => {
    const d = new Date(log.log_date);
    return d >= monday && d <= now;
  }).length;
  const progress = Math.min(100, (completedThisWeek / weeklyGoal) * 100);

  let streak = 0;
  const sortedLogs = [...logs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  if (sortedLogs.length > 0 && sortedLogs[0].log_date === today) {
    streak = 1;
    for (let i = 1; i < sortedLogs.length; i++) {
      const prev = new Date(sortedLogs[i - 1].log_date);
      const curr = new Date(sortedLogs[i].log_date);
      const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) streak++;
      else break;
    }
  } else if (sortedLogs.length > 0) {
    const last = new Date(sortedLogs[0].log_date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (last.toISOString().split("T")[0] === yesterday.toISOString().split("T")[0]) {
      streak = 1;
      for (let i = 1; i < sortedLogs.length; i++) {
        const prev = new Date(sortedLogs[i - 1].log_date);
        const curr = new Date(sortedLogs[i].log_date);
        const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) streak++;
        else break;
      }
    }
  }

  const handleToggle = () => {
    toggleMutation.mutate({ taskId: task.id, projectId, logDate: today });
  };

  return (
    <div className="card-premium px-3 py-3">
      <div className="flex items-center gap-2 w-full mb-2">
        <div className="h-5 w-5 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
          <Repeat className="h-3 w-3 text-primary" />
        </div>
        <span className="text-[13px] font-medium flex-1 truncate text-foreground">{task.title}</span>
        {streak > 0 && (
          <span className="text-[10px] bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
            <Flame className="h-2.5 w-2.5" /> {streak}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center">
        <CircularProgress value={progress} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 text-center">
        {lang === "zh" ? `本周 ${completedThisWeek} / ${weeklyGoal}` : `Week ${completedThisWeek} / ${weeklyGoal}`}
      </p>
      <button
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        className={`mt-2 w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
          isCompletedToday
            ? "bg-primary text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-muted-foreground"
        }`}
      >
        {isCompletedToday ? t("已打卡", "Done") : t("今日打卡", "Check In")}
      </button>
    </div>
  );
}

export const HabitCard = memo(HabitCardInner);
