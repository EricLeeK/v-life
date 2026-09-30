-- An incomplete once task lives on one date. Scheduling it again removes the
-- other open daily rows. Completed rows and routines stay, one row per day.

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
     if task.kind='once' and daily.is_completed is not true then
       delete from public.daily_tasks where user_id=uid and todo_id=task.id and is_completed is not true and id<>daily.id;
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
   if task.kind='once' and daily.is_completed is not true then
     delete from public.daily_tasks where user_id=uid and todo_id=task.id and is_completed is not true and id<>daily.id;
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

-- Scheduling an open once task already removes the previous open day. Move must
-- tolerate that, and copy of a once task reports moved instead of failing.
create or replace function public.daily_task_transfer(p_daily_task_ids uuid[], p_target_date text, p_mode text, p_idempotency_key text, p_request_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); cid text:=auth.jwt()->>'client_id'; day date; business_day date;
  selected_ids uuid[]; fingerprint text; previous jsonb; old_hash text; result jsonb;
  source record; target jsonb; reason text; items jsonb:='[]'; created_count int:=0; removed_count int:=0; unchanged_count int:=0;
  failed_code text; source_exists boolean;
begin
  if uid is null or nullif(cid,'') is null then
    return jsonb_build_object('error',jsonb_build_object('code','PERMISSION_DENIED','message','OAuth identity required'));
  end if;
  perform 1 from public.agent_client_access where user_id=uid and client_id=cid and revoked_at is null for share;
  if not found or not public.agent_permission('read') or not public.agent_permission('write') or (p_mode='move' and not public.agent_permission('delete')) then
    return jsonb_build_object('error',jsonb_build_object('code','PERMISSION_DENIED','message','Read and write required; move also requires delete permission'));
  end if;
  if p_mode is null or p_mode not in ('move','copy') or p_daily_task_ids is null or cardinality(p_daily_task_ids) not between 1 and 200 or array_position(p_daily_task_ids,null) is not null
    or p_idempotency_key is null or length(btrim(p_idempotency_key))=0 or length(p_idempotency_key)>200 then
    return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT','message','Provide 1..200 unique daily_task IDs, explicit move/copy and a stable idempotency key'));
  end if;
  select array_agg(distinct id order by id) into selected_ids from unnest(p_daily_task_ids) id;
  if cardinality(selected_ids)<>cardinality(p_daily_task_ids) then
    return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT','message','Source IDs must be unique'));
  end if;
  fingerprint:=md5(jsonb_build_object('workflow','daily_task_transfer','ids',selected_ids,'target',p_target_date,'mode',p_mode)::text);
  -- Replay before resolving today/tomorrow or looking for source rows removed by the first call.
  perform pg_advisory_xact_lock(hashtextextended(uid::text||cid||p_idempotency_key,0));
  select payload_hash,response into old_hash,previous from public.agent_idempotency_keys where user_id=uid and client_id=cid and idempotency_key=p_idempotency_key;
  if found then
    if old_hash<>fingerprint then return jsonb_build_object('error',jsonb_build_object('code','IDEMPOTENCY_CONFLICT','message','This key belongs to different arguments; preserve original arguments for retries')); end if;
    return previous||jsonb_build_object('replayed',true);
  end if;
  begin
    business_day:=public.task_business_date();
    day:=agent_private.resolve_task_date(p_target_date,business_day);
    -- Same lock as daily_task_apply prevents concurrent inserts for the same target day.
    perform pg_advisory_xact_lock(hashtextextended('daily-add:'||uid::text,0));
    perform t.id from public.todos t where t.user_id=uid and t.id in (
      select d.todo_id from public.daily_tasks d where d.user_id=uid and d.id=any(selected_ids)
    ) order by t.id for update;
    perform d.id from public.daily_tasks d where d.user_id=uid and (d.id=any(selected_ids) or (d.task_date=day and d.todo_id in (
      select s.todo_id from public.daily_tasks s where s.user_id=uid and s.id=any(selected_ids)
    ))) order by d.id for update;
    if (select count(*) from public.daily_tasks where user_id=uid and id=any(selected_ids))<>cardinality(selected_ids) then raise no_data_found; end if;
    for source in
      select d as daily,t as task from public.daily_tasks d join public.todos t on t.id=d.todo_id and t.user_id=uid
      where d.user_id=uid and d.id=any(selected_ids) order by d.task_date desc,d.id
    loop
      reason:=agent_private.task_transfer_reason(source.task,source.daily,day);
      if reason is not null then raise exception using errcode='P0001',message='Source '||(source.daily).id::text||' cannot be transferred: '||reason; end if;
      if (source.daily).task_date=day then
        target:=to_jsonb(source.daily)||jsonb_build_object('_created',false);
        unchanged_count:=unchanged_count+1;
        source_exists:=true;
      else
        target:=agent_private.daily_task_apply('create',null,jsonb_build_object(
          'todo_id',(source.daily).todo_id,'task_date',day,
          'difficulty',coalesce((source.daily).difficulty,'medium'),'base_points',coalesce((source.daily).base_points,20),'metadata',coalesce((source.daily).metadata,'{}')
        ));
        if (target->>'_created')::boolean then created_count:=created_count+1; end if;
        if p_mode='move' and exists(select 1 from public.daily_tasks where user_id=uid and id=(source.daily).id) then
          perform agent_private.daily_task_apply('delete',(source.daily).id,'{}');
        end if;
        source_exists:=exists(select 1 from public.daily_tasks where user_id=uid and id=(source.daily).id);
        if not source_exists then removed_count:=removed_count+1; end if;
      end if;
      items:=items||jsonb_build_array(jsonb_build_object(
        'source_daily_task_id',(source.daily).id,'source_date',(source.daily).task_date,
        'target_daily_task_id',target->>'id','target_date',day,'todo_id',(source.task).id,'title',(source.task).title,
        'outcome',case when (source.daily).task_date=day then 'already_on_target' when not source_exists then 'moved' else 'copied' end,
        'target_created',(target->>'_created')::boolean,
        'source_removed',(source.daily).task_date<>day and not source_exists
      ));
    end loop;
    -- Verify the postconditions inside the same transaction; transport success cannot hide partial work.
    if exists(select 1 from jsonb_array_elements(items) item where not exists(
      select 1 from public.daily_tasks d where d.user_id=uid and d.id=(item->>'target_daily_task_id')::uuid and d.todo_id=(item->>'todo_id')::uuid and d.task_date=day
    ) or ((item->>'source_removed')::boolean and exists(select 1 from public.daily_tasks d where d.user_id=uid and d.id=(item->>'source_daily_task_id')::uuid))) then
      raise exception using errcode='40001',message='Task transfer postcondition failed';
    end if;
    result:=jsonb_build_object('replayed',false,'data',jsonb_build_object(
      'mode',p_mode,'business_date',business_day,'target_date',day,'verified_at',statement_timestamp(),
      'source_count',cardinality(selected_ids),'target_count',(select count(distinct item->>'target_daily_task_id') from jsonb_array_elements(items) item),
      'created_count',created_count,'removed_count',removed_count,'unchanged_count',unchanged_count,'items',items,
      'completion_semantics','An incomplete once task stays on one date. Scheduling it again removes the other open days. Completed rows remain. A routine keeps each day. Completing a once task synchronizes its remaining rows.'
    ));
    insert into public.agent_idempotency_keys(user_id,client_id,idempotency_key,payload_hash,response) values(uid,cid,p_idempotency_key,fingerprint,result);
  exception when others then
    failed_code:=case sqlstate when 'P0002' then 'NOT_FOUND' when 'P0001' then 'TASK_NOT_ELIGIBLE' when '42501' then 'PERMISSION_DENIED' when '23505' then 'CONFLICT' when '22023' then 'INVALID_INPUT' when '22007' then 'INVALID_INPUT' when '22008' then 'INVALID_INPUT' else 'DATABASE_ERROR' end;
    result:=jsonb_build_object('error',jsonb_build_object('code',failed_code,'message',case when failed_code='TASK_NOT_ELIGIBLE' then sqlerrm when failed_code='NOT_FOUND' then 'A source task no longer exists or is not accessible. Refresh the overview.' else 'No tasks transferred. Check arguments, permissions or refresh the overview; preserve the retry key.' end));
  end;
  insert into public.agent_action_logs(user_id,client_id,tool_name,operation,request_id,idempotency_key,success,error_code)
  values(uid,cid,'daily_task_transfer','update',p_request_id,p_idempotency_key,not(result ? 'error'),result->'error'->>'code');
  update public.agent_client_access set last_used_at=now() where user_id=uid and client_id=cid;
  return result;
end $$;
grant create on schema public to vlife_agent_executor;
alter function public.daily_task_transfer(uuid[],text,text,text,text) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.daily_task_transfer(uuid[],text,text,text,text) from public,anon;
grant execute on function public.daily_task_transfer(uuid[],text,text,text,text) to authenticated;

-- Keep the latest open date for each once task. Completed history stays.
delete from public.daily_tasks d
using public.todos t
where d.todo_id=t.id
  and t.kind='once'
  and d.is_completed is not true
  and exists (
    select 1 from public.daily_tasks newer
    where newer.user_id=d.user_id and newer.todo_id=d.todo_id
      and newer.is_completed is not true and newer.task_date>d.task_date
  );
