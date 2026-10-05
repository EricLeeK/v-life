begin;
do $$ begin
  if to_regprocedure('public.daily_task_overview(text,integer)') is null then raise exception 'Missing task overview workflow'; end if;
  if to_regprocedure('public.daily_task_transfer(uuid[],text,text,text,text)') is null then raise exception 'Missing atomic task transfer workflow'; end if;
end $$;
insert into auth.users(id) values ('ad280000-0000-4000-8000-000000000001'),('ad280000-0000-4000-8000-000000000002');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled)
values ('ad280000-0000-4000-8000-000000000001','task-workflow-test','rollback fixture',true,true,true);
insert into public.settings(user_id,day_start_hour) values ('ad280000-0000-4000-8000-000000000001',0);
insert into public.todos(id,user_id,title,kind) values
('bd280000-0000-4000-8000-000000000001','ad280000-0000-4000-8000-000000000001','Preserve my scores','once'),
('bd280000-0000-4000-8000-000000000002','ad280000-0000-4000-8000-000000000001','Existing target','routine'),
('bd280000-0000-4000-8000-000000000003','ad280000-0000-4000-8000-000000000001','Paused','once'),
('bd280000-0000-4000-8000-000000000004','ad280000-0000-4000-8000-000000000002','Other user','once');
update public.todos set is_paused=true where id='bd280000-0000-4000-8000-000000000003';
insert into public.daily_tasks(id,user_id,todo_id,task_date,difficulty,base_points,metadata) values
('dd280000-0000-4000-8000-000000000001','ad280000-0000-4000-8000-000000000001','bd280000-0000-4000-8000-000000000001','2026-09-27','hard',70,'{"original":true}'),
('dd280000-0000-4000-8000-000000000002','ad280000-0000-4000-8000-000000000001','bd280000-0000-4000-8000-000000000002','2026-09-27','medium',20,'{}'),
('dd280000-0000-4000-8000-000000000003','ad280000-0000-4000-8000-000000000001','bd280000-0000-4000-8000-000000000002','2026-09-28','easy',10,'{"target":true}'),
('dd280000-0000-4000-8000-000000000004','ad280000-0000-4000-8000-000000000001','bd280000-0000-4000-8000-000000000003','2026-09-27','easy',10,'{}'),
('dd280000-0000-4000-8000-000000000005','ad280000-0000-4000-8000-000000000002','bd280000-0000-4000-8000-000000000004','2026-09-27','easy',10,'{}');
select set_config('request.jwt.claims','{"sub":"ad280000-0000-4000-8000-000000000001","role":"authenticated","client_id":"task-workflow-test"}',true);
set local role authenticated;
do $$ declare r jsonb; again jsonb; target uuid; before_count int; begin
  r:=public.daily_task_overview('2026-09-28',3);
  if r ? 'error' or r->'data'->>'complete' is distinct from 'true' or jsonb_array_length(r->'data'->'backlog')<>3 then raise exception 'Invalid complete overview: %',r; end if;
  if not exists(select 1 from jsonb_array_elements(r->'data'->'backlog') x where x->>'title'='Preserve my scores' and x->>'daily_task_id'='dd280000-0000-4000-8000-000000000001') then raise exception 'Titles or distinct IDs missing'; end if;
  if exists(select 1 from jsonb_array_elements(r->'data'->'backlog') x where x->>'title'='Paused' and (x->>'can_transfer')::boolean) then raise exception 'Paused task incorrectly transferable'; end if;
  if r->'data'->>'business_date' is distinct from public.task_business_date()::text then raise exception 'Business date mismatch'; end if;
  r:=public.daily_task_overview('tomorrow',0);
  if r->'data'->>'date' is distinct from (public.task_business_date()+1)::text then raise exception 'Tomorrow mismatch'; end if;
  r:=public.daily_task_overview('2026-02-30',3);
  if r->'error'->>'code' is distinct from 'INVALID_INPUT' then raise exception 'Invalid calendar date accepted'; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000001','dd280000-0000-4000-8000-000000000001']::uuid[],'today','copy','duplicate');
  if r->'error'->>'code' is distinct from 'INVALID_INPUT' then raise exception 'Duplicate input IDs accepted'; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000001']::uuid[],'today','copy',null);
  if r->'error'->>'code' is distinct from 'INVALID_INPUT' then raise exception 'Missing retry key accepted'; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000001','dd280000-0000-4000-8000-000000000004']::uuid[],'2026-09-28','move','atomic-invalid');
  if r->'error'->>'code' is distinct from 'TASK_NOT_ELIGIBLE' then raise exception 'Paused batch accepted: %',r; end if;
  if not exists(select 1 from public.daily_tasks where id='dd280000-0000-4000-8000-000000000001') or exists(select 1 from public.daily_tasks where todo_id='bd280000-0000-4000-8000-000000000001' and task_date='2026-09-28') then raise exception 'Partial move escaped rollback'; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000001','dd280000-0000-4000-8000-000000000005']::uuid[],'2026-09-28','move','foreign');
  if r->'error'->>'code' is distinct from 'NOT_FOUND' then raise exception 'Cross-user source accepted: %',r; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000001','dd280000-0000-4000-8000-000000000002']::uuid[],'2026-09-28','move','move-both');
  if r ? 'error' or r->'data'->>'removed_count'<>'2' or r->'data'->>'created_count'<>'1' then raise exception 'Move failed: %',r; end if;
  if exists(select 1 from public.daily_tasks where id in ('dd280000-0000-4000-8000-000000000001','dd280000-0000-4000-8000-000000000002')) then raise exception 'Old sources remain'; end if;
  select id into target from public.daily_tasks where todo_id='bd280000-0000-4000-8000-000000000001' and task_date='2026-09-28';
  if not exists(select 1 from public.daily_tasks where id=target and difficulty='hard' and base_points=70 and metadata='{"original":true}') then raise exception 'Task metadata lost'; end if;
  if not exists(select 1 from public.daily_tasks where id='dd280000-0000-4000-8000-000000000003' and base_points=10 and metadata='{"target":true}') then raise exception 'Existing target overwritten'; end if;
  again:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000001','dd280000-0000-4000-8000-000000000002']::uuid[],'2026-09-28','move','move-both');
  if again->>'replayed'<>'true' or again->'data' is distinct from r->'data' then raise exception 'Retry after deletion failed: %',again; end if;
  again:=public.daily_task_transfer(array[target],'2026-09-29','copy','move-both');
  if again->'error'->>'code' is distinct from 'IDEMPOTENCY_CONFLICT' then raise exception 'Reused key conflict missing'; end if;
  r:=public.daily_task_transfer(array[target],'2026-09-29','copy','copy-once');
  if r ? 'error' or exists(select 1 from public.daily_tasks where id=target)
    or r->'data'->>'removed_count'<>'1' or r->'data'->'items'->0->>'outcome'<>'moved'
    or (select count(*) from public.daily_tasks where todo_id='bd280000-0000-4000-8000-000000000001' and not is_completed)<>1
    then raise exception 'Once task must stay on one open day: %',r; end if;
  again:=public.daily_task_transfer(array[target],'2026-09-29','copy','copy-once');
  if again->>'replayed'<>'true' or again->'data' is distinct from r->'data' then raise exception 'Once reschedule replay failed: %',again; end if;
  target:=(r->'data'->'items'->0->>'target_daily_task_id')::uuid;
  r:=public.agent_mutate('daily_task','update',target,'{"is_completed":true}');
  if exists(select 1 from public.daily_tasks where todo_id='bd280000-0000-4000-8000-000000000001' and not is_completed) then raise exception 'Existing completion semantics changed'; end if;
  r:=public.daily_task_transfer(array[target],'2026-09-30','move','completed');
  if r->'error'->>'code' is distinct from 'TASK_NOT_ELIGIBLE' then raise exception 'Completed source moved'; end if;
