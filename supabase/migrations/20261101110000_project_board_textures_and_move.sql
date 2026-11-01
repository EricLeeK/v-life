-- One card's status, both column orders and weighted project progress commit together.
alter table public.project_tasks add column if not exists cover_preset text not null default 'auto'
  check (cover_preset in ('auto','none','sage','sand','clay','mist','iris'));

create or replace function public.move_project_board_item(
  p_project_id uuid, p_task_id uuid, p_status text, p_order uuid[]
) returns setof public.project_tasks
language plpgsql security invoker set search_path = public
as $$
declare old_status text; expected_ids uuid[]; supplied_ids uuid[];
begin
  perform 1 from public.projects where id=p_project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project not found or access denied'; end if;
  if p_status not in ('todo','this_week','in_progress','waiting','done') or p_status is null then
    raise exception 'Invalid task status';
  end if;
  select status into old_status from public.project_tasks where id=p_task_id and project_id=p_project_id;
  if not found then raise exception 'Task not found'; end if;
  select array_agg(id order by id) into expected_ids from public.project_tasks
    where project_id=p_project_id and (status=p_status or id=p_task_id);
  select array_agg(id order by id) into supplied_ids from unnest(p_order) as ids(id);
  if supplied_ids is distinct from expected_ids then
    raise exception 'Board changed. Refresh and retry.';
  end if;
  update public.project_tasks set status=p_status, updated_at=now() where id=p_task_id and project_id=p_project_id;
  update public.project_tasks t set sort_order=o.position-1, updated_at=now()
    from unnest(p_order) with ordinality as o(id,position)
    where t.id=o.id and t.project_id=p_project_id;
  if old_status<>p_status then
    with ordered as (
      select id,(row_number() over(order by sort_order,created_at,id)-1)::integer as position
      from public.project_tasks where project_id=p_project_id and status=old_status
    ) update public.project_tasks t set sort_order=o.position from ordered o where t.id=o.id;
  end if;
  update public.projects set progress=(
    select coalesce(round((100.0*sum(case when status='done' then weight else 0 end)/nullif(sum(weight),0))::numeric),0)::integer
    from public.project_tasks where project_id=p_project_id and type<>'habit'
  ),updated_at=now() where id=p_project_id;
  return query select * from public.project_tasks where project_id=p_project_id order by sort_order,created_at,id;
end;
$$;
revoke all on function public.move_project_board_item(uuid,uuid,text,uuid[]) from public,anon;
grant execute on function public.move_project_board_item(uuid,uuid,text,uuid[]) to authenticated;
