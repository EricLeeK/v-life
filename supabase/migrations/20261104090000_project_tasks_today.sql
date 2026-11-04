-- The date is an arrangement on the original card; status remains authoritative.
alter table public.project_tasks add column today_date date;
create index project_tasks_today_date_idx on public.project_tasks(today_date)
  where today_date is not null and type = 'task';

create function public.project_today_action(p_project_id uuid, p_task_id uuid, p_day date, p_action text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  item public.project_tasks;
  done_order uuid[];
begin
  perform 1 from projects where id=p_project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project unavailable'; end if;
  select * into item from project_tasks where id=p_task_id and project_id=p_project_id for update;
  if not found or item.type <> 'task' or p_day is null then raise exception 'Task unavailable'; end if;
  case p_action
    when 'add' then
      if item.status = 'done' then raise exception 'Task already completed'; end if;
      update project_tasks set today_date=p_day where id=item.id and today_date is distinct from p_day;
    when 'remove' then
      update project_tasks set today_date=null where id=item.id and today_date=p_day;
    when 'complete' then
      if item.today_date is distinct from p_day then raise exception 'Arrangement changed'; end if;
      if item.status <> 'done' then
        select array(select id from project_tasks where project_id=p_project_id and status='done'
          order by sort_order,created_at,id) || item.id into done_order;
        perform public.move_project_board_item(p_project_id,item.id,'done',done_order);
      end if;
    else raise exception 'Unknown action';
  end case;
end;
$$;
revoke all on function public.project_today_action(uuid,uuid,date,text) from public,anon;
grant execute on function public.project_today_action(uuid,uuid,date,text) to authenticated;
