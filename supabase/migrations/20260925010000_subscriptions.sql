begin;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  url text check (url is null or url ~* '^https?://[^/[:space:]]+[^[:space:]]*$'),
  management_url text check (management_url is null or management_url ~* '^https?://[^/[:space:]]+[^[:space:]]*$'),
  category text not null default '其他' check (length(btrim(category)) between 1 and 100),
  plan text,
  account text,
  notes text,
  amount numeric not null check (amount >= 0 and amount <= 1000000000000),
  currency text not null default 'CNY' check (currency in ('CNY','USD','JPY')),
  billing_type text not null default 'fixed' check (billing_type in ('fixed','usage')),
  billing_unit text not null default 'month' check (billing_unit in ('month','day')),
  billing_interval integer not null default 1 check (
    billing_interval > 0 and billing_interval <= case billing_unit when 'month' then 120 else 3660 end
  ),
  status text not null default 'active' check (status in ('active','trial','ended')),
  auto_renew boolean not null default true,
  next_date date not null check (isfinite(next_date)),
  anchor_day integer not null check (anchor_day between 1 and 31),
  reminder_days integer default 3 check (reminder_days between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_status_next_date_idx on public.subscriptions(user_id,status,next_date);
create index subscriptions_user_category_idx on public.subscriptions(user_id,category);
create trigger update_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.update_updated_at_column();
alter table public.subscriptions enable row level security;
create policy "Users manage own subscriptions" on public.subscriptions for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
-- Keep OAuth direct writes behind the audited agent_mutate boundary.
create policy agent_read_boundary on public.subscriptions as restrictive for select to authenticated
  using (nullif(auth.jwt()->>'client_id','') is null or public.agent_permission('read') or
    (current_user='vlife_agent_executor' and (public.agent_permission('write') or public.agent_permission('delete'))));
create policy agent_insert_boundary on public.subscriptions as restrictive for insert to authenticated
  with check (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('write')));
create policy agent_update_boundary on public.subscriptions as restrictive for update to authenticated
  using (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('write')))
  with check (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('write')));
create policy agent_delete_boundary on public.subscriptions as restrictive for delete to authenticated
  using (nullif(auth.jwt()->>'client_id','') is null or (current_user='vlife_agent_executor' and public.agent_permission('delete')));
revoke all on public.subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.subscriptions to authenticated;

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_date date not null check (isfinite(period_date)),
  paid_on date not null check (isfinite(paid_on)),
  amount numeric not null check (amount >= 0 and amount <= 1000000000000),
  currency text not null check (currency in ('CNY','USD','JPY')),
  next_date date not null check (isfinite(next_date) and next_date > period_date),
  finance_record_id uuid references public.finance_records(id) on delete set null,
  -- Preserve the confirmation request even when its finance entry is deleted/edited.
  record_expense boolean not null default false,
  exchange_rate numeric check (exchange_rate > 0 and exchange_rate <= 1000000000000),
  created_at timestamptz not null default now(),
  unique(subscription_id,period_date),
  check ((record_expense and exchange_rate is not null) or (not record_expense and exchange_rate is null)),
  check (not record_expense or currency <> 'CNY' or exchange_rate=1)
);
create index subscription_payments_user_paid_on_idx on public.subscription_payments(user_id,paid_on desc);
alter table public.subscription_payments enable row level security;
create policy "Users read own subscription payments" on public.subscription_payments for select to authenticated
  using (user_id=auth.uid() and (nullif(auth.jwt()->>'client_id','') is null or public.agent_permission('read')));
-- Even the generic Agent executor cannot insert/update/delete payment history.
revoke all on public.subscription_payments from public,anon,authenticated,vlife_agent_executor;
grant select on public.subscription_payments to authenticated;

-- Subscription confirmation can optionally create a USD-denominated expense.
alter table public.finance_records drop constraint if exists finance_records_currency_check;
alter table public.finance_records add constraint finance_records_currency_check check (currency in ('CNY','JPY','USD'));

create or replace function public.confirm_subscription_payment(
  p_subscription_id uuid,
  p_due_date date,
  p_paid_on date,
  p_amount numeric,
  p_next_date date,
  p_record_expense boolean default false,
  p_exchange_rate numeric default null
) returns public.subscription_payments
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); cid text:=nullif(auth.jwt()->>'client_id','');
  subscription public.subscriptions; payment public.subscription_payments;
  effective_rate numeric; finance_id uuid;
