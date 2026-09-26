begin;
insert into auth.users(id) values ('ae240000-0000-4000-8000-000000000001');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled) values ('ae240000-0000-4000-8000-000000000001','onboarding-test','integration',true,false,false);
select set_config('request.jwt.claims','{"sub":"ae240000-0000-4000-8000-000000000001","role":"authenticated","client_id":"onboarding-test"}',true);
set local role authenticated;
do $$ begin
 if public.task_business_date() is null then raise exception 'read-only agent cannot resolve today'; end if;
end $$;
reset role;
update public.agent_client_access set write_enabled=true where client_id='onboarding-test';
set local role authenticated;
do $$ declare r jsonb; tid uuid; begin
r:=public.agent_mutate('todo','create',null,'{"title":"ambiguous task"}');
r:=public.agent_mutate('todo','create',null,'{"title":"ambiguous task"}');
r:=public.agent_mutate('daily_task','create',null,'{"title":"ambiguous task"}');
if r->'error'->>'code' is distinct from 'RELATION_AMBIGUOUS' then raise exception 'ambiguous title lacks recovery code: %',r; end if;
r:=public.agent_mutate('todo','create',null,'{"title":"paused","kind":"routine","is_paused":true}');
r:=public.agent_mutate('daily_task','create',null,jsonb_build_object('todo_id',r->'data'->>'id'));
if r->'error'->>'code' is distinct from 'TASK_NOT_ELIGIBLE' then raise exception 'paused task lacks recovery code: %',r; end if;
r:=public.agent_mutate('todo','create',null,'{"title":"habit","kind":"habit"}');
tid:=(r->'data'->>'id')::uuid;
r:=public.agent_mutate('habit_log','create',null,jsonb_build_object('todo_id',tid));
if r->'data'->>'log_date' is distinct from public.task_business_date()::text then raise exception 'habit date differs from business date: %',r; end if;
end $$;
reset role;
rollback;
