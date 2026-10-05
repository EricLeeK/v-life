begin;

create or replace function agent_private.resolve_task_date(value text, business_date date) returns date
language plpgsql immutable set search_path='' as $$
declare resolved date;
begin
  if value='today' then return business_date;
  elsif value='tomorrow' then return business_date+1;
  elsif value='yesterday' then return business_date-1;
  end if;
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then raise invalid_parameter_value using message='Use today, tomorrow, yesterday or YYYY-MM-DD'; end if;
  resolved:=value::date;
  if resolved::text<>value or resolved<'1900-01-01'::date then raise invalid_parameter_value using message='Invalid task date'; end if;
  return resolved;
end $$;
revoke all on function agent_private.resolve_task_date(text,date) from public,anon,authenticated;
grant execute on function agent_private.resolve_task_date(text,date) to vlife_agent_executor;

create or replace function agent_private.task_transfer_reason(task public.todos, daily public.daily_tasks, target_date date) returns text
language sql stable set search_path='' as $$
  select case
    when daily.is_completed or task.is_completed then 'completed'
    when task.is_archived then 'archived'
    when task.is_paused then 'paused'
    when task.kind='habit' then 'habit_uses_habit_log'
    when task.parent_id is null and exists(select 1 from public.todos c where c.parent_id=task.id and c.user_id=task.user_id and not c.is_completed and not c.is_archived) then 'select_executable_subtask'
    when exists(select 1 from public.daily_tasks d where d.todo_id=task.id and d.user_id=task.user_id and d.task_date=target_date and d.id<>daily.id and d.is_completed) then 'target_already_completed'
    else null end;
$$;
revoke all on function agent_private.task_transfer_reason(public.todos,public.daily_tasks,date) from public,anon,authenticated;
grant execute on function agent_private.task_transfer_reason(public.todos,public.daily_tasks,date) to vlife_agent_executor;

-- One snapshot, joined titles and explicit IDs. Never silently return a partial list.
create or replace function public.daily_task_overview(p_date text default 'today',p_lookback_days integer default 3) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); day date; business_day date; rows jsonb; planned jsonb; backlog jsonb;
begin
  if uid is null or not public.agent_permission('read') then
    return jsonb_build_object('error',jsonb_build_object('code','PERMISSION_DENIED','message','Read permission required'));
  end if;
  if p_lookback_days is null or p_lookback_days<0 or p_lookback_days>30 then raise invalid_parameter_value using message='lookback_days must be 0..30'; end if;
  business_day:=public.task_business_date();
  day:=agent_private.resolve_task_date(p_date,business_day);
  select coalesce(jsonb_agg(item order by task_date desc,id),'[]') into rows from (
    select d.task_date,d.id,jsonb_build_object(
      'daily_task_id',d.id,'todo_id',t.id,'title',t.title,'kind',t.kind,'category',t.category,
      'task_date',d.task_date,'is_completed',d.is_completed,'completed_at',d.completed_at,
      'can_transfer',agent_private.task_transfer_reason(t,d,day) is null,
      'blocked_reason',agent_private.task_transfer_reason(t,d,day)
    ) item
    from public.daily_tasks d join public.todos t on t.id=d.todo_id and t.user_id=uid
    where d.user_id=uid and (d.task_date=day or (d.task_date>=day-p_lookback_days and d.task_date<day and d.is_completed=false and not coalesce(t.is_archived,false)))
    order by d.task_date desc,d.id limit 501
  ) matched;
  if jsonb_array_length(rows)>500 then
    return jsonb_build_object('error',jsonb_build_object('code','RESULT_TOO_LARGE','message','More than 500 records. Reduce lookback_days or use daily_task_list with explicit pagination. No partial overview returned.'));
  end if;
  select coalesce(jsonb_agg(item),'[]') into planned from jsonb_array_elements(rows) item where item->>'task_date'=day::text;
  select coalesce(jsonb_agg(item),'[]') into backlog from jsonb_array_elements(rows) item where item->>'task_date'<day::text;
  return jsonb_build_object('data',jsonb_build_object(
    'business_date',business_day,'date',day,'timezone','Asia/Shanghai','complete',true,
    'backlog_from',day-p_lookback_days,'backlog_to',day-1,
    'tasks',planned,'backlog',backlog,'task_count',jsonb_array_length(planned),'backlog_count',jsonb_array_length(backlog),
    'completion_semantics','For once tasks, completion synchronizes all linked dates. task_date is the planned date; completed_at is the actual completion time. Retained rows are not immutable history.'
  ));
exception when invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then
  return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT','message','Invalid date or lookback_days'));
end $$;

-- A move requires the same delete grant as removing an old daily record. No privilege bypass.
create or replace function public.daily_task_transfer(
  p_daily_task_ids uuid[],p_target_date text,p_mode text,p_idempotency_key text,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); cid text:=auth.jwt()->>'client_id'; day date; business_day date;
  selected_ids uuid[]; fingerprint text; previous jsonb; old_hash text; result jsonb;
  source record; target jsonb; reason text; items jsonb:='[]'; created_count int:=0; removed_count int:=0; unchanged_count int:=0;
  failed_code text;
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
      else
        target:=agent_private.daily_task_apply('create',null,jsonb_build_object(
          'todo_id',(source.daily).todo_id,'task_date',day,
          'difficulty',coalesce((source.daily).difficulty,'medium'),'base_points',coalesce((source.daily).base_points,20),'metadata',coalesce((source.daily).metadata,'{}')
        ));
        if (target->>'_created')::boolean then created_count:=created_count+1; end if;
        if p_mode='move' then
          perform agent_private.daily_task_apply('delete',(source.daily).id,'{}');
          removed_count:=removed_count+1;
        end if;
      end if;
      items:=items||jsonb_build_array(jsonb_build_object(
        'source_daily_task_id',(source.daily).id,'source_date',(source.daily).task_date,
        'target_daily_task_id',target->>'id','target_date',day,'todo_id',(source.task).id,'title',(source.task).title,
        'outcome',case when (source.daily).task_date=day then 'already_on_target' when p_mode='move' then 'moved' else 'copied' end,
        'target_created',(target->>'_created')::boolean,
        'source_removed',p_mode='move' and (source.daily).task_date<>day
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
      'completion_semantics','Copy retains the old arrangement, not an immutable completion snapshot. Completing a once task synchronizes every linked date.'
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
alter function public.daily_task_overview(text,integer) owner to vlife_agent_executor;
alter function public.daily_task_transfer(uuid[],text,text,text,text) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.daily_task_overview(text,integer) from public,anon;
revoke all on function public.daily_task_transfer(uuid[],text,text,text,text) from public,anon;
grant execute on function public.daily_task_overview(text,integer) to authenticated;
grant execute on function public.daily_task_transfer(uuid[],text,text,text,text) to authenticated;

commit;
