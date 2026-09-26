-- Execute after migrations as the database owner. Fixtures are rolled back.
begin;
create function pg_temp.assert_true(condition boolean, message text) returns void
language plpgsql as $$ begin
  if condition is distinct from true then raise exception '%', message; end if;
end $$;
create function pg_temp.expect_error(command text, expected_state text, message text) returns void
language plpgsql as $$ declare actual_state text; begin
  begin execute command; exception when others then actual_state := sqlstate; end;
  if actual_state is distinct from expected_state then
    raise exception '%: expected %, received %', message, expected_state, coalesce(actual_state, 'no error');
  end if;
end $$;
insert into auth.users(id) values
  ('a5250000-0000-4000-8000-000000000001'), ('a5250000-0000-4000-8000-000000000002');
insert into public.subscriptions(id,user_id,name,amount,next_date,anchor_day) values
  ('b5250000-0000-4000-8000-000000000002','a5250000-0000-4000-8000-000000000002','Other user',20,'2026-01-31',31);
select set_config('request.jwt.claims','{"sub":"a5250000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;

-- Real browser CRUD and cross-user RLS, not owner-role simulations.
insert into public.subscriptions(id,name,amount,currency,billing_type,billing_unit,billing_interval,status,next_date,anchor_day)
values ('b5250000-0000-4000-8000-000000000001','Monthly plan',20,'CNY','fixed','month',1,'trial','2026-01-31',31);
select pg_temp.assert_true((select user_id=auth.uid() and reminder_days=3 and auto_renew from public.subscriptions where name='Monthly plan'),'subscription defaults');
update public.subscriptions set notes='editable' where name='Monthly plan';
select pg_temp.assert_true((select notes='editable' from public.subscriptions where name='Monthly plan'),'own update');
select pg_temp.assert_true((select count(*)=1 from public.subscriptions),'cross-user select');
update public.subscriptions set name='stolen' where id='b5250000-0000-4000-8000-000000000002';
delete from public.subscriptions where id='b5250000-0000-4000-8000-000000000002';
select pg_temp.expect_error($q$insert into public.subscriptions(user_id,name,amount,next_date,anchor_day) values('a5250000-0000-4000-8000-000000000002','injected',1,'2026-01-01',1)$q$,'42501','cross-user insert');
select pg_temp.expect_error($q$update public.subscriptions set user_id='a5250000-0000-4000-8000-000000000002' where name='Monthly plan'$q$,'42501','ownership transfer');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000002','2026-01-31','2026-01-31',20,'2026-02-28')$q$,'P0002','cross-user payment');

-- Constraints reject malformed data on all paths, including direct PostgREST.
select pg_temp.expect_error($q$update public.subscriptions set name='  ' where name='Monthly plan'$q$,'23514','blank name');
select pg_temp.expect_error($q$update public.subscriptions set amount='NaN' where name='Monthly plan'$q$,'23514','NaN amount');
select pg_temp.expect_error($q$update public.subscriptions set amount='Infinity' where name='Monthly plan'$q$,'23514','infinite amount');
select pg_temp.expect_error($q$update public.subscriptions set amount=-1 where name='Monthly plan'$q$,'23514','negative amount');
select pg_temp.expect_error($q$update public.subscriptions set url='javascript:alert(1)' where name='Monthly plan'$q$,'23514','unsafe URL');
select pg_temp.expect_error($q$update public.subscriptions set management_url='https://' where name='Monthly plan'$q$,'23514','empty URL host');
select pg_temp.expect_error($q$update public.subscriptions set billing_interval=121 where name='Monthly plan'$q$,'23514','unbounded month interval');
select pg_temp.expect_error($q$update public.subscriptions set billing_unit='day',billing_interval=3661 where name='Monthly plan'$q$,'23514','unbounded day interval');
select pg_temp.expect_error($q$update public.subscriptions set anchor_day=32 where name='Monthly plan'$q$,'23514','anchor day');
select pg_temp.expect_error($q$update public.subscriptions set reminder_days=366 where name='Monthly plan'$q$,'23514','reminder bounds');
select pg_temp.expect_error($q$update public.subscriptions set next_date='infinity' where name='Monthly plan'$q$,'23514','infinite date');
select pg_temp.expect_error($q$update public.subscriptions set next_date='2026-02-30' where name='Monthly plan'$q$,'22008','invalid calendar date');

-- A confirmed trial advances once and leaves the configured amount unchanged.
do $$ declare payment public.subscription_payments; repeated public.subscription_payments; begin
  payment:=public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-01-31','2026-01-30',17.5,'2026-02-28',true);
  perform pg_temp.assert_true(payment.period_date='2026-01-31' and payment.next_date='2026-02-28' and payment.currency='CNY' and payment.exchange_rate=1 and payment.record_expense,'payment snapshot');
  perform pg_temp.assert_true((select next_date='2026-02-28' and anchor_day=31 and status='active' and amount=20 from public.subscriptions where id=payment.subscription_id),'month-end confirmation preserves anchor and configured amount');
  perform pg_temp.assert_true((select name='订阅 · Monthly plan' and category='通讯/订阅' and amount=17.5 and amount_cny=17.5 and exchange_rate=1 and currency='CNY' and date='2026-01-30' from public.finance_records where id=payment.finance_record_id),'linked finance record');
  repeated:=public.confirm_subscription_payment(payment.subscription_id,'2026-01-31','2026-01-30',17.5,'2026-02-28',true);
  perform pg_temp.assert_true(payment.id=repeated.id and (select count(*)=1 from public.finance_records),'same-period retry duplicates neither payment nor expense');
end $$;
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-01-31','2026-01-30',18,'2026-02-28',true)$q$,'23505','conflicting repeat amount');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-01-31','2026-01-30',17.5,'2026-02-28',false)$q$,'23505','conflicting record-expense choice');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-01','2026-02-01',20,'2026-03-01')$q$,'22023','stale due date');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','2026-02-28',20,'2026-02-28')$q$,'22023','non-advancing next date');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','infinity',20,'2026-03-31')$q$,'22023','infinite payment date');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28',current_date+2,20,'2026-03-31')$q$,'22023','future payment date');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','2026-02-28','NaN','2026-03-31')$q$,'22023','invalid payment amount');

