import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Flame, Trophy, Star, ChevronDown, ChevronRight, Sparkles, Zap, CheckCircle2, Loader2, AlertCircle, ClipboardList, Brain, Dumbbell, Clock, TrendingUp, Play, Square, Sliders, Minus } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  useTodayTasks,
  useUserPoints,
  useAddToToday,
  useCompleteDailyTask,
  useRemoveFromToday,
  useRecalculatePoints,
  useEstimateDifficulty,
  todoHooks,
} from "@/hooks/useData";

const DIFFICULTY_CONFIG = {
  easy: { label: { zh: "简单", en: "Easy" }, color: "bg-emerald-100 text-emerald-700", points: 10 },
  medium: { label: { zh: "中等", en: "Medium" }, color: "bg-amber-100 text-amber-700", points: 20 },
  hard: { label: { zh: "困难", en: "Hard" }, color: "bg-rose-100 text-rose-700", points: 30 },
} as const;

const MOTIVATIONAL_QUOTES = [
  { zh: "先做五分钟，开始了就停不下来", en: "Start with 5 minutes — once you begin, you won't stop" },
  { zh: "今天也要元气满满哦", en: "Stay energetic today!" },
  { zh: "完成比完美更重要", en: "Done is better than perfect" },
  { zh: "小步前进也是进步", en: "Small steps still count as progress" },
  { zh: "你比你想象的更强大", en: "You're stronger than you think" },
];

function CircularProgress({ value, size = 64 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e4e1d7" strokeWidth="4" fill="transparent" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#d17847" strokeWidth="4" fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ fontFamily: "JetBrains Mono, monospace", color: "#1f1a14" }}>
        {Math.round(value)}%
      </span>
    </div>
  );
}

