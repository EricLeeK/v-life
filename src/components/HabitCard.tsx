import { Card, CardContent } from "@/components/ui/card";
import { Repeat } from "lucide-react";
import { useHabitLogs, useToggleHabitLog } from "@/hooks/useData";
import { useLang } from "@/contexts/LanguageContext";

interface HabitCardProps {
  task: any;
  projectId: string;
}

function CircularProgress({ value }: { value: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="w-12 h-12 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-purple-500"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-medium">{Math.round(value)}%</span>
    </div>
  );
}

export function HabitCard({ task, projectId }: HabitCardProps) {
  const { t, lang } = useLang();
  const { data: logs = [] } = useHabitLogs(task.id);
  const toggleMutation = useToggleHabitLog();

  const today = new Date().toISOString().split("T")[0];
  const isCompletedToday = logs.some((log: any) => log.log_date === today);

  // 本周一到今天
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const daysSinceMonday = Math.floor((now.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weeklyGoal = 7;
  const completedThisWeek = logs.filter((log: any) => {
    const d = new Date(log.log_date);
    return d >= monday && d <= now;
  }).length;
  const progress = Math.min(100, (completedThisWeek / weeklyGoal) * 100);

  // streak 计算
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
    <Card className="border-l-4 border-l-purple-500 hover:border-primary/30 transition-colors">
      <CardContent className="p-3 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 w-full mb-2">
          <Repeat className="h-4 w-4 text-purple-500 shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
          {streak > 0 && (
            <span className="text-[10px] bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded-full">
              🔥 {streak}
            </span>
          )}
        </div>
        <CircularProgress value={progress} />
        <p className="text-[10px] text-muted-foreground mt-1">
          {lang === "zh" ? `本周 ${completedThisWeek} / ${weeklyGoal}` : `Week ${completedThisWeek} / ${weeklyGoal}`}
        </p>
        <button
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          className={`mt-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            isCompletedToday
              ? "bg-purple-500 text-white"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          }`}
        >
          {isCompletedToday ? t("已打卡","Done") : t("今日打卡","Check In")}
        </button>
      </CardContent>
    </Card>
  );
}
