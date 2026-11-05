import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { supabase } from "@/integrations/supabase/client";
import { byBoardOrder, projectProgress } from "@/components/projects/board-model";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";

function useProjectCards(day?: string, enabled = true) {
  const { isDemo, demoData } = useDemoMode();
  const query = useQuery({
    queryKey: day ? ["projects", "today", day] : ["projects", "warehouse"],
    enabled: enabled && !isDemo,
    queryFn: async () => {
      const base = supabase.from("project_tasks")
        .select("id,title,description,estimated_minutes,status,project_id,today_date,projects!inner(name,status,category,icon_svg,cover_preset)")
        .eq("type", "task");
      const query = (day ? base.eq("today_date", day) : base).order("id");
      const read = (offset: number) => query.range(offset, offset + 499);
      const first = await read(0);
      if (first.error) throw first.error;
      const cards = first.data;
      while (cards.length && cards.length % 500 === 0) {
        const page = await read(cards.length);
        if (page.error) throw page.error;
        cards.push(...page.data);
        if (page.data.length < 500) break;
      }
      return cards;
    },
  });
  if (!isDemo) return query;
  const data = demoData.project_tasks.flatMap(task => {
    if (task.type !== "task" || (day && task.today_date !== day)) return [];
    const project = demoData.projects.find(p => p.id === task.project_id);
    return project ? [{ id:task.id, title:task.title, description:task.description ?? null, estimated_minutes:(task as { estimated_minutes?: number | null }).estimated_minutes ?? null, status:task.status, project_id:task.project_id, today_date:task.today_date ?? null, projects: { name: project.name, status: project.status, category: project.category ?? null, cover_preset: project.cover_preset ?? "auto", icon_svg: (project as {icon_svg?: string | null}).icon_svg ?? null } }] : [];
  });
  return { data, error: null, isLoading: false, refetch: query.refetch };
}

export function useTodayProjectTasks(day: string, enabled = true) { return useProjectCards(day, enabled); }
export function useWarehouseProjectTasks() { return useProjectCards(); }

type Change = { id: string; projectId: string; action: "add" | "remove" | "complete" | "finish" | "reopen" };
export function useProjectTodayAction(day: string) {
  const { isDemo, demoData, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useLang();
  return useMutation({
    mutationFn: async ({ id, projectId, action }: Change) => {
      if (!isDemo) {
        const { error } = action === "finish" || action === "reopen"
          ? await supabase.rpc("set_project_task_done", { p_project_id: projectId, p_task_id: id, p_done: action === "finish" })
          : await supabase.rpc("project_today_action", {
          p_task_id: id, p_project_id: projectId, p_day: day, p_action: action,
        });
        if (error) throw error;
        return;
      }
      const tasks = demoData.project_tasks.filter(row => row.project_id === projectId);
      const task = tasks.find(row => row.id === id && row.type === "task");
      if (!task) throw new Error("Task unavailable");
      if (action === "complete" || action === "finish" || action === "reopen") {
        if (action === "complete" && task.today_date !== day) throw new Error("Arrangement changed");
        const status = action === "reopen" ? "todo" : "done";
        if ((task.status === "done") === (status === "done")) return;
        const done = tasks.filter(row => row.status === status).sort(byBoardOrder);
        updateRecord("project_tasks", id, { status, sort_order: (done.at(-1)?.sort_order ?? -1) + 1 });
        updateRecord("projects", projectId, { progress: projectProgress(tasks.map(row => row.id === id ? { ...row, status } : row)) });
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
