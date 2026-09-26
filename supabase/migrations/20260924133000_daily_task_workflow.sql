begin;
-- A narrow, authenticated date helper: agents use Shanghai plus the user's day boundary.
create or replace function public.task_business_date() returns date
language plpgsql stable security definer set search_path='' as $$
declare shift_hour integer;
begin
 if auth.uid() is null or not public.agent_permission('write') then raise insufficient_privilege; end if;
 select day_start_hour into shift_hour from public.settings where user_id=auth.uid() order by updated_at desc limit 1;
 return (current_timestamp at time zone 'Asia/Shanghai' - make_interval(hours=>greatest(0,least(23,coalesce(shift_hour,0)))))::date;
end $$;
revoke all on function public.task_business_date() from public,anon;
grant execute on function public.task_business_date() to authenticated;

-- Both UI and OAuth call this domain operation. The enclosing RPC owns authorization,
-- auditing and idempotency. This helper is not callable through PostgREST.
create or replace function agent_private.daily_task_apply(op text, rid uuid, body jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare uid uuid:=auth.uid(); task public.todos; daily public.daily_tasks; matches uuid[];
 day date; task_title text; allowed text[]; todo_created boolean:=false;
begin
 if uid is null then raise insufficient_privilege; end if;
 if op not in ('create','update','delete') then raise exception using errcode='22023',message='Unsupported operation'; end if;
 allowed:=case op when 'create' then array['todo_id','title','kind','category','importance','detail','task_date','difficulty','base_points','metadata','complete'] when 'update' then array['is_completed','base_points','metadata'] else array[]::text[] end;
 if jsonb_typeof(body) is distinct from 'object' or exists(select 1 from jsonb_object_keys(body) k where not(k=any(allowed))) then raise exception using errcode='22023',message='Unsupported task fields'; end if;
 -- Serialize title lookup/creation for each user. Existing IDs then lock mother before child.
 if op='create' then
   perform pg_advisory_xact_lock(hashtextextended('daily-add:'||uid::text,0));
   day:=coalesce((body->>'task_date')::date,public.task_business_date());
   if body ? 'todo_id' then
     select * into task from public.todos where id=(body->>'todo_id')::uuid and user_id=uid for update;
     if task.id is null then raise no_data_found; end if;
   else
     task_title:=btrim(body->>'title');
     if coalesce(task_title,'')='' then raise exception using errcode='22023',message='Provide todo_id or title'; end if;
     select array_agg(id) into matches from public.todos where user_id=uid and title=task_title and not is_archived and not is_completed;
     if cardinality(matches)>1 then raise exception using errcode='22023',message='Multiple todos have this title; use todo_id'; end if;
     if cardinality(matches)=1 then
       select * into task from public.todos where id=matches[1] and user_id=uid for update;
     else
       if coalesce(body->>'kind','once') not in ('once','routine') then raise exception using errcode='22023',message='Habits use habit_log, not daily tasks'; end if;
       todo_created:=true;
       insert into public.todos(user_id,title,kind,category,importance,detail)
       values(uid,task_title,coalesce(body->>'kind','once'),coalesce(body->>'category','未分类'),coalesce(body->>'importance','普通'),body->>'detail') returning * into task;
     end if;
   end if;
   if task.kind='habit' or task.is_archived or task.is_paused then raise exception using errcode='22023',message='Archived/paused todos and habits cannot be added'; end if;
   -- A repeat request must return the original daily row, even if it was completed.
   select * into daily from public.daily_tasks where user_id=uid and todo_id=task.id and task_date=day;
   if daily.id is not null then
     if body->'complete'='true'::jsonb then
       update public.daily_tasks set is_completed=true where id=daily.id returning * into daily;
     end if;
     return to_jsonb(daily)||jsonb_build_object('_created',false,'_todo_created',false);
   end if;
   if task.parent_id is null and exists(select 1 from public.todos where parent_id=task.id and user_id=uid and not is_completed and not is_archived) then raise exception using errcode='22023',message='Add an active subtask instead of its parent'; end if;
   if task.is_completed then raise exception using errcode='22023',message='Reopen the todo before adding it to another day'; end if;
   if body ? 'base_points' and ((body->>'base_points')::integer < 0 or (body->>'base_points')::integer > 10000) then raise exception using errcode='22023',message='Invalid points'; end if;
   if body ? 'metadata' and jsonb_typeof(body->'metadata') is distinct from 'object' then raise exception using errcode='22023',message='Invalid metadata'; end if;
   insert into public.daily_tasks(user_id,todo_id,task_date,difficulty,base_points,metadata)
   values(uid,task.id,day,coalesce(body->>'difficulty','medium'),coalesce((body->>'base_points')::integer,20),coalesce(body->'metadata','{}')) returning * into daily;
   if body->'complete'='true'::jsonb then
     update public.daily_tasks set is_completed=true where id=daily.id returning * into daily;
   end if;
   return to_jsonb(daily)||jsonb_build_object('_created',true,'_todo_created',todo_created);
 elsif op in ('update','delete') then
   select * into daily from public.daily_tasks where id=rid and user_id=uid;
   if daily.id is null then raise no_data_found; end if;
   if op='update' then
     perform 1 from public.todos where id=daily.todo_id and user_id=uid for update;
     if not found then raise no_data_found; end if;
   end if;
   if op='delete' then
     delete from public.daily_tasks where id=rid and user_id=uid returning * into daily;
   else
     if body='{}' or (body ? 'is_completed' and jsonb_typeof(body->'is_completed') is distinct from 'boolean') then raise exception using errcode='22023',message='Invalid completion state'; end if;
     if body ? 'base_points' and ((body->>'base_points')::integer < 0 or (body->>'base_points')::integer > 10000) then raise exception using errcode='22023',message='Invalid points'; end if;
     if body ? 'metadata' and jsonb_typeof(body->'metadata') is distinct from 'object' then raise exception using errcode='22023',message='Invalid metadata'; end if;
     update public.daily_tasks set
       is_completed=case when body ? 'is_completed' then (body->>'is_completed')::boolean else is_completed end,
       base_points=case when body ? 'base_points' then (body->>'base_points')::integer else base_points end,
       metadata=case when body ? 'metadata' then body->'metadata' else metadata end
     where id=rid and user_id=uid returning * into daily;
   end if;
 end if;
 if daily.id is null then raise no_data_found; end if;
 return to_jsonb(daily);
end $$;
revoke all on function agent_private.daily_task_apply(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function agent_private.daily_task_apply(text,uuid,jsonb) to vlife_agent_executor;

create or replace function public.daily_task_mutate(p_operation text,p_record_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or nullif(auth.jwt()->>'client_id','') is not null then raise insufficient_privilege; end if;
 return jsonb_build_object('data',agent_private.daily_task_apply(p_operation,p_record_id,p_payload)-'user_id');
end $$;
grant create on schema public to vlife_agent_executor;
alter function public.daily_task_mutate(text,uuid,jsonb) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.daily_task_mutate(text,uuid,jsonb) from public,anon;
grant execute on function public.daily_task_mutate(text,uuid,jsonb) to authenticated;

-- Completion lives in the database so old UI clients and todo_update share the invariant.
create or replace function public.sync_todo_completion() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.is_completed and new.kind in ('habit','routine') then raise exception using errcode='22023',message='Persistent todos are completed through daily tasks or habit logs'; end if;
 if new.kind='once' then
   update public.daily_tasks set is_completed=new.is_completed where todo_id=new.id and user_id=new.user_id and is_completed is distinct from new.is_completed;
 end if;
 return new;
end $$;
create trigger sync_todo_completion after update of is_completed on public.todos for each row execute function public.sync_todo_completion();
create or replace function public.sync_daily_completion() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.is_completed is not null then
   update public.todos set is_completed=new.is_completed where id=new.todo_id and user_id=new.user_id and kind='once' and is_completed is distinct from new.is_completed;
 end if;
 return new;
end $$;
create trigger sync_daily_completion after update of is_completed on public.daily_tasks for each row execute function public.sync_daily_completion();
create or replace function public.daily_completion_timestamp() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.is_completed then new.completed_at:=case when old.is_completed then coalesce(old.completed_at,now()) else now() end;
 else new.completed_at:=null; end if;
 return new;
end $$;
create trigger daily_completion_timestamp before update of is_completed on public.daily_tasks for each row execute function public.daily_completion_timestamp();

-- Open daily reads and executor-only writes, preserving ownership policies.
drop policy agent_read_boundary on public.daily_tasks;
drop policy agent_insert_boundary on public.daily_tasks;
drop policy agent_update_boundary on public.daily_tasks;
drop policy agent_delete_boundary on public.daily_tasks;
create policy agent_read_boundary on public.daily_tasks as restrictive for select to authenticated using (nullif(auth.jwt()->>'client_id','') is null or public.agent_permission('read') or (current_user='vlife_agent_executor' and (public.agent_permission('write') or public.agent_permission('delete'))));
create policy agent_insert_boundary on public.daily_tasks as restrictive for insert to authenticated with check (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('write')));
create policy agent_update_boundary on public.daily_tasks as restrictive for update to authenticated using (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('write'))) with check (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('write')));
create policy agent_delete_boundary on public.daily_tasks as restrictive for delete to authenticated using (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('delete')));

