import { Check, CheckCircle2, CheckSquare, Flag, GripVertical, Repeat, Pencil, X } from 'lucide-react';
import { format, isValid, parseISO, startOfWeek } from 'date-fns';
import { useLang } from '@/contexts/LanguageContext';
import { useHabitLogs, useToggleHabitLog } from '@/hooks/useData';
import { useLocalDate } from '@/hooks/useLocalDate';
import type { Tables } from '@/integrations/supabase/types';
import { resolveCover } from './board-model';
import { useToast } from '@/hooks/use-toast';

export type ProjectTask = Tables<'project_tasks'> & { cover_preset?: string | null };
export function ProjectWorkCard({task,onEdit,onDelete,onComplete,disabled=false,editMode=false}:{task:ProjectTask;onEdit:()=>void;onDelete:()=>void;onComplete:(done:boolean)=>void;disabled?:boolean;editMode?:boolean}) {
  const {t}=useLang();
  const today=useLocalDate();
  const cover=resolveCover(task);
  const Icon=task.type==='milestone'?Flag:task.type==='habit'?Repeat:CheckSquare;
  const typeLabel=task.type==='milestone'?t('里程碑','Milestone'):task.type==='habit'?t('习惯','Habit'):t('任务','Task');
  const due=task.due_date?parseISO(task.due_date):null;
  const overdue=!!(due&&isValid(due)&&task.due_date!.slice(0,10)<today&&task.status!=='done');
  return <div className={`project-card-shell ${editMode?'is-editing':''}`}><article className={`project-work-card ${task.status==='done'?'is-done':''}`}>
    {cover!=='none'&&<div className="project-cover" data-preset={cover}><span>{task.type==='milestone'?t('里程碑','Milestone'):task.type==='habit'?t('持续积累','Keep growing'):t('重点事项','Focus item')}</span></div>}
    <div className="project-card-body">
      <div className="project-card-title"><span>{task.title}</span>{task.status==='done'&&<CheckCircle2 className="h-3.5 w-3.5 shrink-0"/>}</div>
      {task.description&&<p className="project-card-description">{task.description}</p>}
      <div className="project-card-meta"><span className="project-card-type"><Icon className="h-3.5 w-3.5"/>{typeLabel}</span><span className="project-card-trailing">
        {due&&isValid(due)&&<time className={overdue?'is-overdue':''} dateTime={task.due_date!} title={overdue?t('已逾期','Overdue'):t('截止日期','Due date')}>{format(due,'MM/dd')}</time>}
        {task.type==='milestone'&&<button className="project-complete" type="button" aria-label={t(`${task.status==='done'?'重新打开':'完成'}${task.title}`,`${task.status==='done'?'Reopen':'Complete'} ${task.title}`)} aria-pressed={task.status==='done'} disabled={disabled||editMode} onClick={event=>{event.stopPropagation();onComplete(task.status!=='done');}}>{task.status==='done'?<Check className="h-3 w-3"/>:<span/>}</button>}
        <span data-project-drag-handle className="project-card-handle" title={t('拖动排序','Drag to move')} aria-hidden="true"><GripVertical className="h-3.5 w-3.5"/></span>
      </span></div>
    </div>
    {task.type==='habit'&&<HabitFooter task={task} disabled={disabled||editMode}/>}
  </article>
    {editMode&&<div className="project-card-actions" role="group" aria-label={t(`${task.title}的操作`,`Actions for ${task.title}`)}>
      <button type="button" className="project-card-edit" disabled={disabled} aria-label={t(`编辑${task.title}`,`Edit ${task.title}`)} title={t('编辑','Edit')} onClick={onEdit}><Pencil className="h-3.5 w-3.5"/></button>
      <button type="button" className="project-card-remove" disabled={disabled} aria-label={t(`删除${task.title}`,`Delete ${task.title}`)} title={t('删除','Delete')} onClick={onDelete}><X className="h-3 w-3"/></button>
    </div>}
  </div>;
}
function HabitFooter({task,disabled}:{task:ProjectTask;disabled:boolean}) {
  const {t}=useLang();const today=useLocalDate();
  const {toast}=useToast();
  const {data:logs=[]}=useHabitLogs(task.id);const toggle=useToggleHabitLog();
  const weekStart=format(startOfWeek(parseISO(today),{weekStartsOn:1}),'yyyy-MM-dd');
  const dates=new Set<string>(logs.map((log:{log_date:string})=>log.log_date));
  const completed=dates.has(today);
  const count=[...dates].filter(date=>date>=weekStart&&date<=today).length;
  const checkIn=async()=>{
    try { await toggle.mutateAsync({taskId:task.id,projectId:task.project_id,logDate:today}); }
    catch(error) { toast({title:t('打卡未保存，请重试','Check-in not saved. Try again.'),description:error instanceof Error?error.message:String(error),variant:'destructive'}); }
  };
  return <div className="project-habit-footer"><span>{t(`本周 ${count} / 7 天`,`${count} / 7 days this week`)}</span><button type="button" disabled={disabled||toggle.isPending} aria-pressed={completed} className={completed?'is-checked':''} onClick={checkIn}>{completed?<><Check className="h-3 w-3"/>{t('已打卡','Checked in')}</>:t('今日打卡','Check in')}</button></div>;
}
