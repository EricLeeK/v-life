begin;
-- This role can use authenticated RLS policies but cannot bypass them or log in.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='vlife_agent_executor') then
    create role vlife_agent_executor nologin nosuperuser nobypassrls inherit;
  end if;
end $$;
grant authenticated to vlife_agent_executor;
grant vlife_agent_executor to postgres;
create schema if not exists agent_private;
revoke all on schema agent_private from public;
grant usage on schema agent_private to vlife_agent_executor;
grant usage on schema public, auth to vlife_agent_executor;
create table if not exists agent_private.module_contracts(module text primary key, contract jsonb not null);
grant select on agent_private.module_contracts to vlife_agent_executor;

insert into agent_private.module_contracts(module,contract) values ('finance','{"table":"finance_records","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["name","amount","currency","category","date","notes","amount_cny","exchange_rate"],"createColumns":["name","amount","currency","category","date","notes"],"updateColumns":["name","amount","currency","category","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('calories','{"table":"calorie_records","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["food_name","calories","meal_type","date","notes"],"createColumns":["food_name","calories","meal_type","date","notes"],"updateColumns":["food_name","calories","meal_type","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('schedule','{"table":"schedule_events","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["title","start_time","end_time","importance","notes","status"],"createColumns":["title","start_time","end_time","importance","notes"],"updateColumns":["title","start_time","end_time","importance","status","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('todo','{"table":"todos","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["title","category","importance","detail","parent_id","kind","habit_type","habit_target","habit_unit","is_paused","is_completed"],"createColumns":["title","category","importance","detail","parent_id","kind","habit_type","habit_target","habit_unit","is_paused"],"updateColumns":["is_completed","title","importance","category","detail","kind","habit_type","habit_target","habit_unit","is_paused"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('pantry','{"table":"pantry_items","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["name","category","quantity","expiry_date","notes"],"createColumns":["name","category","quantity","expiry_date","notes"],"updateColumns":["quantity","expiry_date","category","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('thought','{"table":"thoughts","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["title","content","tags"],"createColumns":["title","content","tags"],"updateColumns":["title","content","tags"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('belongings_daily','{"table":"belongings_daily","actions":{"create":true,"delete":true},"ownsUserId":true,"readColumns":["name","category","purchase_date","notes"],"createColumns":["name","category","purchase_date","notes"],"updateColumns":["name","category","purchase_date","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('belongings_durable','{"table":"belongings_durable","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["name","category","purchase_price","purchase_date","expected_lifespan_days","notes"],"createColumns":["name","category","purchase_price","purchase_date","expected_lifespan_days","notes"],"updateColumns":["purchase_price","expected_lifespan_days","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('weight','{"table":"weight_records","actions":{"create":true,"delete":true},"ownsUserId":true,"readColumns":["weight","date","notes"],"createColumns":["weight","date","notes"],"updateColumns":["weight","date","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('measurement','{"table":"measurement_records","actions":{"create":true,"delete":true},"ownsUserId":true,"readColumns":["waist","hip","chest","arm","thigh","date","notes"],"createColumns":["waist","hip","chest","arm","thigh","date","notes"],"updateColumns":["waist","hip","chest","arm","thigh","date","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('goal','{"table":"goals","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["title","type","period_start","is_completed"],"createColumns":["title","type","period_start"],"updateColumns":["title","is_completed"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('project','{"table":"projects","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["name","description","status","priority","target_date"],"createColumns":["name","description","status","priority","target_date"],"updateColumns":["name","description","status","priority","target_date"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('project_task','{"table":"project_tasks","actions":{"create":true,"update":true,"delete":true},"ownsUserId":false,"readColumns":["project_id","title","type","status","description","due_date","weight"],"createColumns":["project_id","title","type","status","description","due_date","weight"],"updateColumns":["title","status","description","due_date","weight"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('civil_exam','{"table":"civil_exams","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["name","exam_date","exam_type","is_primary","notes","is_archived"],"createColumns":["name","exam_date","exam_type","is_primary","notes"],"updateColumns":["name","exam_date","exam_type","is_primary","is_archived","notes"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('civil_plan','{"table":"civil_plan_items","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["title","plan_date","subject_group","subject_tag","detail","start_time","end_time","source","is_completed"],"createColumns":["title","plan_date","subject_group","subject_tag","detail","start_time","end_time","source"],"updateColumns":["title","is_completed","plan_date","subject_group","subject_tag","detail","start_time","end_time"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('civil_checkin','{"table":"civil_checkins","actions":{"create":true},"ownsUserId":true,"readColumns":["studied_minutes","date","note"],"createColumns":["studied_minutes","date","note"],"updateColumns":["studied_minutes","date","note"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('civil_wrong','{"table":"civil_wrong_answers","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["title","subject_group","subject_tag","content","wrong_reason","knowledge_point","source_date","review_status","question_type","options","correct_answer","user_answer","image_required"],"createColumns":["title","subject_group","subject_tag","content","wrong_reason","knowledge_point","source_date","review_status","question_type","options","correct_answer","user_answer","image_required"],"updateColumns":["title","review_status","wrong_reason","knowledge_point","subject_tag","question_type","options","correct_answer","user_answer","image_required"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('civil_xingce_paper','{"table":"civil_xingce_papers","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["taken_date","source","is_mock","verbal_total","verbal_correct","data_total","data_correct","graphic_total","graphic_correct","logic_total","logic_correct","analogy_total","analogy_correct","quantity_total","quantity_correct","common_total","common_correct","duration_minutes","total_score","beat_rate","notes"],"createColumns":["taken_date","source","is_mock","verbal_total","verbal_correct","data_total","data_correct","graphic_total","graphic_correct","logic_total","logic_correct","analogy_total","analogy_correct","quantity_total","quantity_correct","common_total","common_correct","duration_minutes","total_score","beat_rate","notes"],"updateColumns":["source","total_score","beat_rate","notes","is_mock"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('learning_course','{"table":"learning_courses","actions":{"create":true},"ownsUserId":true,"readColumns":["name","description","color"],"createColumns":["name","description","color"],"updateColumns":["name","description","color"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('learning_note','{"table":"learning_notes","actions":{"create":true},"ownsUserId":false,"readColumns":["title","content","course_id","tags","note_date"],"createColumns":["title","content","course_id","tags","note_date"],"updateColumns":["title","content","course_id","tags","note_date"]}') on conflict(module) do update set contract=excluded.contract;
insert into agent_private.module_contracts(module,contract) values ('habit_log','{"table":"todo_habit_logs","actions":{"create":true,"delete":true},"ownsUserId":true,"readColumns":["todo_id","log_date","value","broken"],"createColumns":["todo_id","log_date","value","broken"],"updateColumns":["title","todo_id","value","broken"]}') on conflict(module) do update set contract=excluded.contract;

-- Permissions apply to direct PostgREST access as well as MCP tools.
create or replace function public.agent_permission(p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
  select case when nullif(auth.jwt()->>'client_id','') is null then true else exists(
    select 1 from public.agent_client_access a where a.user_id=auth.uid()
      and a.client_id=auth.jwt()->>'client_id' and a.revoked_at is null
      and case p_operation when 'read' then a.read_enabled when 'write' then a.write_enabled
        when 'delete' then a.delete_enabled else false end
  ) end;
$$;
revoke all on function public.agent_permission(text) from public;
grant execute on function public.agent_permission(text) to authenticated;

-- Audit/idempotency state can only be written through the executor RPC.
grant select, insert, update on public.agent_idempotency_keys to vlife_agent_executor;
grant insert on public.agent_action_logs to vlife_agent_executor;
grant select, update(last_used_at) on public.agent_client_access to vlife_agent_executor;
create policy agent_executor_idempotency on public.agent_idempotency_keys for all to vlife_agent_executor
 using(user_id=auth.uid() and client_id=auth.jwt()->>'client_id')
 with check(user_id=auth.uid() and client_id=auth.jwt()->>'client_id');
create policy agent_executor_logs on public.agent_action_logs for insert to vlife_agent_executor
 with check(user_id=auth.uid() and client_id=auth.jwt()->>'client_id');
create policy agent_executor_touch on public.agent_client_access for update to vlife_agent_executor
 using(user_id=auth.uid() and client_id=auth.jwt()->>'client_id')
 with check(user_id=auth.uid() and client_id=auth.jwt()->>'client_id');
revoke insert, update, delete on public.agent_action_logs,public.agent_idempotency_keys from authenticated,anon;

-- A narrow helper returns a rate only, never a settings row.
create or replace function public.agent_exchange_rate() returns numeric
language plpgsql security definer set search_path='' as $$
declare rate numeric;
begin
 if auth.uid() is null or not public.agent_permission('write') then raise insufficient_privilege; end if;
 select exchange_rate_jpy_to_cny into rate from public.settings where user_id=auth.uid() order by updated_at desc limit 1;
 return case when rate>0 then rate else 0.048 end;
end $$;
revoke all on function public.agent_exchange_rate() from public;
grant execute on function public.agent_exchange_rate() to authenticated;

-- Replace the unused prototype, including its caller-supplied identity arguments.
drop function if exists public.agent_mutate(uuid,text,text,text,text,text,jsonb,text,text,text,text);
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
-- Function owner remains subject to RLS. It has no service-role privileges.
grant create on schema public to vlife_agent_executor;
alter function public.agent_mutate(text,text,uuid,jsonb,text,text,text) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.agent_mutate(text,text,uuid,jsonb,text,text,text) from public;
grant execute on function public.agent_mutate(text,text,uuid,jsonb,text,text,text) to authenticated;

create or replace function public.agent_log_operation(p_tool_name text,p_operation text,p_record_id text,p_request_id text,p_success boolean,p_error_code text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or nullif(auth.jwt()->>'client_id','') is null then raise insufficient_privilege; end if;
 insert into public.agent_action_logs(user_id,client_id,tool_name,operation,record_id,request_id,success,error_code)
 values(auth.uid(),auth.jwt()->>'client_id',left(p_tool_name,150),left(p_operation,30),p_record_id,p_request_id,p_success,left(p_error_code,80));
 update public.agent_client_access set last_used_at=now() where user_id=auth.uid() and client_id=auth.jwt()->>'client_id';
end $$;
grant create on schema public to vlife_agent_executor;
alter function public.agent_log_operation(text,text,text,text,boolean,text) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.agent_log_operation(text,text,text,text,boolean,text) from public;
grant execute on function public.agent_log_operation(text,text,text,text,boolean,text) to authenticated;
-- New private tables require an explicit contract before OAuth access is enabled.
do $$ declare t record; known boolean; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in('agent_client_access','agent_action_logs','agent_idempotency_keys') loop
  select exists(select 1 from agent_private.module_contracts where contract->>'table'=t.tablename) into known;
  execute format('create policy agent_read_boundary on public.%I as restrictive for select to authenticated using (nullif(auth.jwt()->>''client_id'','''') is null or (%L and (public.agent_permission(''read'') or (current_user=''vlife_agent_executor'' and (public.agent_permission(''write'') or public.agent_permission(''delete''))))))',t.tablename,known);
  execute format('create policy agent_insert_boundary on public.%I as restrictive for insert to authenticated with check (nullif(auth.jwt()->>''client_id'','''') is null or (%L and current_user=''vlife_agent_executor'' and public.agent_permission(''write'')))',t.tablename,known);
  execute format('create policy agent_update_boundary on public.%I as restrictive for update to authenticated using (nullif(auth.jwt()->>''client_id'','''') is null or (%L and current_user=''vlife_agent_executor'' and public.agent_permission(''write''))) with check (nullif(auth.jwt()->>''client_id'','''') is null or (%L and current_user=''vlife_agent_executor'' and public.agent_permission(''write'')))',t.tablename,known,known);
  execute format('create policy agent_delete_boundary on public.%I as restrictive for delete to authenticated using (nullif(auth.jwt()->>''client_id'','''') is null or (%L and current_user=''vlife_agent_executor'' and public.agent_permission(''delete'')))',t.tablename,known);
 end loop;
end $$;

-- Supabase default privileges grant anon explicitly, not only through PUBLIC.
revoke all on function public.agent_permission(text) from anon;
revoke all on function public.agent_exchange_rate() from anon;
revoke all on function public.agent_mutate(text,text,uuid,jsonb,text,text,text) from anon;
revoke all on function public.agent_log_operation(text,text,text,text,boolean,text) from anon;

commit;
