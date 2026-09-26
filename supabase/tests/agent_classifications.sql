begin;
insert into auth.users(id) values ('ac240000-0000-4000-8000-000000000001'),('ac240000-0000-4000-8000-000000000002');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled) values ('ac240000-0000-4000-8000-000000000001','class-test','integration',true,true,false);
insert into public.todos(user_id,title,category) select 'ac240000-0000-4000-8000-000000000001','task','重复' from generate_series(1,205);
insert into public.todos(user_id,title,category) values ('ac240000-0000-4000-8000-000000000001','old','稀有分类'),('ac240000-0000-4000-8000-000000000002','secret','其他用户分类');
insert into public.settings(user_id,custom_thought_tags) values ('ac240000-0000-4000-8000-000000000001','["未使用的标签"]');
select set_config('request.jwt.claims','{"sub":"ac240000-0000-4000-8000-000000000001","role":"authenticated","client_id":"class-test"}',true);
set local role authenticated;
do $$ declare r jsonb; created jsonb; module text; begin
foreach module in array array['todo','daily_task','belongings_daily','finance','pantry','belongings_durable','thought','learning_note','civil_plan','civil_wrong'] loop
 perform public.agent_classifications(module,200,0);
end loop;
r:=public.agent_classifications('todo',1,0);
if (r->>'total')::int <> 2 or not (r->>'hasMore')::boolean then raise exception 'pagination/dedup failed: %',r; end if;
if r::text like '%其他用户%' then raise exception 'cross-user vocabulary leak'; end if;
r:=public.agent_classifications('daily_task',200,0);
if r::text not like '%稀有分类%' then raise exception 'older categories omitted: %',r; end if;
r:=public.agent_classifications('thought',200,0);
if r::text not like '%未使用的标签%' then raise exception 'configured tag omitted: %',r; end if;
if exists(select 1 from public.settings) then raise exception 'raw settings exposed'; end if;
created:=public.agent_mutate('todo','create',null,'{"title":"new","category":"新分类"}');
if created ? 'error' then raise exception 'new category write failed: %',created; end if;
r:=public.agent_classifications('todo',200,0);
if r::text not like '%新分类%' then raise exception 'new category not discoverable'; end if;
begin perform public.agent_classifications('settings',200,0); raise exception 'nonallowlisted module allowed'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
update public.agent_client_access set read_enabled=false where client_id='class-test';
set local role authenticated;
do $$ begin
 begin perform public.agent_classifications('todo',200,0); raise exception 'read permission ignored'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
