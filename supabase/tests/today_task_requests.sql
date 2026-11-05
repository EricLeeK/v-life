-- Run against a migrated local database; all test records are rolled back.
begin;
insert into auth.users(id) values ('ad510000-0000-4000-8000-000000000001');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled)
values ('ad510000-0000-4000-8000-000000000001','today-origin-test','rollback fixture',true,true,true);
insert into public.settings(user_id,day_start_hour)
values ('ad510000-0000-4000-8000-000000000001',0);
select set_config('request.jwt.claims','{"sub":"ad510000-0000-4000-8000-000000000001","role":"authenticated","client_id":"today-origin-test"}',true);
set local role authenticated;
do $$
declare
  created jsonb;
  transferred jsonb;
  task_id uuid;
  source_id uuid;
  target_id uuid;
  routine_created jsonb;
  routine_second_day jsonb;
  routine_copy jsonb;
  routine_move jsonb;
  routine_id uuid;
  routine_source uuid;
  routine_copy_target uuid;
  routine_target uuid;
  created_todo jsonb;
  created_project jsonb;
  created_project_task jsonb;
begin
  created:=public.agent_mutate('daily_task','create',null,'{"title":"Future task","task_date":"2026-11-03"}','future-origin');
  if created ? 'error' then raise exception 'future task creation failed: %',created; end if;
  task_id:=(created->'data'->>'todo_id')::uuid;
  source_id:=(created->'data'->>'id')::uuid;
  if (created->'data'->>'origin_task_date') is distinct from '2026-11-03' then
    raise exception 'initial displayed date must follow planned date: %',created;
  end if;

  transferred:=public.daily_task_transfer(array[source_id],'2026-11-04','move','future-move');
  if transferred ? 'error' then raise exception 'future task move failed: %',transferred; end if;
  target_id:=(transferred->'data'->'items'->0->>'target_daily_task_id')::uuid;
  if not exists(select 1 from public.daily_tasks where id=target_id and task_date='2026-11-04' and origin_task_date='2026-11-03') then
    raise exception 'moving the task changed its original displayed date';
  end if;
  if exists(select 1 from public.daily_tasks where id=source_id) then
    raise exception 'move retained the source row';
  end if;
  if not exists(select 1 from public.todos where id=task_id) then raise exception 'move lost its todo repository record'; end if;

  routine_created:=public.agent_mutate('daily_task','create',null,'{"title":"Routine origin","kind":"routine","task_date":"2026-11-03"}','routine-origin');
  if routine_created ? 'error' then raise exception 'routine task creation failed: %',routine_created; end if;
  routine_id:=(routine_created->'data'->>'todo_id')::uuid;
  routine_source:=(routine_created->'data'->>'id')::uuid;
  routine_second_day:=public.agent_mutate('daily_task','create',null,jsonb_build_object('todo_id',routine_id,'task_date','2026-11-04'));
  if routine_second_day ? 'error' or routine_second_day->'data'->>'origin_task_date' is distinct from '2026-11-04' then
    raise exception 'a newly planned routine day must use its own date: %',routine_second_day;
  end if;
  routine_copy:=public.daily_task_transfer(array[routine_source],'2026-11-06','copy','routine-origin-copy');
  if routine_copy ? 'error' then raise exception 'routine copy failed: %',routine_copy; end if;
  routine_copy_target:=(routine_copy->'data'->'items'->0->>'target_daily_task_id')::uuid;
  if not exists(select 1 from public.daily_tasks where id=routine_copy_target and task_date='2026-11-06' and origin_task_date='2026-11-06') then
    raise exception 'copying a routine to a new day must use the target as its plan date';
  end if;
  routine_move:=public.daily_task_transfer(array[routine_source],'2026-11-06','move','routine-origin-move');
  if routine_move ? 'error' then raise exception 'routine transfer failed: %',routine_move; end if;
  routine_target:=(routine_move->'data'->'items'->0->>'target_daily_task_id')::uuid;
  if routine_target is distinct from routine_copy_target
    or not exists(select 1 from public.daily_tasks where id=routine_target and task_date='2026-11-06' and origin_task_date='2026-11-03') then
    raise exception 'routine transfer did not carry its selected source date onto an existing target';
  end if;

  created_todo:=public.agent_mutate('todo','create',null,'{"title":"Estimated personal task","estimated_minutes":45}');
  if created_todo ? 'error' or (created_todo->'data'->>'estimated_minutes')::integer<>45 then
    raise exception 'agent could not save personal task duration: %',created_todo;
  end if;
  created_todo:=public.agent_mutate('todo','update',(created_todo->'data'->>'id')::uuid,'{"estimated_minutes":240}');
  if created_todo ? 'error' or (select estimated_minutes from public.todos where id=(created_todo->'data'->>'id')::uuid)<>240 then
    raise exception 'agent could not update personal task duration: %',created_todo;
  end if;

  created_project:=public.agent_mutate('project','create',null,'{"name":"Duration project"}');
  if created_project ? 'error' then raise exception 'duration project creation failed: %',created_project; end if;
  created_project_task:=public.agent_mutate('project_task','create',null,jsonb_build_object(
    'project_id',created_project->'data'->>'id','title','Project duration','estimated_minutes',60
  ));
  if created_project_task ? 'error' or (created_project_task->'data'->>'estimated_minutes')::integer<>60 then
    raise exception 'agent could not save project task duration: %',created_project_task;
  end if;
end $$;
reset role;

-- The authenticated app move preserves origin and scopes both rows to its user.
select set_config('request.jwt.claims','{"sub":"ad510000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare
  created jsonb;
  moved jsonb;
  source_id uuid;
  target_id uuid;
begin
  created:=public.daily_task_mutate('create',null,'{"title":"Browser moved task","task_date":"2026-11-03"}');
  if created ? 'error' then raise exception 'browser source task creation failed: %',created; end if;
  source_id:=(created->'data'->>'id')::uuid;
  moved:=public.daily_task_move(source_id,'2026-11-04');
  if moved ? 'error' then raise exception 'browser task move failed: %',moved; end if;
  target_id:=(moved->'data'->>'id')::uuid;
  if not exists(select 1 from public.daily_tasks where id=target_id and task_date='2026-11-04' and origin_task_date='2026-11-03')
    or exists(select 1 from public.daily_tasks where id=source_id) then
    raise exception 'browser move lost the source date or retained the source row';
  end if;
end $$;
reset role;
rollback;