end $$;
reset role;
-- More than a generic list page must still arrive in one complete context.
insert into public.todos(user_id,title) select 'ad280000-0000-4000-8000-000000000001','Bulk '||i from generate_series(1,65) i;
insert into public.daily_tasks(user_id,todo_id,task_date) select user_id,id,'2026-09-27' from public.todos where user_id='ad280000-0000-4000-8000-000000000001' and title like 'Bulk %';
update public.agent_client_access set delete_enabled=false where client_id='task-workflow-test';
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.daily_task_overview('2026-09-28',3);
  if jsonb_array_length(r->'data'->'backlog')<>66 then raise exception 'Overview truncated at one page: %',r; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000003']::uuid[],'tomorrow','move','no-delete');
  if r->'error'->>'code' is distinct from 'PERMISSION_DENIED' then raise exception 'Move without delete allowed'; end if;
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000003']::uuid[],'tomorrow','copy','copy-no-delete');
  if r ? 'error' or r->'data'->>'removed_count'<>'0'
    or r->'data'->'items'->0->>'outcome'<>'copied'
    or not exists(select 1 from public.daily_tasks where id='dd280000-0000-4000-8000-000000000003')
    then raise exception 'Routine copy must preserve source without delete permission: %',r; end if;
  perform set_config('vlife_test.original_target',r->'data'->>'target_date',true);
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000003']::uuid[],'2026-09-28','copy','same-date');
  if r ? 'error' or r->'data'->>'unchanged_count'<>'1' or r->'data'->>'created_count'<>'0' then raise exception 'Same-day no-op failed: %',r; end if;
end $$;
reset role;
-- A changed business-day boundary must not re-resolve a retry's relative target.
update public.settings set day_start_hour=23 where user_id='ad280000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000003']::uuid[],'tomorrow','copy','copy-no-delete');
  if r->>'replayed'<>'true' or r->'data'->>'target_date' is distinct from current_setting('vlife_test.original_target') then raise exception 'Relative date drifted during replay: %',r; end if;
end $$;
reset role;
update public.agent_client_access set read_enabled=false where client_id='task-workflow-test';
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.daily_task_overview('today',3);
  if r->'error'->>'code' is distinct from 'PERMISSION_DENIED' then raise exception 'Overview without read allowed'; end if;
end $$;
reset role;
update public.agent_client_access set read_enabled=true,write_enabled=false where client_id='task-workflow-test';
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.daily_task_transfer(array['dd280000-0000-4000-8000-000000000003']::uuid[],'tomorrow','copy','copy-no-delete');
  if r->'error'->>'code' is distinct from 'PERMISSION_DENIED' then raise exception 'Replay bypassed current permission'; end if;
end $$;
reset role;
insert into public.todos(user_id,title) select 'ad280000-0000-4000-8000-000000000001','Overflow '||i from generate_series(1,450) i;
insert into public.daily_tasks(user_id,todo_id,task_date) select user_id,id,'2026-09-27' from public.todos where user_id='ad280000-0000-4000-8000-000000000001' and title like 'Overflow %';
set local role authenticated;
do $$ declare r jsonb; begin
  r:=public.daily_task_overview('2026-09-28',3);
  if r->'error'->>'code' is distinct from 'RESULT_TOO_LARGE' or r ? 'data' then raise exception 'Oversize context silently truncated'; end if;
  r:=public.daily_task_overview('2026-09-28',0);
  if r ? 'error' or r->'data'->>'complete'<>'true' then raise exception 'Narrowed context failed'; end if;
end $$;
reset role;
rollback;