create or replace function public.agent_mutate(
 p_module text, p_operation text, p_record_id uuid default null, p_payload jsonb default '{}'::jsonb,
 p_idempotency_key text default null,p_request_id text default null,p_tool_name text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); cid text:=auth.jwt()->>'client_id'; c jsonb; tbl text; cols text; vals text;
 body jsonb:=coalesce(p_payload,'{}'::jsonb); result jsonb; rowdata jsonb; previous jsonb;
 fingerprint text; old_hash text; allowed text[]; proj text[]; rate numeric; field text;
 existing jsonb; failed_code text; affected bigint;
begin
 if uid is null or nullif(cid,'') is null then return jsonb_build_object('error',jsonb_build_object('code','UNAUTHORIZED','message','OAuth identity required')); end if;
 -- Locks serialize grant revocation against an already executing mutation.
 perform 1 from public.agent_client_access where user_id=uid and client_id=cid and revoked_at is null for share;
 if not found or not public.agent_permission(case when p_operation='delete' then 'delete' else 'write' end) then
   return jsonb_build_object('error',jsonb_build_object('code','PERMISSION_DENIED','message','Agent operation is not authorized'));
 end if;
 select contract into c from agent_private.module_contracts where module=p_module;
 if c is null or not coalesce((c->'actions'->>p_operation)::boolean,false) then
   return jsonb_build_object('error',jsonb_build_object('code','ACTION_NOT_ALLOWED','message','Unsupported module operation'));
 end if;
 tbl:=c->>'table';
 select array_agg(value) into allowed from jsonb_array_elements_text(c->case when p_operation='create' then 'createColumns' else 'updateColumns' end);
 select array_agg(value) into proj from jsonb_array_elements_text(c->'readColumns');
 if jsonb_typeof(body)<>'object' or exists(select 1 from jsonb_object_keys(body) k where not(k=any(coalesce(allowed,'{}')))) then
   return jsonb_build_object('error',jsonb_build_object('code','FIELD_NOT_ALLOWED','message','Payload contains fields outside the data contract'));
 end if;
 if p_operation not in ('create','update','delete') or (p_operation<>'create' and p_record_id is null) then
   return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT','message','Invalid mutation'));
 end if;
 if p_idempotency_key is not null and (length(p_idempotency_key)=0 or length(p_idempotency_key)>200) then
   return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT','message','Idempotency key must contain 1 to 200 characters'));
 end if;
 fingerprint:=md5(jsonb_build_object('module',p_module,'operation',p_operation,'id',p_record_id,'payload',body)::text);
 if p_idempotency_key is not null then
   perform pg_advisory_xact_lock(hashtextextended(uid::text||cid||p_idempotency_key,0));
   select payload_hash,response into old_hash,previous from public.agent_idempotency_keys where user_id=uid and client_id=cid and idempotency_key=p_idempotency_key;
   if found then
     if old_hash<>fingerprint then return jsonb_build_object('error',jsonb_build_object('code','IDEMPOTENCY_CONFLICT','message','Use a different key for a different operation')); end if;
     return previous;
   end if;
 end if;
 begin
   -- RLS checks ownership for both existing rows and relation targets.
   if body ? 'project_id' and not exists(select 1 from public.projects where id=(body->>'project_id')::uuid and user_id=uid) then raise exception using errcode='42501',message='Relation is not owned by user'; end if;
   if body ? 'course_id' and not exists(select 1 from public.learning_courses where id=(body->>'course_id')::uuid and user_id=uid) then raise exception using errcode='42501',message='Relation is not owned by user'; end if;
   if (body ? 'todo_id' or body ? 'parent_id') and not exists(select 1 from public.todos where id=coalesce(body->>'todo_id',body->>'parent_id')::uuid and user_id=uid) then raise exception using errcode='42501',message='Relation is not owned by user'; end if;
   if p_module='habit_log' and p_operation='create' then
     if not exists(select 1 from public.todos where id=(body->>'todo_id')::uuid and user_id=uid and kind='habit') then raise exception using errcode='42501',message='Habit not found'; end if;
     body:=jsonb_build_object('log_date',current_date,'value',1,'broken',false)||body;
   end if;
   if p_module='finance' then
     if p_operation='update' then
       select to_jsonb(f) into existing from public.finance_records f where id=p_record_id for update;
       if existing is null then raise no_data_found; end if;
     end if;
     if p_operation='create' or body ? 'amount' or body ? 'currency' then
       existing:=coalesce(existing,'{}')||body;
       rate:=case when existing->>'currency'='JPY' then public.agent_exchange_rate() else 1 end;
       body:=body||jsonb_build_object('exchange_rate',rate,'amount_cny',round((existing->>'amount')::numeric*rate,2));
     end if;
   end if;
   if p_module='daily_task' then
     rowdata:=agent_private.daily_task_apply(p_operation,p_record_id,body);
   else
   if p_operation='create' and coalesce((c->>'ownsUserId')::boolean,true) then body:=body||jsonb_build_object('user_id',uid); end if;
   if p_operation='delete' then
     execute format('delete from public.%I where id=$1 returning to_jsonb(%I.*)',tbl,tbl) into rowdata using p_record_id;
   else
     select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into cols,vals from jsonb_object_keys(body) k;
     if cols is null then raise exception using errcode='22023',message='Empty mutation'; end if;
     if p_operation='create' then
       execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r %s returning to_jsonb(%I.*)',
         tbl,cols,vals,tbl,case when p_module='habit_log' then 'on conflict(todo_id,log_date) do update set value=excluded.value,broken=excluded.broken' else '' end,tbl) into rowdata using body;
     else
       execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) r) where id=$2 returning to_jsonb(%I.*)',tbl,cols,vals,tbl,tbl) into rowdata using body,p_record_id;
     end if;
   end if;
   end if;
   if rowdata is null then raise no_data_found; end if;
   select jsonb_object_agg(key,value) into result from jsonb_each(rowdata) where key='id' or (p_operation<>'delete' and key=any(proj));
   result:=jsonb_build_object('data',coalesce(result,'{}'));
   if p_idempotency_key is not null then insert into public.agent_idempotency_keys(user_id,client_id,idempotency_key,payload_hash,response) values(uid,cid,p_idempotency_key,fingerprint,result); end if;
 exception when others then
   failed_code:=case sqlstate when 'P0002' then 'NOT_FOUND' when '42501' then 'PERMISSION_DENIED' when '23505' then 'CONFLICT' when '23503' then 'RELATION_NOT_FOUND' else 'INVALID_INPUT' end;
   result:=jsonb_build_object('error',jsonb_build_object('code',failed_code,'message',case failed_code when 'NOT_FOUND' then 'Record not found' when 'PERMISSION_DENIED' then 'Operation not authorized' else 'Mutation could not be applied' end));
 end;
 insert into public.agent_action_logs(user_id,client_id,tool_name,operation,record_id,request_id,idempotency_key,success,error_code)
 values(uid,cid,coalesce(p_tool_name,p_module||'_'||p_operation),p_operation,coalesce(rowdata->>'id',p_record_id::text),p_request_id,p_idempotency_key,not(result ? 'error'),result->'error'->>'code');
 update public.agent_client_access set last_used_at=now() where user_id=uid and client_id=cid;
 return result;
end $$;
insert into agent_private.module_contracts(module,contract) values ('daily_task','{"table":"daily_tasks","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["todo_id","task_date","difficulty","base_points","is_completed","completed_at"],"createColumns":["todo_id","title","kind","category","importance","detail","task_date"],"updateColumns":["is_completed"]}') on conflict(module) do update set contract=excluded.contract;

commit;