begin
  if uid is null then raise insufficient_privilege using message='Authentication required'; end if;
  if cid is not null then
    -- Serialize revocation with confirmation, matching agent_mutate's permission boundary.
    perform 1 from public.agent_client_access where user_id=uid and client_id=cid and revoked_at is null for share;
    if not found or not public.agent_permission('write') then
      raise insufficient_privilege using message='Agent write permission required';
    end if;
  end if;
  if p_subscription_id is null or p_due_date is null or not isfinite(p_due_date)
    or p_paid_on is null or not isfinite(p_paid_on)
    or p_paid_on > (statement_timestamp() at time zone 'Asia/Shanghai')::date
    or p_next_date is null or not isfinite(p_next_date) or p_next_date <= p_due_date
    or p_amount is null or not (p_amount >= 0 and p_amount <= 1000000000000)
    or p_record_expense is null then
    raise invalid_parameter_value using message='Invalid payment amount or dates';
  end if;
  -- This row lock serializes double clicks and concurrent confirmations for the same bill.
  select * into subscription from public.subscriptions where id=p_subscription_id and user_id=uid for update;
  if not found then raise no_data_found using message='Subscription not found'; end if;
  select * into payment from public.subscription_payments
    where subscription_id=p_subscription_id and period_date=p_due_date and user_id=uid;
  effective_rate:=case when not p_record_expense then null
    when coalesce(payment.currency,subscription.currency)='CNY' then 1 else p_exchange_rate end;
  if p_record_expense and (effective_rate is null or not (effective_rate > 0 and effective_rate <= 1000000000000)) then
    raise invalid_parameter_value using message='A positive finite exchange rate is required';
  end if;
  if payment.id is not null then
    if payment.paid_on is distinct from p_paid_on or payment.amount is distinct from p_amount
      or payment.next_date is distinct from p_next_date or payment.record_expense is distinct from p_record_expense
      or payment.exchange_rate is distinct from effective_rate then
      raise unique_violation using message='This subscription period was confirmed with different details';
    end if;
    return payment;
  end if;
  if subscription.status='ended' then raise invalid_parameter_value using message='Ended subscriptions cannot be confirmed'; end if;
  if subscription.next_date is distinct from p_due_date then
    raise invalid_parameter_value using message='Subscription due date changed; reload before confirming';
  end if;
  if p_record_expense then
    insert into public.finance_records(user_id,date,name,category,amount,currency,amount_cny,exchange_rate)
      values(uid,p_paid_on,'订阅 · '||subscription.name,'通讯/订阅',p_amount,subscription.currency,round(p_amount*effective_rate,2),effective_rate)
      returning id into finance_id;
  end if;
  insert into public.subscription_payments(user_id,subscription_id,period_date,paid_on,amount,currency,next_date,finance_record_id,record_expense,exchange_rate)
    values(uid,subscription.id,p_due_date,p_paid_on,p_amount,subscription.currency,p_next_date,finance_id,p_record_expense,effective_rate)
    returning * into payment;
  update public.subscriptions set next_date=p_next_date,status='active' where id=subscription.id and user_id=uid;
  if cid is not null then
    insert into public.agent_action_logs(user_id,client_id,tool_name,operation,record_id,success)
      values(uid,cid,'subscription_payment_confirm','create',payment.id::text,true);
    update public.agent_client_access set last_used_at=now() where user_id=uid and client_id=cid;
  end if;
  return payment;
end $$;
revoke all on function public.confirm_subscription_payment(uuid,date,date,numeric,date,boolean,numeric) from public,anon;
grant execute on function public.confirm_subscription_payment(uuid,date,date,numeric,date,boolean,numeric) to authenticated;

insert into agent_private.module_contracts(module,contract) values ('subscription',
  '{"table":"subscriptions","actions":{"create":true,"update":true,"delete":true},"ownsUserId":true,"readColumns":["name","url","management_url","category","plan","account","notes","amount","currency","billing_type","billing_unit","billing_interval","status","auto_renew","next_date","anchor_day","reminder_days","created_at","updated_at"],"createColumns":["name","url","management_url","category","plan","account","notes","amount","currency","billing_type","billing_unit","billing_interval","status","auto_renew","next_date","anchor_day","reminder_days"],"updateColumns":["name","url","management_url","category","plan","account","notes","amount","currency","billing_type","billing_unit","billing_interval","status","auto_renew","next_date","anchor_day","reminder_days"]}')
  on conflict(module) do update set contract=excluded.contract;
-- Read-only contract: confirmed history is created exclusively by the domain RPC.
insert into agent_private.module_contracts(module,contract) values ('subscription_payment',
  '{"table":"subscription_payments","actions":{},"ownsUserId":true,"readColumns":["subscription_id","period_date","paid_on","amount","currency","next_date","finance_record_id","record_expense","exchange_rate","created_at"],"createColumns":[],"updateColumns":[]}')
  on conflict(module) do update set contract=excluded.contract;

