begin;
create or replace function public.task_business_date() returns date
language plpgsql stable security definer set search_path='' as $$
declare shift_hour integer;
begin
 if auth.uid() is null or not (public.agent_permission('read') or public.agent_permission('write')) then raise insufficient_privilege; end if;
 select day_start_hour into shift_hour from public.settings where user_id=auth.uid() order by updated_at desc limit 1;
 return (current_timestamp at time zone 'Asia/Shanghai' - make_interval(hours=>greatest(0,least(23,coalesce(shift_hour,0)))))::date;
end $$;
revoke all on function public.task_business_date() from public,anon;
grant execute on function public.task_business_date() to authenticated;

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
     body:=jsonb_build_object('log_date',public.task_business_date(),'value',1,'broken',false)||body;
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
   failed_code:=case when sqlerrm='Multiple todos have this title; use todo_id' then 'RELATION_AMBIGUOUS' when sqlerrm in ('Archived/paused todos and habits cannot be added','Add an active subtask instead of its parent','Reopen the todo before adding it to another day','Habits use habit_log, not daily tasks','Persistent todos are completed through daily tasks or habit logs') then 'TASK_NOT_ELIGIBLE' else case sqlstate when 'P0002' then 'NOT_FOUND' when '42501' then 'PERMISSION_DENIED' when '23505' then 'CONFLICT' when '23503' then 'RELATION_NOT_FOUND' else 'INVALID_INPUT' end end;
   result:=jsonb_build_object('error',jsonb_build_object('code',failed_code,'message',case failed_code when 'RELATION_AMBIGUOUS' then 'Multiple todos have this title; use todo_id' when 'TASK_NOT_ELIGIBLE' then sqlerrm when 'NOT_FOUND' then 'Record not found' when 'PERMISSION_DENIED' then 'Operation not authorized' else 'Mutation could not be applied' end));
 end;
 insert into public.agent_action_logs(user_id,client_id,tool_name,operation,record_id,request_id,idempotency_key,success,error_code)
 values(uid,cid,coalesce(p_tool_name,p_module||'_'||p_operation),p_operation,coalesce(rowdata->>'id',p_record_id::text),p_request_id,p_idempotency_key,not(result ? 'error'),result->'error'->>'code');
 update public.agent_client_access set last_used_at=now() where user_id=uid and client_id=cid;
 return result;
end $$;

commit;
