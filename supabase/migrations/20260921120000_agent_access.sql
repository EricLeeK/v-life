-- Agent grants, audit trail, and idempotent mutation boundary.
create table if not exists public.agent_client_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  client_name text not null default 'Agent',
  read_enabled boolean not null default true,
  write_enabled boolean not null default false,
  delete_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  primary key (user_id, client_id)
);
alter table public.agent_client_access enable row level security;
create policy "users manage own agent grants" on public.agent_client_access for all to authenticated
  using (auth.uid() = user_id and coalesce((auth.jwt()->>'client_id'),'') = '')
  with check (auth.uid() = user_id and coalesce((auth.jwt()->>'client_id'),'') = '');
create policy "agent reads own grant" on public.agent_client_access for select to authenticated
  using (auth.uid() = user_id and auth.jwt()->>'client_id' = client_id);

create table if not exists public.agent_action_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null, tool_name text not null, operation text not null, record_id text,
  request_id text, idempotency_key text, success boolean not null, error_code text, created_at timestamptz not null default now()
);
alter table public.agent_action_logs enable row level security;
create policy "users read own agent logs" on public.agent_action_logs for select to authenticated using (auth.uid() = user_id);

create table if not exists public.agent_idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade, client_id text not null, idempotency_key text not null,
  payload_hash text not null, response jsonb, created_at timestamptz not null default now(),
  primary key (user_id, client_id, idempotency_key)
);
alter table public.agent_idempotency_keys enable row level security;

create or replace function public.agent_mutate(
  p_user_id uuid, p_client_id text, p_table text, p_module text, p_operation text, p_record_id text,
  p_payload jsonb, p_idempotency_key text, p_payload_hash text, p_request_id text, p_tool_name text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare prior jsonb; result jsonb; target text; allowed boolean;
begin
  if auth.uid() <> p_user_id or auth.jwt()->>'client_id' <> p_client_id then raise exception using errcode='42501', message='agent identity mismatch'; end if;
  if p_table not in ('todos','finance_records','calorie_records','schedule_events','thoughts','projects','project_tasks','learning_notes','goals','weight_records','measurement_records','pantry_items','belongings_daily','belongings_durable') then raise exception using errcode='22023', message='table not allowed'; end if;
  select response into prior from agent_idempotency_keys where user_id=p_user_id and client_id=p_client_id and idempotency_key=p_idempotency_key for update;
  if found then
    if (select payload_hash from agent_idempotency_keys where user_id=p_user_id and client_id=p_client_id and idempotency_key=p_idempotency_key) <> p_payload_hash then raise exception using errcode='23505', message='idempotency key payload conflict'; end if;
    return coalesce(prior, jsonb_build_object('status','in_progress'));
  end if;
  insert into agent_idempotency_keys values (p_user_id,p_client_id,p_idempotency_key,p_payload_hash,null);
  if p_operation = 'delete' then execute format('delete from public.%I where id=$1 and user_id=$2 returning jsonb_build_object(''id'',id)', p_table) into result using p_record_id,p_user_id;
  elsif p_operation = 'update' then execute format('update public.%I set %s where id=$1 and user_id=$2 returning to_jsonb(%I.*)', p_table, (select string_agg(format('%I=$3->>%L', key, key), ',') from jsonb_object_keys(p_payload) key), p_table) into result using p_record_id,p_user_id,p_payload;
  else execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I.*)',p_table,p_table,p_table) into result using p_payload || jsonb_build_object('user_id',p_user_id);
  end if;
  result := coalesce(result, '{}'::jsonb); update agent_idempotency_keys set response=result where user_id=p_user_id and client_id=p_client_id and idempotency_key=p_idempotency_key;
  insert into agent_action_logs(user_id,client_id,tool_name,operation,record_id,request_id,idempotency_key,success) values(p_user_id,p_client_id,p_tool_name,p_operation,p_record_id,p_request_id,p_idempotency_key,true);
  return result;
end $$;
