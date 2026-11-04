import { supabase } from "@/integrations/supabase/client";
import type { DemoDataStore } from "@/data/demoSeed";

type Request = { title: string; project_name?: string; task_id?: string };
type Card = { id: string; title: string; project_id: string; project_name: string };
type Failure = { status: "not_found" | "ambiguous"; candidates: Card[] };
type Receipt = (Card & { status: "matched" | "arranged" | "already_arranged" }) | Failure;
type Demo = { data: DemoDataStore; day: string; arrange: (id: string, day: string) => void };

export function existingTodayCommand(text: string): Request | null {
  const match = /^(?:请)?(?:帮我)?把(.+?)(?:加入|安排到|加到|排到)今[天日](?:的?待办)?[。！!]?$/u.exec(text.trim());
  if (!match || /[，。；\n]/u.test(match[1])) return null;
  const phrase = match[1].trim();
  const scoped = /^「(.+?)」(?:项目)?(?:里|中)?的(.+)$/u.exec(phrase)
    ?? /^(.+?)项目(?:里|中)?的(.+)$/u.exec(phrase);
  const title = (scoped?.[2] ?? match[1]).trim().replace(/^[「“'"](.+)[」”'"]$/u, "$1");
  return { title, ...(scoped && { project_name: scoped[1] }) };
}

export async function projectTodayRequest(request: Request, apply: boolean, demo?: Demo): Promise<Receipt> {
  if (!request.title?.trim()) throw new Error("缺少原任务名称");
  if (!demo) {
    const { data, error } = await supabase.rpc("agent_project_today", {
      p_title: request.title, p_project_name: request.project_name, p_task_id: request.task_id, p_apply: apply,
    });
    if (error) throw error;
    return (data as unknown as { data: Receipt }).data;
  }
  const normalize = (value: string) => value.trim().toLowerCase();
  const title = normalize(request.title);
  const candidates = demo.data.project_tasks.flatMap(task => {
    if (task.type !== "task" || task.status === "done" || !normalize(task.title).includes(title)) return [];
    const project = demo.data.projects.find(row => row.id === task.project_id);
    if (!project || (request.task_id && task.id !== request.task_id) ||
      (request.project_name && normalize(project.name) !== normalize(request.project_name))) return [];
    return [{ id: task.id, title: task.title, project_name: project.name, project_id: project.id, day: task.today_date }];
  });
  const exact = candidates.filter(task => normalize(task.title) === title);
  const best = exact.length ? exact : candidates;
  if (best.length !== 1) return { status: best.length ? "ambiguous" : "not_found", candidates: best.slice(0,10) };
  const card = best[0];
  if (!apply) return { ...card, status: "matched" };
  if (card.day === demo.day) return { ...card, status: "already_arranged" };
  demo.arrange(card.id, demo.day);
  return { ...card, status: "arranged" };
}

export function projectTodayMiss(result: Failure) {
  if (result.status === "not_found") return "没有找到对应的未完成项目任务。请提供原卡片的名称。";
  return "找到多张匹配的卡片，请注明项目名称：" + result.candidates.map(card =>
    `「${card.project_name}」的「${card.title}」`).join("、");
}
