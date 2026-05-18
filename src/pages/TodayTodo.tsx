import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Flame, Trophy, Star, ChevronDown, ChevronRight, Sparkles, Zap, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
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
  { zh: "先做五分钟，开始了就停不下来 ✨", en: "Start with 5 minutes — once you begin, you won't stop ✨" },
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
  const messages: Record<string, { zh: string; en: string; icon: string }> = {
    gold: { zh: "太棒了！全部完成！", en: "Amazing! All done!", icon: "🏆" },
    silver: { zh: "好的开始！继续加油！", en: "Good start! Keep going!", icon: "⭐" },
  };
  const msg = messages[tier];
  if (!msg) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-xs animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-4">{msg.icon}</div>
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
  const [adjustMode, setAdjustMode] = useState(false);
  const [rewardTier, setRewardTier] = useState<string | null>(null);
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

  const todayTaskIds = useMemo(() => new Set(todayTasks.map((dt: any) => dt.todo_id)), [todayTasks]);
  const availableTodos = allTodos.filter((t: any) => !t.is_completed && !t.is_archived && !todayTaskIds.has(t.id));

  const completedCount = todayTasks.filter((t: any) => t.is_completed).length;
  const totalCount = todayTasks.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  useEffect(() => {
    if (totalCount > 0 && completedCount === totalCount && totalCount >= 2) {
      setRewardTier("gold");
    } else if (completedCount >= 1 && progressPct >= 80) {
      setRewardTier("gold");
    } else if (completedCount === 1 && totalCount > 1) {
      setRewardTier("silver");
    }
  }, [completedCount, totalCount, progressPct]);

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
      const map: Record<string, string> = {};
      result.results.forEach((r: any, i: number) => {
        map[selectedTodos[i]] = r.difficulty;
      });
      setEstimatedDifficulties(map);
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
      const diff = getDifficulty(todoId);
      const pts = DIFFICULTY_CONFIG[diff as keyof typeof DIFFICULTY_CONFIG]?.points || 20;
      await addToToday.mutateAsync({ todo_id: todoId, difficulty: diff, base_points: pts });
    }
    setAddDialogOpen(false);
    toast({ title: lang === "zh" ? "已添加到今天" : "Added to today" });
  };

  const handleComplete = async (task: any) => {
    await completeTask.mutateAsync({ id: task.id, is_completed: !task.is_completed });
    if (!task.is_completed) {
      await recalcPoints.mutateAsync();
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
        {/* Motivational Banner */}
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: "linear-gradient(135deg, #fdf8f3 0%, #f9efe6 50%, #f3e8db 100%)",
            border: "1px solid #e8ddd0",
          }}
        >
          <p className="text-base font-medium" style={{ color: "#1f1a14", fontFamily: lang === "zh" ? "inherit" : "Inter, sans-serif" }}>
            {lang === "zh" ? quote.zh : quote.en}
          </p>
        </div>

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
                      <span className="text-sm flex-1" style={{ color: "#1f1a14" }}>{todo.title}</span>
                      {(adjustMode || !estimatedDifficulties[todo.id]) && selectedTodos.includes(todo.id) && (
                        <Select
                          value={getDifficulty(todo.id)}
                          onValueChange={(v) => setManualDifficulties({ ...manualDifficulties, [todo.id]: v })}
                        >
                          <SelectTrigger className="w-20 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DIFFICULTY_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label[lang]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {!adjustMode && estimatedDifficulties[todo.id] && selectedTodos.includes(todo.id) && (
                        <Badge className={`text-xs ${DIFFICULTY_CONFIG[estimatedDifficulties[todo.id] as keyof typeof DIFFICULTY_CONFIG]?.color}`}>
                          {DIFFICULTY_CONFIG[estimatedDifficulties[todo.id] as keyof typeof DIFFICULTY_CONFIG]?.label[lang]}
                        </Badge>
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
              <p className="text-4xl mb-3">📋</p>
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
              return (
                <Card key={task.id} className={`bg-white border-[#e4e1d7] transition-all ${task.is_completed ? "opacity-60" : ""}`}>
                  <CardContent className="p-3 px-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={task.is_completed}
                        onCheckedChange={() => handleComplete(task)}
                        className="accent-[#d17847]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.is_completed ? "line-through" : ""}`} style={{ color: "#1f1a14" }}>
                          {task.todos?.title || t("未知任务", "Unknown task")}
                        </p>
                        {task.todos?.detail && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: "#8a847a" }}>{task.todos.detail}</p>
                        )}
                      </div>
                      <Badge className={`text-xs ${cfg?.color}`}>
                        {cfg?.label[lang]}
                      </Badge>
                      <span className="text-xs font-medium" style={{ fontFamily: "JetBrains Mono, monospace", color: "#d17847" }}>
                        +{task.base_points || cfg?.points || 20}
                      </span>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-[#8a847a] hover:text-red-500"
                        onClick={() => handleRemove(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("难度基础分", "Difficulty Base Points")}</p>
                  <p>{t("简单 10 分 · 中等 20 分 · 困难 30 分", "Easy 10 · Medium 20 · Hard 30")}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("完成奖励", "Completion Bonus")}</p>
                  <p>{t("全部完成或 ≥80%：+50 分 · 完成 1+ 项：+15 分", "All done or ≥80%: +50 · 1+ completed: +15")}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("连续加成", "Streak Multiplier")}</p>
                  <p>{t("1-6 天 ×1 · 7-13 天 ×1.5 · 14-29 天 ×2 · 30+ 天 ×3", "1-6d ×1 · 7-13d ×1.5 · 14-29d ×2 · 30+ ×3")}</p>
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "#1f1a14" }}>{t("休息日", "Rest Days")}</p>
                  <p>{t("不扣分，不重置连续天数", "No penalty — streak pauses, doesn't reset")}</p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Reward Popup */}
      {rewardTier && <RewardPopup tier={rewardTier} onClose={() => setRewardTier(null)} />}
    </AppLayout>
  );
}
