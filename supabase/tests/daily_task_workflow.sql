begin;
insert into auth.users(id) values ('ad240000-0000-4000-8000-000000000001'),('ad240000-0000-4000-8000-000000000002');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled) values ('ad240000-0000-4000-8000-000000000001','daily-test','integration',true,true,true);
insert into public.todos(id,user_id,title) values('bd240000-0000-4000-8000-000000000002','ad240000-0000-4000-8000-000000000002','other user');
select set_config('request.jwt.claims','{"sub":"ad240000-0000-4000-8000-000000000001","role":"authenticated","client_id":"daily-test"}',true);
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; tid uuid; did uuid; routine uuid; begin
r:=public.agent_mutate('daily_task','create',null,'{"title":"new today"}','add-key');
if r->'data'->>'todo_id' is null then raise exception 'new today task failed: %',r; end if;
tid:=(r->'data'->>'todo_id')::uuid; did:=(r->'data'->>'id')::uuid;
if not exists(select 1 from public.todos where id=tid and title='new today') then raise exception 'mother todo missing'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"title":"new today"}','add-key');
if r2->'data'->>'id' is distinct from did::text then raise exception 'idempotency failed'; end if;
r2:=public.agent_mutate('daily_task','create',null,jsonb_build_object('todo_id',tid));
if r2->'data'->>'id' is distinct from did::text then raise exception 'duplicate today task'; end if;
r2:=public.agent_mutate('daily_task','update',did,'{"is_completed":true}');
if r2->'data'->>'is_completed' is distinct from 'true' or not (select is_completed from public.todos where id=tid) then raise exception 'daily to mother sync failed: %',r2; end if;
r2:=public.agent_mutate('daily_task','update',did,'{"is_completed":false}');
if (select is_completed from public.todos where id=tid) then raise exception 'undo mother sync failed'; end if;
r2:=public.agent_mutate('todo','update',tid,'{"is_completed":true}');
if not (select is_completed from public.daily_tasks where id=did) then raise exception 'mother to daily sync failed'; end if;
r2:=public.agent_mutate('todo','update',tid,'{"is_completed":false}');
if (select is_completed from public.daily_tasks where id=did) then raise exception 'mother undo daily sync failed'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"title":"routine today","kind":"routine"}');
routine:=(r2->'data'->>'todo_id')::uuid;
r2:=public.agent_mutate('daily_task','update',(r2->'data'->>'id')::uuid,'{"is_completed":true}');
if r2 ? 'error' or (select is_completed from public.todos where id=routine) then raise exception 'routine was permanently completed: %',r2; end if;
r2:=public.agent_mutate('todo','update',routine,'{"is_completed":true}');
if not (r2 ? 'error') then raise exception 'routine mother allowed complete'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"todo_id":"bd240000-0000-4000-8000-000000000002"}');
if not (r2 ? 'error') then raise exception 'cross user reference allowed'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"title":"bad kind","kind":"habit"}');
if not (r2 ? 'error') then raise exception 'habit allowed into daily tasks'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"title":"rollback child","difficulty":"invalid"}');
if not (r2 ? 'error') or exists(select 1 from public.todos where title='rollback child') then raise exception 'partial write not rolled back'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"title":"other payload"}','add-key');
if r2->'error'->>'code' is distinct from 'IDEMPOTENCY_CONFLICT' then raise exception 'key conflict allowed'; end if;
r2:=public.agent_mutate('daily_task','create',null,'{"title":"inject","user_id":"ad240000-0000-4000-8000-000000000002"}');
if r2->'error'->>'code' is distinct from 'FIELD_NOT_ALLOWED' then raise exception 'identity injection allowed'; end if;
r2:=public.agent_mutate('todo','create',null,'{"title":"paused","kind":"routine","is_paused":true}');
r2:=public.agent_mutate('daily_task','create',null,jsonb_build_object('todo_id',r2->'data'->>'id'));
if not (r2 ? 'error') then raise exception 'paused task allowed'; end if;
r2:=public.agent_mutate('todo','create',null,'{"title":"duplicate","kind":"once"}');
r2:=public.agent_mutate('todo','create',null,'{"title":"duplicate","kind":"once"}');
r2:=public.agent_mutate('daily_task','create',null,'{"title":"duplicate"}');
if not (r2 ? 'error') then raise exception 'ambiguous title chosen silently'; end if;
r2:=public.agent_mutate('daily_task','create',null,jsonb_build_object('todo_id',tid,'task_date','2026-09-23'));
if r2 ? 'error' then raise exception 'existing todo add failed: %',r2; end if;
r2:=public.agent_mutate('daily_task','update',(r2->'data'->>'id')::uuid,'{"is_completed":true}');
if exists(select 1 from public.daily_tasks where todo_id=tid and (not is_completed or completed_at is null)) then raise exception 'related dates inconsistent'; end if;
r2:=public.agent_mutate('daily_task','delete',did,'{}');
if r2 ? 'error' or not exists(select 1 from public.todos where id=tid and is_completed) then raise exception 'remove destroyed mother'; end if;
begin
 insert into public.daily_tasks(user_id,todo_id,task_date) values(auth.uid(),tid,'2026-01-01');
 raise exception 'direct OAuth daily write allowed';
exception when insufficient_privilege then null; end;

end $$;
reset role;
-- Browser uses the same domain helper; no OAuth token needed.
select set_config('request.jwt.claims','{"sub":"ad240000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb; tid uuid; begin
r:=public.daily_task_mutate('create',null,'{"title":"browser today"}');
tid:=(r->'data'->>'todo_id')::uuid;
r:=public.daily_task_mutate('update',(r->'data'->>'id')::uuid,'{"is_completed":true}');
if not (select is_completed from public.todos where id=tid) then raise exception 'browser sync failed'; end if;
end $$;
reset role;
update public.agent_client_access set write_enabled=false,delete_enabled=false where client_id='daily-test';
select set_config('request.jwt.claims','{"sub":"ad240000-0000-4000-8000-000000000001","role":"authenticated","client_id":"daily-test"}',true);
set local role authenticated;
do $$ declare r jsonb; begin
r:=public.agent_mutate('daily_task','create',null,'{"title":"forbidden"}');
if r->'error'->>'code' is distinct from 'PERMISSION_DENIED' then raise exception 'read-only write allowed'; end if;
begin
 perform public.daily_task_mutate('create',null,'{"title":"bypass"}');
 raise exception 'OAuth bypassed audited RPC';
exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.agent_client_access set write_enabled=false,delete_enabled=true where client_id='daily-test';
set local role authenticated;
do $$ declare r jsonb; did uuid; begin
select id into did from public.daily_tasks limit 1;
r:=public.agent_mutate('daily_task','delete',did,'{}');
if r ? 'error' then raise exception 'delete-only grant rejected: %',r; end if;
end $$;
reset role;
update public.agent_client_access set read_enabled=false,write_enabled=true where client_id='daily-test';
set local role authenticated;
do $$ declare r jsonb; begin
r:=public.agent_mutate('daily_task','create',null,'{"title":"write without read"}');
if r->'data'->>'id' is null then raise exception 'write-only grant cannot create: %',r; end if;
end $$;
reset role;
update public.agent_client_access set revoked_at=now() where client_id='daily-test';
set local role authenticated;
do $$ declare r jsonb; begin
r:=public.agent_mutate('daily_task','create',null,'{"title":"revoked"}');
if r->'error'->>'code' is distinct from 'PERMISSION_DENIED' then raise exception 'revoked write allowed'; end if;
end $$;
reset role;
rollback;