-- Clients may only select ledger history. They cannot forge, rewrite or erase it.
select pg_temp.expect_error($q$insert into public.subscription_payments(subscription_id,user_id,period_date,paid_on,amount,currency,next_date) values('b5250000-0000-4000-8000-000000000001',auth.uid(),'2026-02-28','2026-02-28',1,'CNY','2026-03-31')$q$,'42501','direct ledger insertion');
select pg_temp.expect_error($q$update public.subscription_payments set amount=0$q$,'42501','direct ledger update');
select pg_temp.expect_error($q$delete from public.subscription_payments$q$,'42501','direct ledger delete');
delete from public.finance_records;
select pg_temp.assert_true((select finance_record_id is null and record_expense from public.subscription_payments),'finance deletion clears only the link');
select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-01-31','2026-01-30',17.5,'2026-02-28',true);
select pg_temp.assert_true((select count(*)=0 from public.finance_records),'retry after deleted finance does not recreate expense');

-- Foreign-currency expenses require a rate; the failed transaction changes nothing.
update public.subscriptions set currency='USD' where name='Monthly plan';
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','2026-02-28',10,'2026-03-31',true)$q$,'22023','missing foreign rate');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','2026-02-28',10,'2026-03-31',true,'Infinity')$q$,'22023','infinite foreign rate');
select pg_temp.assert_true((select next_date='2026-02-28' from public.subscriptions where name='Monthly plan') and (select count(*)=1 from public.subscription_payments) and (select count(*)=0 from public.finance_records),'validation failure is atomic');
select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','2026-02-28',10.01,'2026-03-31',true,7.123);
select pg_temp.assert_true((select currency='USD' and amount=10.01 and amount_cny=71.30 and exchange_rate=7.123 from public.finance_records),'USD rate and rounded CNY value');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-02-28','2026-02-28',10.01,'2026-03-31',true,7.2)$q$,'23505','conflicting rate');
select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-03-31','2026-03-31',12,'2026-04-30');
select pg_temp.assert_true((select count(*)=1 from public.finance_records) and (select count(*)=3 from public.subscription_payments),'confirmation without expense');
update public.subscriptions set status='ended' where name='Monthly plan';
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-04-30','2026-04-30',20,'2026-05-31')$q$,'22023','ended subscription');
reset role;
select pg_temp.assert_true((select name='Other user' from public.subscriptions where id='b5250000-0000-4000-8000-000000000002'),'cross-user row unchanged');

-- Inject a real downstream database failure after finance insertion; all writes roll back.
create function pg_temp.reject_payment() returns trigger language plpgsql as $$ begin raise check_violation using message='test downstream failure'; end $$;
create trigger subscription_test_reject before insert on public.subscription_payments for each row execute function pg_temp.reject_payment();
set local role authenticated;
update public.subscriptions set status='active' where name='Monthly plan';
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-04-30','2026-04-30',5,'2026-05-31',true,7)$q$,'23514','downstream insertion failure');
select pg_temp.assert_true((select count(*)=1 from public.finance_records) and (select count(*)=3 from public.subscription_payments) and (select next_date='2026-04-30' from public.subscriptions where name='Monthly plan'),'expense, payment and next date roll back together');
reset role;
drop trigger subscription_test_reject on public.subscription_payments;