function RewardPopup({ tier, onClose }: { tier: string; onClose: () => void }) {
  const { lang } = useLang();
  const messages: Record<string, { zh: string; en: string; icon: typeof Trophy }> = {
    gold: { zh: "太棒了！全部完成！", en: "Amazing! All done!", icon: Trophy },
    silver: { zh: "好的开始！继续加油！", en: "Good start! Keep going!", icon: Star },
  };
  const msg = messages[tier];
  if (!msg) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-xs animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <msg.icon className="h-12 w-12 mx-auto mb-4" style={{ color: "#d17847" }} />
        <p className="text-lg font-semibold" style={{ color: "#1f1a14" }}>
          {lang === "zh" ? msg.zh : msg.en}
        </p>
        <Button onClick={onClose} className="mt-4 bg-[#d17847] hover:bg-[#c06838] text-white">
          {lang === "zh" ? "继续" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

export default function TodayTodoPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();

  const { data: todayTasks = [], isLoading: tasksLoading } = useTodayTasks();
  const { data: userPoints } = useUserPoints();
  const addToToday = useAddToToday();
  const completeTask = useCompleteDailyTask();
  const removeFromToday = useRemoveFromToday();
  const recalcPoints = useRecalculatePoints();
  const estimateDifficulty = useEstimateDifficulty();
  const { data: allTodos = [] } = todoHooks.useList();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedTodos, setSelectedTodos] = useState<string[]>([]);
  const [manualDifficulties, setManualDifficulties] = useState<Record<string, string>>({});
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimatedDifficulties, setEstimatedDifficulties] = useState<Record<string, string>>({});
  const [estimatedEvaluations, setEstimatedEvaluations] = useState<Record<string, any>>({});
  const [adjustMode, setAdjustMode] = useState(false);
  const [rewardTier, setRewardTier] = useState<string | null>(null);
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

  const [adjustingTaskId, setAdjustingTaskId] = useState<string | null>(null);
  const [adjustingPoints, setAdjustingPoints] = useState<number>(20);
  const [adjustingFeedback, setAdjustingFeedback] = useState<string>("");

  // ============ Focus Timer States ============
  const [timerState, setTimerState] = useState<"idle" | "running" | "paused">("idle");
  const [timerMode, setTimerMode] = useState<"countdown" | "countup">("countdown");
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins in seconds
  const [countUpElapsed, setCountUpElapsed] = useState(0); // positive countup seconds
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const [congratsDialogOpen, setCongratsDialogOpen] = useState(false);
  const [finalTimeStr, setFinalTimeStr] = useState("");

  useEffect(() => {
    let interval: any = null;
    if (timerState === "running") {
      interval = setInterval(() => {
        if (timerMode === "countdown") {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setTimerMode("countup");
              return 0;
            }
            return prev - 1;
          });
        } else {
          setCountUpElapsed((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState, timerMode]);

  const getElapsedSeconds = () => {
    if (timerMode === "countdown") {
      return 300 - timeLeft;
    } else {
      return 300 + countUpElapsed;
    }
  };

  const formatTimeZh = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}分${secs}秒`;
  };

  const handleStopTimer = () => {
    const elapsed = getElapsedSeconds();
    setTimerState("idle");
    setFinalTimeStr(formatTimeZh(elapsed));
    setCongratsDialogOpen(true);
    // Reset timer
    setTimeLeft(300);
    setCountUpElapsed(0);
    setTimerMode("countdown");
    setActiveTaskId(null);
  };

  const handleStartTimer = () => {
    setTaskSelectorOpen(true);
  };


  const todayTaskIds = useMemo(() => new Set(todayTasks.map((dt: any) => dt.todo_id)), [todayTasks]);
  const availableTodos = allTodos.filter((t: any) => {
    if (t.is_completed || t.is_archived || todayTaskIds.has(t.id)) return false;
    if (t.parent_id) return true;
    const hasActiveChildren = allTodos.some((child: any) => child.parent_id === t.id && !child.is_completed && !child.is_archived);
    return !hasActiveChildren;
  });

  const completedCount = todayTasks.filter((t: any) => t.is_completed).length;
  const totalCount = todayTasks.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;



  const handleAddDialogOpen = (open: boolean) => {
    setAddDialogOpen(open);
    if (open) {
      setSelectedTodos([]);
      setManualDifficulties({});
      setEstimatedDifficulties({});
      setAdjustMode(false);
      setIsEstimating(false);
    }
  };

  const handleAutoEstimate = async () => {
    if (selectedTodos.length === 0) return;
    setIsEstimating(true);
    try {
      const titles = selectedTodos.map((id) => {
        const todo = allTodos.find((t: any) => t.id === id);
        return todo?.title || "";
      });
      const result = await estimateDifficulty.mutateAsync(titles);
      const diffMap: Record<string, string> = {};
      const evalMap: Record<string, any> = {};
      result.results.forEach((r: any, i: number) => {
        diffMap[selectedTodos[i]] = r.difficulty;
        if (r.evaluation) {
          evalMap[selectedTodos[i]] = r.evaluation;
        }
      });
      setEstimatedDifficulties(diffMap);
      setEstimatedEvaluations(evalMap);
      setAdjustMode(false);
    } catch {
      setAdjustMode(true);
    } finally {
      setIsEstimating(false);
    }
  };

  const getDifficulty = (todoId: string) => {
    return manualDifficulties[todoId] || estimatedDifficulties[todoId] || "medium";
  };

  const handleConfirmAdd = async () => {
    for (const todoId of selectedTodos) {
      const eval4d = estimatedEvaluations[todoId];
      const manualPoints = manualDifficulties[todoId] ? parseInt(manualDifficulties[todoId]) : null;
      const pts = manualPoints ?? eval4d?.awarded_xp ?? 20;
      await addToToday.mutateAsync({
        todo_id: todoId,
        difficulty: pts >= 40 ? "hard" : pts >= 20 ? "medium" : "easy",
        base_points: pts,
        metadata: eval4d || {},
      });
    }
    setAddDialogOpen(false);
    setManualDifficulties({});
    setSelectedTodos([]);
    setAdjustMode(false);
    toast({ title: lang === "zh" ? "已添加到今天" : "Added to today" });
  };

  const handleComplete = async (task: any) => {
    const isNowCompleted = !task.is_completed;
    await completeTask.mutateAsync({ id: task.id, is_completed: isNowCompleted });
    
    if (isNowCompleted) {
      await recalcPoints.mutateAsync();
      
      const newCompletedCount = todayTasks.filter((t: any) => t.id === task.id ? true : t.is_completed).length;
      const newProgressPct = totalCount > 0 ? (newCompletedCount / totalCount) * 100 : 0;
      
      if (totalCount > 0 && newCompletedCount === totalCount && totalCount >= 2) {
        setRewardTier("gold");
      } else if (newCompletedCount >= 1 && newProgressPct >= 80) {
        setRewardTier("gold");
      } else if (newCompletedCount === 1 && totalCount > 1) {
        setRewardTier("silver");
      }
    }
  };

  const handleRemove = async (id: string) => {
    await removeFromToday.mutateAsync(id);
  };

  const streak = userPoints?.current_streak || 0;
  const totalPts = userPoints?.total_points || 0;
  const bestStreak = userPoints?.best_streak || 0;

  if (tasksLoading) {
    return (
      <AppLayout title={t("今日待办", "Today's Todo")}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#8a847a]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t("今日待办", "Today's Todo")}>
      <div className="space-y-5">
        <style>{`
          @keyframes flameFlickerLeft {
            0%, 100% { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 4px rgba(209, 120, 71, 0.6)); }
            50% { transform: scale(1.2) rotate(3deg); filter: drop-shadow(0 0 12px rgba(209, 120, 71, 0.9)); }
          }
          @keyframes flameFlickerRight {
            0%, 100% { transform: scale(1.2) rotate(3deg); filter: drop-shadow(0 0 12px rgba(209, 120, 71, 0.9)); }
            50% { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 4px rgba(209, 120, 71, 0.6)); }
          }
          .animate-flame-left {
            animation: flameFlickerLeft 0.6s infinite alternate ease-in-out;
          }
          .animate-flame-right {
            animation: flameFlickerRight 0.6s infinite alternate ease-in-out;
          }
        `}</style>

        {/* Focus Timer Banner */}
        <div
          className="rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, #fdf8f3 0%, #f9efe6 50%, #f3e8db 100%)",
            border: "1px solid #e8ddd0",
          }}
        >
          {/* Left Title */}
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#d17847] animate-pulse" />
            <p className="text-lg font-semibold text-[#1f1a14]">
              {t("先开始做五分钟", "Start with 5 minutes")}
            </p>
          </div>

          {/* Right Timer Control */}
          <div className="flex items-center gap-3">
            {timerState === "idle" ? (
              <Button
                onClick={handleStartTimer}
                className="bg-[#d17847] hover:bg-[#c06838] text-white font-medium shadow-sm transition-all flex items-center gap-1.5"
              >
                <Play className="h-4 w-4" />
                {t("开启五分钟计时", "Start 5-Min Timer")}
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-[#e4e1d7] py-1.5 px-3 rounded-lg shadow-sm">
                <span
                  className="font-bold text-lg text-[#d17847] font-mono tracking-wider animate-pulse"
                  style={{ minWidth: "55px", textAlign: "center" }}
                >
                  {(() => {
                    const total = timerMode === "countdown" ? timeLeft : 300 + countUpElapsed;
                    const mins = Math.floor(total / 60);
                    const secs = total % 60;
                    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  })()}
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#f3e8db] text-[#d17847]">
                  {timerMode === "countdown" ? t("专注中", "Focusing") : t("突破中", "Overachieving")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleStopTimer}
                  className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-md"
                >
                  <Square className="h-4 w-4 fill-red-500" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* "On Fire" Active Task Section */}
        {timerState === "running" && (
          <div
            className="rounded-xl p-4 flex items-center justify-between border border-[#f3e8db] shadow-md animate-in slide-in-from-top-3 duration-300 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(253, 248, 243, 0.95) 0%, rgba(249, 239, 230, 0.95) 100%)",
              backdropFilter: "blur(8px)",
            }}
          >
            {/* Soft decorative glow behind the text */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(209,120,71,0.06)_0%,transparent_70%)] pointer-events-none" />

            <div className="flex items-center justify-center w-full gap-4 relative z-10">
              <Flame className="h-7 w-7 text-[#d17847] animate-flame-left shrink-0" />
              <div className="text-center">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#8a847a] block mb-1">
                  {t("正在专注做", "CURRENTLY FOCUSING ON")}
                </span>
                <span className="text-base font-bold text-[#1f1a14] max-w-md block truncate">
                  {(() => {
                    if (!activeTaskId) return t("不指定特定任务，直接开始", "General Session");
                    const task = todayTasks.find((t: any) => t.id === activeTaskId);
                    const todo = task?.todos;
                    if (todo?.parent_id) {
                      const parent = allTodos.find((p: any) => p.id === todo.parent_id);
                      return parent ? `${parent.title} > ${todo.title}` : (todo.title || t("专注任务", "Focus Task"));
                    }
                    return todo?.title || t("专注任务", "Focus Task");
                  })()}
                </span>
              </div>
              <Flame className="h-7 w-7 text-[#d17847] animate-flame-right shrink-0" />
            </div>
          </div>
        )}


        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Flame, label: t("连续天数", "Streak"), value: streak, suffix: t("天", "d") },
            { icon: Star, label: t("总积分", "Points"), value: totalPts, suffix: "" },
            { icon: Trophy, label: t("最长连续", "Best"), value: bestStreak, suffix: t("天", "d") },
          ].map(({ icon: Icon, label, value, suffix }) => (
            <Card key={label} className="bg-white border-[#e4e1d7]">
              <CardContent className="p-3 text-center">
                <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: "#d17847" }} />
                <p className="text-lg font-bold" style={{ fontFamily: "JetBrains Mono, monospace", color: "#1f1a14" }}>
                  {value}{suffix}
                </p>
                <p className="text-xs" style={{ color: "#8a847a" }}>{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress Ring + Add Button */}
        <div className="flex items-center gap-4">
          <CircularProgress value={progressPct} size={72} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "#1f1a14" }}>
              {completedCount} / {totalCount} {t("已完成", "completed")}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#8a847a" }}>
              {totalCount === 0
                ? t("今天还没有任务，快去添加吧！", "No tasks yet — add some!")
                : completedCount === totalCount && totalCount > 0
                  ? t("全部完成！太棒了！", "All done! Amazing!")
                  : t("继续加油！", "Keep going!")}
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={handleAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#d17847] hover:bg-[#c06838] text-white">
                <Plus className="h-4 w-4 mr-1" />{t("添加任务", "Add Tasks")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("选择今日任务", "Pick Today's Tasks")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {availableTodos.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "#8a847a" }}>
                    {t("所有待办都已完成或已添加", "All to-dos are done or already added")}
                  </p>
                ) : (
                  availableTodos.map((todo: any) => (
                    <label
                      key={todo.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f9f8f5] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTodos.includes(todo.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTodos([...selectedTodos, todo.id]);
                          } else {
                            setSelectedTodos(selectedTodos.filter((id) => id !== todo.id));
                          }
                        }}
                        className="rounded accent-[#d17847]"
                      />
                      <span className="text-sm flex-1 font-medium" style={{ color: "#1f1a14" }}>
                        {(() => {
                          if (todo.parent_id) {
                            const parent = allTodos.find((p: any) => p.id === todo.parent_id);
                            return parent ? `${parent.title} > ${todo.title}` : todo.title;
                          }
                          return todo.title;
                        })()}
                      </span>
                      {selectedTodos.includes(todo.id) && (
                        <div className="shrink-0 animate-in fade-in duration-200">
                          {!adjustMode && estimatedDifficulties[todo.id] && estimatedEvaluations[todo.id] ? (() => {
                            const pts = estimatedEvaluations[todo.id].awarded_xp || 20;
                            const badgeColor =
                              pts < 20
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : pts < 40
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-rose-50 text-rose-700 border-rose-200";
                            return (
                              <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
                                +{pts} XP
                              </Badge>
                            );
                          })() : (
                            <div className="flex items-center gap-1 shrink-0 bg-stone-50 p-0.5 rounded-md border border-[#e4e1d7]">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const currentPoints = manualDifficulties[todo.id]
                                    ? parseInt(manualDifficulties[todo.id])
                                    : (estimatedEvaluations[todo.id]?.awarded_xp || 20);
                                  const newPoints = Math.max(5, currentPoints - 5);
                                  setManualDifficulties({ ...manualDifficulties, [todo.id]: newPoints.toString() });
                                }}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-xs font-bold text-[#1f1a14] min-w-[20px] text-center" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                {manualDifficulties[todo.id]
                                  ? manualDifficulties[todo.id]
                                  : (estimatedEvaluations[todo.id]?.awarded_xp || 20)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const currentPoints = manualDifficulties[todo.id]
                                    ? parseInt(manualDifficulties[todo.id])
                                    : (estimatedEvaluations[todo.id]?.awarded_xp || 20);
                                  const newPoints = Math.min(1000, currentPoints + 5);
                                  setManualDifficulties({ ...manualDifficulties, [todo.id]: newPoints.toString() });
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="text-[10px] font-bold text-stone-400 mr-1 shrink-0">XP</span>
                            </div>
                          )}
                        </div>
                      )}
                    </label>
                  ))
                )}
              </div>
              {selectedTodos.length > 0 && (
                <div className="flex gap-2 pt-2 border-t border-[#e4e1d7]">
                  {!adjustMode && Object.keys(estimatedDifficulties).length === 0 && (
                    <Button variant="secondary" size="sm" onClick={handleAutoEstimate} disabled={isEstimating}>
                      {isEstimating ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{t("评估中...", "Estimating...")}</>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5 mr-1" />{t("AI 自动评估", "Auto Estimate")}</>
                      )}
                    </Button>
                  )}
                  {!adjustMode && Object.keys(estimatedDifficulties).length > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setAdjustMode(true)}>
                      <Zap className="h-3.5 w-3.5 mr-1" />{t("调整难度", "Adjust")}
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button className="bg-[#d17847] hover:bg-[#c06838] text-white" size="sm" onClick={handleConfirmAdd}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("完成", "Done")}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Task List */}
        {todayTasks.length === 0 ? (
          <Card className="bg-white border-[#e4e1d7]">
            <CardContent className="p-8 text-center">
              <ClipboardList className="h-10 w-10 mx-auto mb-3" style={{ color: "#d1c9bc" }} />
              <p className="text-sm" style={{ color: "#8a847a" }}>
                {t("今天还没有任务，点击上方按钮添加", "No tasks today — tap the button above to add some")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task: any) => {
              const diff = task.difficulty || "medium";
              const cfg = DIFFICULTY_CONFIG[diff as keyof typeof DIFFICULTY_CONFIG];
              const meta = task.metadata || {};
              const has4D = meta.cognitive_level != null;
              return (
                <Card key={task.id} className={`bg-white border-[#e4e1d7] transition-all shadow-sm ${task.is_completed ? "opacity-60 bg-stone-50/50" : "hover:border-[#d17847]/30"}`}>
                  <CardContent className="p-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <Checkbox
                        checked={task.is_completed}
                        onCheckedChange={() => handleComplete(task)}
                        className="accent-[#d17847]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.is_completed ? "line-through text-[#8a847a]" : "text-[#1f1a14]"}`}>
                          {(() => {
                            const todo = task.todos;
                            if (todo?.parent_id) {
                              const parent = allTodos.find((p: any) => p.id === todo.parent_id);
                              return parent ? `${parent.title} > ${todo.title}` : (todo?.title || t("未知任务", "Unknown task"));
                            }
                            return todo?.title || t("未知任务", "Unknown task");
                          })()}
                        </p>
                        {task.todos?.detail && (
                          <p className="text-xs mt-0.5 truncate text-[#8a847a]">{task.todos.detail}</p>
                        )}
                        {has4D && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(meta.attribute_tags || []).map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 bg-[#f9f8f5] text-[#8a847a] border-[#e4e1d7] rounded">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {has4D && meta.ai_encouragement && (
                          <p className="text-[10px] mt-1 italic text-[#b8a590]">{meta.ai_encouragement}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                        {has4D && (
                          <div className="flex gap-1 mr-1 hidden md:flex">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">
                              L{meta.cognitive_level}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200">
                              L{meta.willpower_level}
                            </Badge>
                          </div>
                        )}

                        {(() => {
                          const pts = task.base_points || cfg?.points || 20;
                          const badgeColor =
                            pts < 20
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : pts < 40
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-rose-50 text-rose-700 border-rose-200";
                          return (
                            <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
                              +{pts} XP
                            </Badge>
                          );
                        })()}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[#8a847a] hover:text-[#d17847] hover:bg-[#fdf8f3] rounded-md shrink-0"
                          onClick={() => {
                            if (adjustingTaskId === task.id) {
                              setAdjustingTaskId(null);
                            } else {
                              setAdjustingTaskId(task.id);
                              setAdjustingPoints(task.base_points || cfg?.points || 20);
                              setAdjustingFeedback(task.metadata?.feedback || "");
                            }
                          }}
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-[#8a847a] hover:text-red-500 rounded-md shrink-0"
                          onClick={() => handleRemove(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {adjustingTaskId === task.id && (
                      <div className="mt-3 p-3 bg-stone-50 border border-[#e4e1d7] rounded-lg space-y-3 relative z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#8a847a]">
                            {t("调整分值", "Adjust Score")}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-md border-[#e4e1d7] bg-white hover:bg-stone-50"
                              onClick={() => setAdjustingPoints((prev) => Math.max(5, prev - 5))}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-sm font-bold text-[#1f1a14] min-w-[32px] text-center" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                              {adjustingPoints}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-md border-[#e4e1d7] bg-white hover:bg-stone-50"
                              onClick={() => setAdjustingPoints((prev) => Math.min(1000, prev + 5))}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-[#8a847a] uppercase tracking-wider">
                            {t("为什么不合理？ (可选)", "Why is it unreasonable? (Optional)")}
                          </Label>
                          <Input
                            value={adjustingFeedback}
                            onChange={(e) => setAdjustingFeedback(e.target.value)}
                            placeholder={t("例如：实际耗时更长 / 任务难度较高", "E.g., Took more effort / High cognitive load")}
                            className="h-8 text-xs bg-white border-[#e4e1d7] focus-visible:ring-1 focus-visible:ring-[#d17847]"
                          />
                        </div>

                        <div className="flex justify-end gap-1.5 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setAdjustingTaskId(null)}
                          >
                            {t("取消", "Cancel")}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-[#d17847] hover:bg-[#c06838] text-white font-medium"
                            onClick={async () => {
                              try {
                                await completeTask.mutateAsync({
                                  id: task.id,
                                  base_points: adjustingPoints,
                                  metadata: {
                                    ...meta,
                                    feedback: adjustingFeedback,
                                  },
                                });
                                setAdjustingTaskId(null);
                                toast({ title: t("分值调整成功", "Score updated successfully") });
                              } catch (err: any) {
                                toast({ title: t("调整失败", "Failed to adjust"), description: err.message, variant: "destructive" });
                              }
                            }}
                          >
                            {t("确定", "Confirm")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Collapsible: Reward Tiers & Algorithm */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-xs" style={{ color: "#8a847a" }}>
              {t("积分规则详情", "Points Algorithm Details")}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="bg-white border-[#e4e1d7] mt-2">
              <CardContent className="p-4 space-y-3 text-xs" style={{ color: "#8a847a" }}>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("四维评估矩阵", "4D Evaluation Matrix")}</p>
                  <p>{t("认知负荷(L1-L5) · 意志力消耗(L1-L5) · 时间跨度(L1-L5) · 重要性(L1-L5)", "Cognitive(L1-L5) · Willpower(L1-L5) · Duration(L1-L5) · Impact(L1-L5)")}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("积分公式", "Scoring Formula")}</p>
                  <p>{t("基础 XP = (认知 + 意志) × 5", "Base XP = (Cognitive + Willpower) × 5")}</p>
                  <p>{t("时间倍率: L1=×0.5, L2=×1, L3=×1.5, L4=×2, L5=×3", "Time mult: L1=×0.5, L2=×1, L3=×1.5, L4=×2, L5=×3")}</p>
                  <p>{t("重要性奖励: L4=+10, L5=+30", "Impact bonus: L4=+10, L5=+30")}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("完成奖励", "Completion Bonus")}</p>
                  <p>{t("全部完成或 ≥80%：+50 分 · 完成 1+ 项：+15 分", "All done or ≥80%: +50 · 1+ completed: +15")}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("连续加成", "Streak Multiplier")}</p>
                  <p>{t("1-6 天 ×1 · 7-13 天 ×1.5 · 14-29 天 ×2 · 30+ 天 ×3", "1-6d ×1 · 7-13d ×1.5 · 14-29d ×2 · 30+ ×3")}</p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Focus Timer Selector Dialog */}
      <Dialog open={taskSelectorOpen} onOpenChange={setTaskSelectorOpen}>
        <DialogContent className="max-w-md bg-white border border-[#e4e1d7] rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1f1a14] flex items-center gap-2">
              <Flame className="h-5 w-5 text-[#d17847]" />
              {t("选择你要专注的任务", "Select a Task to Focus On")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[300px] overflow-y-auto pr-1">
            {todayTasks.filter((t: any) => !t.is_completed).length === 0 ? (
              <p className="text-sm text-center py-4 text-[#8a847a]">
                {t("今天还没有未完成的任务哦，去添加几个吧！", "No active tasks today — add some first!")}
              </p>
            ) : (
              todayTasks.filter((t: any) => !t.is_completed).map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => {
                    setActiveTaskId(task.id);
                    setTimerState("running");
                    setTaskSelectorOpen(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-[#e4e1d7] hover:border-[#d17847]/60 hover:bg-[#fdf8f3] transition-all flex items-center justify-between group"
                >
                  <span className="text-sm font-medium text-[#1f1a14] truncate max-w-[280px]">
                    {(() => {
                      const todo = task.todos;
                      if (todo?.parent_id) {
                        const parent = allTodos.find((p: any) => p.id === todo.parent_id);
                        return parent ? `${parent.title} > ${todo.title}` : (todo.title || t("未知任务", "Unknown task"));
                      }
                      return todo?.title || t("未知任务", "Unknown task");
                    })()}
                  </span>
                  <span className="text-xs text-[#d17847] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    {t("开始专注 →", "Focus →")}
                  </span>
                </button>
              ))
            )}
            <button
              onClick={() => {
                setActiveTaskId(null);
                setTimerState("running");
                setTaskSelectorOpen(false);
              }}
              className="w-full text-center p-3 rounded-lg border border-dashed border-[#e4e1d7] hover:border-[#d17847]/60 hover:bg-[#fdf8f3] transition-all text-sm font-medium text-[#8a847a] hover:text-[#d17847]"
            >
              {t("直接开启专注会话", "Start general session directly")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Focus Timer Congrats Dialog */}
      <Dialog open={congratsDialogOpen} onOpenChange={setCongratsDialogOpen}>
        <DialogContent className="max-w-xs text-center p-6 bg-white border border-[#e4e1d7] rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
          <Trophy className="h-12 w-12 text-[#d17847] mx-auto mb-4 animate-bounce" />
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1f1a14] text-center w-full">
              {t("专注达成！", "Focus Accomplished!")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-[#8a847a] leading-relaxed">
              {t("您这次成功专注了 ", "You successfully focused for ")}
              <strong className="text-base font-bold text-[#d17847]">{finalTimeStr}</strong>！
            </p>
            <p className="text-xs text-[#b8a590] mt-3 italic">
              {t("先做五分钟，您已经迈出了最关键的一步，继续保持！", "Start with five minutes — you've taken the most crucial step!")}
            </p>
          </div>
          <Button
            onClick={() => setCongratsDialogOpen(false)}
            className="w-full bg-[#d17847] hover:bg-[#c06838] text-white mt-2 font-medium"
          >
            {t("太棒了！", "Awesome!")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Reward Popup */}
      {rewardTier && <RewardPopup tier={rewardTier} onClose={() => setRewardTier(null)} />}
    </AppLayout>
  );
}
