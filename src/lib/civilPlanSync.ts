import { supabase } from "@/integrations/supabase/client";
import type { CivilPlanItem } from "@/hooks/useCivilService";

function hasTimeRange(item: CivilPlanItem): boolean {
  return !!(item.start_time && item.end_time);
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function syncCivilPlanItem(item: CivilPlanItem): Promise<{
  synced_schedule_id: string | null;
  synced_todo_id: string | null;
}> {
  if (hasTimeRange(item)) {
    return syncToSchedule(item);
  }
  return syncToTodo(item);
}

async function syncToSchedule(item: CivilPlanItem) {
  const userId = await currentUserId();
  const payload = {
    title: `【考公】${item.title}`,
    start_time: item.start_time!,
    end_time: item.end_time!,
    importance: "普通",
    status: "未开始",
    color: "#d17847",
    notes: [item.detail, item.subject_tag ? `科目：${item.subject_tag}` : null].filter(Boolean).join("\n") || null,
    user_id: userId,
  };

  let scheduleId = item.synced_schedule_id;

  if (scheduleId) {
    const { data, error } = await supabase.from("schedule_events").update(payload).eq("id", scheduleId).select("id").maybeSingle();
    if (error || !data) {
      scheduleId = null;
    }
  }

  if (!scheduleId) {
    const { data, error } = await supabase.from("schedule_events").insert(payload).select("id").single();
    if (error) throw error;
    scheduleId = data.id;
  }

  await supabase
    .from("civil_plan_items")
    .update({ synced_schedule_id: scheduleId, synced_todo_id: null })
    .eq("id", item.id);

  return { synced_schedule_id: scheduleId, synced_todo_id: null };
}

async function syncToTodo(item: CivilPlanItem) {
  const userId = await currentUserId();
  const payload = {
    title: item.title,
    detail: [item.detail, item.subject_tag ? `科目：${item.subject_tag}` : null, `日期：${item.plan_date}`].filter(Boolean).join("\n") || null,
    category: "考公",
    importance: "普通",
    is_completed: item.is_completed,
    user_id: userId,
  };

  let todoId = item.synced_todo_id;

  if (todoId) {
    const { data, error } = await supabase.from("todos").update(payload).eq("id", todoId).select("id").maybeSingle();
    if (error || !data) {
      todoId = null;
    }
  }

  if (!todoId) {
    const { data, error } = await supabase.from("todos").insert(payload).select("id").single();
    if (error) throw error;
    todoId = data.id;
  }

  await supabase
    .from("civil_plan_items")
    .update({ synced_todo_id: todoId, synced_schedule_id: null })
    .eq("id", item.id);

  return { synced_schedule_id: null, synced_todo_id: todoId };
}

export function isPlanSynced(item: CivilPlanItem): boolean {
  return !!(item.synced_schedule_id || item.synced_todo_id);
}