-- OAuth clients use the audited mutation boundary and their actual grants.
insert into public.agent_client_access(user_id,client_id,read_enabled,write_enabled,delete_enabled) values(auth.uid(),'subscription-test',true,false,false);
select set_config('request.jwt.claims','{"sub":"a5250000-0000-4000-8000-000000000001","role":"authenticated","client_id":"subscription-test"}',true);
set local role authenticated;
select pg_temp.expect_error($q$insert into public.subscriptions(name,amount,next_date,anchor_day) values('direct OAuth',1,'2026-05-01',1)$q$,'42501','OAuth direct write');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-04-30','2026-04-30',5,'2026-05-31')$q$,'42501','read-only OAuth confirmation');
reset role;
update public.agent_client_access set write_enabled=true where client_id='subscription-test';
set local role authenticated;
do $$ declare r jsonb; sid uuid; begin
  r:=public.agent_mutate('subscription','create',null,'{"name":"Agent plan","amount":5,"next_date":"2026-01-01","anchor_day":1,"category":"AI"}');
  perform pg_temp.assert_true(r->'data'->>'name'='Agent plan','Agent subscription CRUD contract: '||r::text);
  sid:=(r->'data'->>'id')::uuid;
  r:=public.agent_mutate('subscription','update',sid,'{"amount":6}');
  perform pg_temp.assert_true((r->'data'->>'amount')::numeric=6,'Agent subscription update');
  r:=public.agent_mutate('subscription','update','b5250000-0000-4000-8000-000000000002','{"amount":0}');
  perform pg_temp.assert_true(r ? 'error','Agent cross-user update');
  r:=public.agent_classifications('subscription');
  perform pg_temp.assert_true(r->'data' @> '[{"value":"AI"}]','subscription category vocabulary');
  r:=public.agent_mutate('subscription_payment','create',null,'{"subscription_id":"b5250000-0000-4000-8000-000000000001","amount":1}');
  perform pg_temp.assert_true(r ? 'error','raw Agent payment insert blocked');
end $$;
-- Editing a linked USD expense must retain the historical rate, never assume USD=CNY.
do $$ declare r jsonb; fid uuid; begin
  select id into fid from public.finance_records where currency='USD';
  r:=public.agent_mutate('finance','update',fid,'{"amount":20}');
  perform pg_temp.assert_true(not (r ? 'error') and (r->'data'->>'amount_cny')::numeric=142.46 and (r->'data'->>'exchange_rate')::numeric=7.123,'Agent USD amount edit retains historical FX: '||r::text);
  r:=public.agent_mutate('finance','update',fid,'{"notes":"Renamed expense"}');
  perform pg_temp.assert_true(not (r ? 'error') and (r->'data'->>'amount_cny')::numeric=142.46 and (r->'data'->>'exchange_rate')::numeric=7.123,'Agent description edit does not revalue');
  r:=public.agent_mutate('finance','create',null,'{"name":"Unrated USD","amount":1,"currency":"USD","date":"2026-01-01","category":"通讯/订阅"}');
  perform pg_temp.assert_true(r ? 'error' and (select count(*)=1 from public.finance_records),'new USD expense without explicit rate rejected');
  r:=public.agent_mutate('finance','update',fid,'{"currency":"CNY"}');
  perform pg_temp.assert_true(not (r ? 'error') and (r->'data'->>'amount_cny')::numeric=20,'changing expense to CNY uses rate 1');
  r:=public.agent_mutate('finance','update',fid,'{"currency":"USD"}');
  perform pg_temp.assert_true(r ? 'error' and (select currency='CNY' and exchange_rate=1 from public.finance_records where id=fid),'switching to USD without an explicit rate rejected');
end $$;
select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-04-30','2026-04-30',5,'2026-05-31');
reset role;
select pg_temp.assert_true(exists(select 1 from public.agent_action_logs where tool_name='subscription_payment_confirm' and success),'OAuth confirmation audit');
update public.agent_client_access set read_enabled=false where client_id='subscription-test';
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.subscriptions) and (select count(*)=0 from public.subscription_payments),'write-only OAuth cannot list data');
select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-05-31','2026-05-31',5,'2026-06-30');
select pg_temp.assert_true(public.agent_mutate('subscription','create',null,'{"name":"Write-only plan","amount":1,"next_date":"2026-01-01","anchor_day":1}') ? 'data','write-only OAuth can create');
reset role;
update public.agent_client_access set revoked_at=now() where client_id='subscription-test';
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.subscriptions) and (select count(*)=0 from public.subscription_payments),'revoked OAuth read');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-06-30','2026-06-30',5,'2026-07-31')$q$,'42501','revoked OAuth confirmation');
reset role;
select set_config('request.jwt.claims','{"sub":"a5250000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.subscription_payments),'cross-user ledger read');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select pg_temp.expect_error($q$select * from public.subscriptions$q$,'42501','anonymous subscriptions');
select pg_temp.expect_error($q$select public.confirm_subscription_payment('b5250000-0000-4000-8000-000000000001','2026-05-31','2026-05-31',5,'2026-06-30')$q$,'42501','anonymous confirmation');
reset role;
select set_config('request.jwt.claims','{"sub":"a5250000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
delete from public.subscriptions where name='Monthly plan';
select pg_temp.assert_true((select count(*)=0 from public.subscription_payments),'subscription deletion cascades history');
select pg_temp.assert_true((select count(*)=1 from public.finance_records),'subscription deletion preserves finance record');
reset role;
rollback;
