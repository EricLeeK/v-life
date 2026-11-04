begin;
alter table public.schedule_events
  add column project_task_id uuid references public.project_tasks(id) on delete set null,
  add column todo_id uuid references public.todos(id) on delete set null,
  add constraint schedule_one_source check (num_nonnulls(project_task_id,todo_id)<=1);
create index schedule_project_task_idx on public.schedule_events(project_task_id) where project_task_id is not null;
create index schedule_todo_idx on public.schedule_events(todo_id) where todo_id is not null;
create function public.check_schedule_source() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.project_task_id is not null and not exists (
    select 1 from public.project_tasks t join public.projects p on p.id=t.project_id
    where t.id=new.project_task_id and t.type='task' and p.user_id=new.user_id
  ) then raise exception 'Project task unavailable'; end if;
  if new.todo_id is not null and not exists (
    select 1 from public.todos t where t.id=new.todo_id and t.user_id=new.user_id
  ) then raise exception 'To-do unavailable'; end if;
  return new;
end $$;
create trigger check_schedule_source before insert or update of project_task_id,todo_id,user_id on public.schedule_events
  for each row execute function public.check_schedule_source();

create function public.set_project_task_done(p_project_id uuid,p_task_id uuid,p_done boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare current_status text; destination text; card_order uuid[];
begin
  perform 1 from public.projects where id=p_project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project unavailable'; end if;
  select status into strict current_status from public.project_tasks
    where id=p_task_id and project_id=p_project_id and type='task' for update;
  if p_done is null then raise exception 'Completion state required'; end if;
  if (current_status='done')=p_done then return; end if;
  destination := case when p_done then 'done' else 'todo' end;
  select array(select id from public.project_tasks where project_id=p_project_id and status=destination order by sort_order,created_at,id)
    || p_task_id into card_order;
  perform public.move_project_board_item(p_project_id,p_task_id,destination,card_order);
end $$;
revoke all on function public.set_project_task_done(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_project_task_done(uuid,uuid,boolean) to authenticated;
update agent_private.module_contracts
set contract = jsonb_set(jsonb_set(contract,'{createColumns}',(contract->'createColumns') || '["project_task_id","todo_id"]'::jsonb),
  '{readColumns}',(contract->'readColumns') || '["project_task_id","todo_id"]'::jsonb)
where module='schedule';
commit;
