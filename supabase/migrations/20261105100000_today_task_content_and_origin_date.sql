begin;

alter table public.todos
  add column estimated_minutes integer,
  add constraint todos_estimated_minutes_check
    check (estimated_minutes is null or estimated_minutes in (10, 20, 30, 45, 60, 90, 120, 180, 240));

alter table public.project_tasks
  add column estimated_minutes integer,
  add constraint project_tasks_estimated_minutes_check
    check (estimated_minutes is null or estimated_minutes in (10, 20, 30, 45, 60, 90, 120, 180, 240));

alter table public.daily_tasks add column origin_task_date date;
update public.daily_tasks set origin_task_date = task_date where origin_task_date is null;
alter table public.daily_tasks alter column origin_task_date set not null;

create or replace function public.keep_daily_task_origin_date()
returns trigger language plpgsql set search_path = '' as $$
declare requested_date date;
begin
  if tg_op = 'INSERT' then
    if new.origin_task_date is null then
      requested_date := nullif(current_setting('vlife.daily_task_origin_date', true), '')::date;
      new.origin_task_date := coalesce(requested_date, new.task_date);
    end if;
  else
    requested_date := nullif(current_setting('vlife.daily_task_origin_date', true), '')::date;
    new.origin_task_date := coalesce(requested_date, old.origin_task_date);
  end if;
  return new;
end $$;

create trigger keep_daily_task_origin_date
before insert or update of origin_task_date, task_date on public.daily_tasks
for each row execute function public.keep_daily_task_origin_date();

