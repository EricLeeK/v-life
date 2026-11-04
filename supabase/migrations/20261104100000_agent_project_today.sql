begin;
-- Resolve against owned cards. A preview and its later write can be pinned to the same ID.
create function public.agent_project_today(p_title text, p_project_name text default null,
  p_task_id uuid default null, p_apply boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  matches jsonb; card jsonb; day date; previous_day date; receipt text;
begin
  if auth.uid() is null or not public.agent_permission('read')
    or (p_apply and not public.agent_permission('write')) then raise insufficient_privilege; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Task title required'; end if;
  day := public.task_business_date();
  with candidates as (
    select t.id, t.title, p.id as project_id, p.name as project_name,
      lower(trim(t.title)) = lower(trim(p_title)) as exact
    from public.project_tasks t join public.projects p on p.id=t.project_id
    where p.user_id=auth.uid() and t.type='task' and t.status<>'done'
      and (p_task_id is null or t.id=p_task_id)
      and (p_project_name is null or lower(trim(p.name))=lower(trim(p_project_name)))
      and strpos(lower(t.title),lower(trim(p_title)))>0
  ), best as (
    select * from candidates where exact or not exists(select 1 from candidates where exact)
    order by project_name,title,id limit 10
  )
  select coalesce(jsonb_agg(to_jsonb(best)-'exact'),'[]') into matches from best;
  if jsonb_array_length(matches)<>1 then
    return jsonb_build_object('data',jsonb_build_object('status',case when matches='[]' then 'not_found' else 'ambiguous' end,'candidates',matches));
  end if;
  card := matches->0;
  receipt := 'matched';
  if p_apply then
    perform 1 from public.projects where id=(card->>'project_id')::uuid and user_id=auth.uid() for update;
    select today_date into strict previous_day from public.project_tasks
      where id=(card->>'id')::uuid and title=card->>'title' and type='task' and status<>'done' for update;
    perform public.project_today_action((card->>'project_id')::uuid,(card->>'id')::uuid,day,'add');
    receipt := case when previous_day=day then 'already_arranged' else 'arranged' end;
  end if;
  return jsonb_build_object('data',card||jsonb_build_object('status',receipt,'day',day));
end $$;
grant create on schema public to vlife_agent_executor;
alter function public.agent_project_today(text,text,uuid,boolean) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.agent_project_today(text,text,uuid,boolean) from public,anon;
grant execute on function public.agent_project_today(text,text,uuid,boolean) to authenticated;
create or replace function public.daily_task_overview(p_date text default 'today',p_lookback_days integer default 3) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); day date; business_day date; rows jsonb; planned jsonb; backlog jsonb;
  project_rows jsonb;
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
  select coalesce(jsonb_agg(to_jsonb(card)), '[]') into project_rows from (
    select t.id as project_task_id,t.title,p.id as project_id,p.name as project_name,
      t.today_date as task_date,t.status='done' as is_completed
    from public.project_tasks t join public.projects p on p.id=t.project_id
    where p.user_id=uid and t.type='task' and t.today_date=day
    order by p.name,t.title,t.id limit 501
  ) card;
  if jsonb_array_length(rows)+jsonb_array_length(project_rows)>500 then
    return jsonb_build_object('error',jsonb_build_object('code','RESULT_TOO_LARGE','message','More than 500 records. Reduce lookback_days or use daily_task_list with explicit pagination. No partial overview returned.'));
  end if;
  select coalesce(jsonb_agg(item),'[]') into planned from jsonb_array_elements(rows) item where item->>'task_date'=day::text;
  select coalesce(jsonb_agg(item),'[]') into backlog from jsonb_array_elements(rows) item where item->>'task_date'<day::text;
  return jsonb_build_object('data',jsonb_build_object(
    'business_date',business_day,'date',day,'timezone','Asia/Shanghai','complete',true,
    'backlog_from',day-p_lookback_days,'backlog_to',day-1,
    'project_tasks',project_rows,'project_task_count',jsonb_array_length(project_rows),
    'tasks',planned,'backlog',backlog,'task_count',jsonb_array_length(planned),'backlog_count',jsonb_array_length(backlog),
    'completion_semantics','For once tasks, completion synchronizes all linked dates. task_date is the planned date; completed_at is the actual completion time. Retained rows are not immutable history.'
  ));
exception when invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then
  return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT','message','Invalid date or lookback_days'));
end $$;
commit;
