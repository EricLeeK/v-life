begin;
insert into auth.users(id) values ('aa000000-0000-4000-8000-000000000001'),('aa000000-0000-4000-8000-000000000002');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled) values ('aa000000-0000-4000-8000-000000000001','agent-test','integration',true,true,true);
insert into public.todos(id,user_id,title) values('bb000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','other user');
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"agent-test"}',true);
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; begin
if exists(select 1 from public.todos where user_id='aa000000-0000-4000-8000-000000000002') then raise exception 'cross-user read allowed'; end if;
r2:=public.agent_mutate('todo','update','bb000000-0000-4000-8000-000000000002','{"title":"cross user"}',null,'cross-user','todo_update');
if r2->'error'->>'code' <> 'NOT_FOUND' then raise exception 'cross-user update allowed: %',r2; end if;
r := public.agent_mutate('todo','create',null,'{"title":"agent integration","importance":"普通"}'::jsonb,'same-key','request-1','todo_create');
if r->'data'->>'id' is null then raise exception 'create failed: %',r; end if;
r2 := public.agent_mutate('todo','create',null,'{"title":"agent integration","importance":"普通"}'::jsonb,'same-key','request-2','todo_create');
if r->'data'->>'id' <> r2->'data'->>'id' then raise exception 'idempotency failed'; end if;
r2 := public.agent_mutate('todo','create',null,'{"title":"different"}'::jsonb,'same-key','request-3','todo_create');
if r2->'error'->>'code' <> 'IDEMPOTENCY_CONFLICT' then raise exception 'conflict not rejected: %',r2; end if;
if exists(select 1 from public.settings) then raise exception 'settings exposed'; end if;
if r->'data' ? 'user_id' then raise exception 'owner leaked'; end if;
r2 := public.agent_mutate('todo','update',(r->'data'->>'id')::uuid,'{"title":"updated"}',null,'update','todo_update');
if r2->'data'->>'title' <> 'updated' then raise exception 'update failed: %',r2; end if;
r2 := public.agent_mutate('todo','create',null,'{"title":"habit","kind":"habit"}',null,'habit','todo_create');
r2 := public.agent_mutate('habit_log','create',null,jsonb_build_object('todo_id',r2->'data'->>'id'),null,'habit-log','habit_log_create');
if r2->'data'->>'log_date' is null then raise exception 'habit date missing: %',r2; end if;
r2 := public.agent_mutate('finance','create',null,'{"name":"test","amount":100,"currency":"JPY","category":"其他","date":"2026-09-21"}',null,'finance','finance_create');
if (r2->'data'->>'amount_cny')::numeric <> 4.80 then raise exception 'finance conversion failed: %',r2; end if;
r2 := public.agent_mutate('finance','update',(r2->'data'->>'id')::uuid,'{"amount":200}',null,'finance-update','finance_update');
if (r2->'data'->>'amount_cny')::numeric <> 9.60 then raise exception 'finance update failed: %',r2; end if;
r2 := public.agent_mutate('todo','delete',(r->'data'->>'id')::uuid,'{}',null,'delete','todo_delete');
if r2 ? 'error' then raise exception 'delete failed: %',r2; end if;
begin
 insert into public.todos(title,user_id) values('bypass','aa000000-0000-4000-8000-000000000001');
 raise exception 'direct OAuth mutation bypassed RPC';
exception when insufficient_privilege then null; end;
begin
 update public.agent_client_access set write_enabled=false where client_id='agent-test';
 if found then raise exception 'agent modified own grant'; end if;
exception when insufficient_privilege then null; end;

end $$;
reset role;
update public.agent_client_access set revoked_at=now() where client_id='agent-test';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.agent_mutate('todo','create',null,'{"title":"revoked"}',null,'revoke','todo_create');
 if r->'error'->>'code' <> 'PERMISSION_DENIED' then raise exception 'revoked agent allowed: %',r; end if;
end $$;
reset role;
rollback;