-- Browser moves carry the source row's original planned date atomically.
create function public.daily_task_move(p_source_id uuid, p_target_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  source_todo_id uuid;
  source public.daily_tasks;
  target public.daily_tasks;
  created jsonb;
  origin_date date;
begin
  if uid is null or nullif(auth.jwt()->>'client_id', '') is not null then raise insufficient_privilege; end if;
  if p_target_date is null then raise exception using errcode = '22023', message = 'Target date is required'; end if;

  -- Match daily_task_apply/transfer: user advisory lock, todo row, then daily row.
  perform pg_advisory_xact_lock(hashtextextended('daily-add:' || uid::text, 0));
  select d.todo_id into source_todo_id
  from public.daily_tasks d
  where d.id = p_source_id and d.user_id = uid;
  if source_todo_id is null then raise no_data_found; end if;

  perform 1 from public.todos where id = source_todo_id and user_id = uid for update;
  if not found then raise no_data_found; end if;

  select * into source from public.daily_tasks where id = p_source_id and user_id = uid for update;
  if source.id is null or source.todo_id is distinct from source_todo_id then raise no_data_found; end if;
  if source.is_completed is true then raise exception using errcode = '22023', message = 'Completed task cannot be moved'; end if;
  if source.task_date = p_target_date then return jsonb_build_object('data', to_jsonb(source) - 'user_id'); end if;
  origin_date := coalesce(source.origin_task_date, source.task_date);

  select * into target from public.daily_tasks
  where user_id = uid and todo_id = source.todo_id and task_date = p_target_date for update;
  if target.id is not null then
    if target.is_completed is true then raise exception using errcode = '22023', message = 'Target task is already completed'; end if;
    perform set_config('vlife.daily_task_origin_date', origin_date::text, true);
    update public.daily_tasks set origin_task_date = origin_date where id = target.id and user_id = uid;
    perform set_config('vlife.daily_task_origin_date', '', true);
    select * into target from public.daily_tasks where id = target.id and user_id = uid;
    delete from public.daily_tasks where id = source.id and user_id = uid;
    return jsonb_build_object('data', to_jsonb(target) - 'user_id');
  end if;

  perform set_config('vlife.daily_task_origin_date', origin_date::text, true);
  begin
    created := agent_private.daily_task_apply('create', null, jsonb_build_object(
      'todo_id', source.todo_id,
      'task_date', p_target_date,
      'difficulty', coalesce(source.difficulty, 'medium'),
      'base_points', coalesce(source.base_points, 20),
      'metadata', coalesce(source.metadata, '{}'::jsonb)
    ));
  exception when others then
    perform set_config('vlife.daily_task_origin_date', '', true);
    raise;
  end;
  perform set_config('vlife.daily_task_origin_date', '', true);

  select * into target from public.daily_tasks
  where id = (created->>'id')::uuid and user_id = uid;
  if target.id is null or target.is_completed is true then raise exception using errcode = '40001', message = 'Task move target could not be verified'; end if;
  delete from public.daily_tasks where id = source.id and user_id = uid;
  return jsonb_build_object('data', to_jsonb(target) - 'user_id');
end $$;
grant create on schema public to vlife_agent_executor;
alter function public.daily_task_move(uuid, date) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.daily_task_move(uuid, date) from public, anon;
grant execute on function public.daily_task_move(uuid, date) to authenticated;

-- Agent transfers use the selected source row's original date, including for routines.
create or replace function public.daily_task_transfer(p_daily_task_ids uuid[], p_target_date text, p_mode text, p_idempotency_key text, p_request_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); cid text := auth.jwt()->>'client_id'; day date; business_day date;
  selected_ids uuid[]; fingerprint text; previous jsonb; old_hash text; result jsonb;
  source record; target jsonb; reason text; items jsonb := '[]'; created_count int := 0; removed_count int := 0; unchanged_count int := 0;
  failed_code text; source_exists boolean;
begin
  if uid is null or nullif(cid, '') is null then
    return jsonb_build_object('error', jsonb_build_object('code', 'PERMISSION_DENIED', 'message', 'OAuth identity required'));
  end if;
  perform 1 from public.agent_client_access where user_id = uid and client_id = cid and revoked_at is null for share;
  if not found or not public.agent_permission('read') or not public.agent_permission('write') or (p_mode = 'move' and not public.agent_permission('delete')) then
    return jsonb_build_object('error', jsonb_build_object('code', 'PERMISSION_DENIED', 'message', 'Read and write required; move also requires delete permission'));
  end if;
  if p_mode is null or p_mode not in ('move', 'copy') or p_daily_task_ids is null or cardinality(p_daily_task_ids) not between 1 and 200 or array_position(p_daily_task_ids, null) is not null
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 or length(p_idempotency_key) > 200 then
    return jsonb_build_object('error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'Provide 1..200 unique daily_task IDs, explicit move/copy and a stable idempotency key'));
  end if;
  select array_agg(distinct id order by id) into selected_ids from unnest(p_daily_task_ids) id;
  if cardinality(selected_ids) <> cardinality(p_daily_task_ids) then
    return jsonb_build_object('error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'Source IDs must be unique'));
  end if;
  fingerprint := md5(jsonb_build_object('workflow', 'daily_task_transfer', 'ids', selected_ids, 'target', p_target_date, 'mode', p_mode)::text);
  perform pg_advisory_xact_lock(hashtextextended(uid::text || cid || p_idempotency_key, 0));
  select payload_hash, response into old_hash, previous from public.agent_idempotency_keys where user_id = uid and client_id = cid and idempotency_key = p_idempotency_key;
  if found then
    if old_hash <> fingerprint then return jsonb_build_object('error', jsonb_build_object('code', 'IDEMPOTENCY_CONFLICT', 'message', 'This key belongs to different arguments; preserve original arguments for retries')); end if;
    return previous || jsonb_build_object('replayed', true);
  end if;
  begin
    business_day := public.task_business_date();
    day := agent_private.resolve_task_date(p_target_date, business_day);
    perform pg_advisory_xact_lock(hashtextextended('daily-add:' || uid::text, 0));
    perform t.id from public.todos t where t.user_id = uid and t.id in (
      select d.todo_id from public.daily_tasks d where d.user_id = uid and d.id = any(selected_ids)
    ) order by t.id for update;
    perform d.id from public.daily_tasks d where d.user_id = uid and (d.id = any(selected_ids) or (d.task_date = day and d.todo_id in (
      select s.todo_id from public.daily_tasks s where s.user_id = uid and s.id = any(selected_ids)
    ))) order by d.id for update;
    if (select count(*) from public.daily_tasks where user_id = uid and id = any(selected_ids)) <> cardinality(selected_ids) then raise no_data_found; end if;
    for source in
      select d as daily, t as task from public.daily_tasks d join public.todos t on t.id = d.todo_id and t.user_id = uid
      where d.user_id = uid and d.id = any(selected_ids) order by d.task_date desc, d.id
    loop
      reason := agent_private.task_transfer_reason(source.task, source.daily, day);
      if reason is not null then raise exception using errcode = 'P0001', message = 'Source ' || (source.daily).id::text || ' cannot be transferred: ' || reason; end if;
      if (source.daily).task_date = day then
        target := to_jsonb(source.daily) || jsonb_build_object('_created', false);
        unchanged_count := unchanged_count + 1;
        source_exists := true;
      else
        perform set_config('vlife.daily_task_origin_date', case
          when p_mode = 'move' or (source.task).kind = 'once'
            then coalesce((source.daily).origin_task_date, (source.daily).task_date)::text
          else day::text
        end, true);
        begin
          target := agent_private.daily_task_apply('create', null, jsonb_build_object(
            'todo_id', (source.daily).todo_id, 'task_date', day,
            'difficulty', coalesce((source.daily).difficulty, 'medium'), 'base_points', coalesce((source.daily).base_points, 20),
            'metadata', coalesce((source.daily).metadata, '{}'::jsonb)
          ));
          if p_mode = 'move' or (source.task).kind = 'once' then
            update public.daily_tasks
            set origin_task_date = coalesce((source.daily).origin_task_date, (source.daily).task_date)
            where user_id = uid and id = (target->>'id')::uuid;
            select to_jsonb(d) || jsonb_build_object('_created', coalesce((target->>'_created')::boolean, false))
            into target from public.daily_tasks d where d.user_id = uid and d.id = (target->>'id')::uuid;
          end if;
        exception when others then
          perform set_config('vlife.daily_task_origin_date', '', true);
          raise;
        end;
        perform set_config('vlife.daily_task_origin_date', '', true);
        if (target->>'_created')::boolean then created_count := created_count + 1; end if;
        if p_mode = 'move' and exists(select 1 from public.daily_tasks where user_id = uid and id = (source.daily).id) then
          perform agent_private.daily_task_apply('delete', (source.daily).id, '{}');
        end if;
        source_exists := exists(select 1 from public.daily_tasks where user_id = uid and id = (source.daily).id);
        if not source_exists then removed_count := removed_count + 1; end if;
      end if;
      items := items || jsonb_build_array(jsonb_build_object(
        'source_daily_task_id', (source.daily).id, 'source_date', (source.daily).task_date,
        'target_daily_task_id', target->>'id', 'target_date', day, 'todo_id', (source.task).id, 'title', (source.task).title,
        'outcome', case when (source.daily).task_date = day then 'already_on_target' when not source_exists then 'moved' else 'copied' end,
        'target_created', (target->>'_created')::boolean,
        'source_removed', (source.daily).task_date <> day and not source_exists
      ));
    end loop;
    if exists(select 1 from jsonb_array_elements(items) item where not exists(
      select 1 from public.daily_tasks d where d.user_id = uid and d.id = (item->>'target_daily_task_id')::uuid and d.todo_id = (item->>'todo_id')::uuid and d.task_date = day
    ) or ((item->>'source_removed')::boolean and exists(select 1 from public.daily_tasks d where d.user_id = uid and d.id = (item->>'source_daily_task_id')::uuid))) then
      raise exception using errcode = '40001', message = 'Task transfer postcondition failed';
    end if;
    result := jsonb_build_object('replayed', false, 'data', jsonb_build_object(
      'mode', p_mode, 'business_date', business_day, 'target_date', day, 'verified_at', statement_timestamp(),
      'source_count', cardinality(selected_ids), 'target_count', (select count(distinct item->>'target_daily_task_id') from jsonb_array_elements(items) item),
      'created_count', created_count, 'removed_count', removed_count, 'unchanged_count', unchanged_count, 'items', items,
      'completion_semantics', 'An incomplete once task stays on one date. Scheduling it again removes the other open days. Completed rows remain. A routine keeps each day. Completing a once task synchronizes its remaining rows.'
    ));
    insert into public.agent_idempotency_keys(user_id, client_id, idempotency_key, payload_hash, response) values(uid, cid, p_idempotency_key, fingerprint, result);
  exception when others then
    failed_code := case sqlstate when 'P0002' then 'NOT_FOUND' when 'P0001' then 'TASK_NOT_ELIGIBLE' when '42501' then 'PERMISSION_DENIED' when '23505' then 'CONFLICT' when '22023' then 'INVALID_INPUT' when '22007' then 'INVALID_INPUT' when '22008' then 'INVALID_INPUT' else 'DATABASE_ERROR' end;
    result := jsonb_build_object('error', jsonb_build_object('code', failed_code, 'message', case when failed_code = 'TASK_NOT_ELIGIBLE' then sqlerrm when failed_code = 'NOT_FOUND' then 'A source task no longer exists or is not accessible. Refresh the overview.' else 'No tasks transferred. Check arguments, permissions or refresh the overview; preserve the retry key.' end));
  end;
  insert into public.agent_action_logs(user_id, client_id, tool_name, operation, request_id, idempotency_key, success, error_code)
  values(uid, cid, 'daily_task_transfer', 'update', p_request_id, p_idempotency_key, not (result ? 'error'), result->'error'->>'code');
  update public.agent_client_access set last_used_at = now() where user_id = uid and client_id = cid;
  return result;
end $$;
grant create on schema public to vlife_agent_executor;
alter function public.daily_task_transfer(uuid[], text, text, text, text) owner to vlife_agent_executor;
revoke create on schema public from vlife_agent_executor;
revoke all on function public.daily_task_transfer(uuid[], text, text, text, text) from public, anon;
grant execute on function public.daily_task_transfer(uuid[], text, text, text, text) to authenticated;

update agent_private.module_contracts
set contract = jsonb_set(
  jsonb_set(
    jsonb_set(contract, '{readColumns}', (contract->'readColumns') || '["estimated_minutes"]'::jsonb),
    '{createColumns}', (contract->'createColumns') || '["estimated_minutes"]'::jsonb
  ),
  '{updateColumns}', (contract->'updateColumns') || '["estimated_minutes"]'::jsonb
)
where module in ('todo', 'project_task');

update agent_private.module_contracts
set contract = jsonb_set(contract, '{readColumns}', (contract->'readColumns') || '["origin_task_date"]'::jsonb)
where module = 'daily_task';

commit;
