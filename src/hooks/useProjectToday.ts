import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { supabase } from "@/integrations/supabase/client";
import { byBoardOrder, projectProgress } from "@/components/projects/board-model";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";

export function useTodayProjectTasks(day: string, enabled = true) {
  const { isDemo, demoData } = useDemoMode();
  const query = useQuery({
    queryKey: ["projects", "today", day],
    enabled: enabled && !isDemo,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_tasks")
        .select("id,title,status,project_id,projects!inner(name)")
        .eq("type", "task").eq("today_date", day).order("created_at").order("id");
      if (error) throw error;
      return data;
    },
  });
  if (!isDemo) return query;
  const data = demoData.project_tasks.flatMap(task => {
    if (task.type !== "task" || task.today_date !== day) return [];
    const project = demoData.projects.find(p => p.id === task.project_id);
    return project ? [{ ...task, projects: { name: project.name } }] : [];
  });
  return { data, error: null, isLoading: false, refetch: query.refetch };
}

type Change = { id: string; projectId: string; action: "add" | "remove" | "complete" };
export function useProjectTodayAction(day: string) {
  const { isDemo, demoData, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useLang();
  return useMutation({
    mutationFn: async ({ id, projectId, action }: Change) => {
      if (!isDemo) {
        const { error } = await supabase.rpc("project_today_action", {
          p_task_id: id, p_project_id: projectId, p_day: day, p_action: action,
        });
        if (error) throw error;
        return;
      }
      const tasks = demoData.project_tasks.filter(row => row.project_id === projectId);
      const task = tasks.find(row => row.id === id && row.type === "task");
      if (!task) throw new Error("Task unavailable");
      if (action === "complete") {
        if (task.today_date !== day) throw new Error("Arrangement changed");
        if (task.status === "done") return;
        const done = tasks.filter(row => row.status === "done").sort(byBoardOrder);
        updateRecord("project_tasks", id, { status: "done", sort_order: (done.at(-1)?.sort_order ?? -1) + 1 });
        updateRecord("projects", projectId, { progress: projectProgress(tasks.map(row => row.id === id ? { ...row, status: "done" } : row)) });
      } else if (action === "remove") {
        if (task.today_date === day) updateRecord("project_tasks", id, { today_date: null });
      } else {
        if (task.status === "done") throw new Error("Task already completed");
        updateRecord("project_tasks", id, { today_date: day });
      }
    },
    onError: () => toast({ title: t("更改未保存，请刷新后重试", "Changes not saved. Refresh and try again."), variant: "destructive" }),
    onSettled: async (_, __, change) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["project_tasks", change.projectId] }),
      ]);
    },
  });
}