create or replace function public.agent_classifications(p_module text,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); source_sql text; result jsonb;
begin
 if uid is null or not public.agent_permission('read') then raise insufficient_privilege; end if;
 if p_limit is null or p_limit<1 or p_limit>200 or p_offset is null or p_offset<0 then raise invalid_parameter_value using message='Invalid classification pagination'; end if;
 source_sql:=case p_module
 when 'todo' then 'select category as value,1::bigint as uses,false as configured from public.todos where user_id=$1'
 when 'daily_task' then 'select category as value,1::bigint as uses,false as configured from public.todos where user_id=$1'
 when 'belongings_daily' then 'select category as value,1::bigint as uses,false as configured from public.belongings_daily where user_id=$1'
 when 'finance' then 'select category as value,1::bigint as uses,false as configured from public.finance_records where user_id=$1'
 when 'subscription' then 'select category as value,1::bigint as uses,false as configured from public.subscriptions where user_id=$1'
 when 'pantry' then 'select category as value,1::bigint as uses,false as configured from public.pantry_items where user_id=$1'
 when 'belongings_durable' then 'select category as value,1::bigint as uses,false as configured from public.belongings_durable where user_id=$1'
 when 'thought' then 'select unnest(tags) as value,1::bigint as uses,false as configured from public.thoughts where user_id=$1 union all select jsonb_array_elements_text(case when jsonb_typeof(custom_thought_tags)=''array'' then custom_thought_tags else ''[]''::jsonb end),0::bigint,true from public.settings where user_id=$1'
 when 'learning_note' then 'select unnest(n.tags) as value,1::bigint as uses,false as configured from public.learning_notes n join public.learning_courses c on c.id=n.course_id where c.user_id=$1'
 when 'civil_plan' then 'select subject_tag as value,1::bigint as uses,false as configured from public.civil_plan_items where user_id=$1'
 when 'civil_wrong' then 'select subject_tag as value,1::bigint as uses,false as configured from public.civil_wrong_answers where user_id=$1'
 else null end;
 if source_sql is null then raise invalid_parameter_value using message='Module has no classification vocabulary'; end if;
 execute 'with vocabulary as (select btrim(value) as value,sum(uses) as usage_count,bool_or(configured) as configured from ('||source_sql||') source where nullif(btrim(value),'''') is not null group by btrim(value)), page as (select * from vocabulary order by usage_count desc,value collate "C" limit $2 offset $3) select jsonb_build_object(''data'',coalesce((select jsonb_agg(to_jsonb(page) order by usage_count desc,value collate "C") from page),''[]''::jsonb),''total'',(select count(*) from vocabulary),''hasMore'',(select count(*) from vocabulary)>$3+$2,''nextOffset'',case when (select count(*) from vocabulary)>$3+$2 then $3+$2 else null end)' into result using uid,p_limit,p_offset;
 return result;
end $$;
revoke all on function public.agent_classifications(text,integer,integer) from public,anon;
grant execute on function public.agent_classifications(text,integer,integer) to authenticated;


-- Preserve historical USD conversion when existing finance entries are edited.
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
       if coalesce(body->>'currency',existing->>'currency','CNY')='USD' then
         -- The generic finance contract has no exchange-rate input. Only preserve a
         -- previously saved USD rate; creating/converting to USD needs the payment RPC.
         if existing->>'currency' is distinct from 'USD' then
           raise invalid_parameter_value using message='USD expenses require an explicit exchange rate; use subscription payment confirmation';
         end if;
         rate:=(existing->>'exchange_rate')::numeric;
         if rate is null or not (rate>0 and rate<=1000000000000) then
           raise invalid_parameter_value using message='USD expense has no valid saved exchange rate';
         end if;
       else
         rate:=case when coalesce(body->>'currency',existing->>'currency','CNY')='JPY' then public.agent_exchange_rate() else 1 end;
       end if;
       existing:=coalesce(existing,'{}')||body;
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
   result:=jsonb_build_object('error',jsonb_build_object('code',failed_code,'message',case failed_code when 'RELATION_AMBIGUOUS' then 'Multiple todos have this title; use todo_id' when 'TASK_NOT_ELIGIBLE' then sqlerrm when 'NOT_FOUND' then 'Record not found' when 'PERMISSION_DENIED' then 'Operation not authorized' else case when sqlerrm in ('USD expenses require an explicit exchange rate; use subscription payment confirmation','USD expense has no valid saved exchange rate') then sqlerrm else 'Mutation could not be applied' end end));
 end;
 insert into public.agent_action_logs(user_id,client_id,tool_name,operation,record_id,request_id,idempotency_key,success,error_code)
 values(uid,cid,coalesce(p_tool_name,p_module||'_'||p_operation),p_operation,coalesce(rowdata->>'id',p_record_id::text),p_request_id,p_idempotency_key,not(result ? 'error'),result->'error'->>'code');
 update public.agent_client_access set last_used_at=now() where user_id=uid and client_id=cid;
 return result;
end $$;

commit;
