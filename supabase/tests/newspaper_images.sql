-- Rollback-only invariants. Run after both newspaper migrations in a disposable DB.
begin;
insert into auth.users(id) values ('a1280000-0000-4000-8000-000000000001'),('a1280000-0000-4000-8000-000000000002');
insert into public.newspaper_reports(user_id,report_date,timezone,day_start_hour,status,current_revision,snapshot)
values ('a1280000-0000-4000-8000-000000000001','2026-09-28','Asia/Shanghai',0,'draft',1,'{"date":"2026-09-28"}');
select set_config('request.jwt.claims','{"sub":"a1280000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if has_table_privilege('authenticated','public.newspaper_image_secrets','select') then raise exception 'Secret table readable'; end if;
  if has_table_privilege('authenticated','public.newspaper_image_jobs','insert') then raise exception 'Raw job insertion allowed'; end if;
  if has_function_privilege('authenticated','public.newspaper_image_claim(integer)','execute') then raise exception 'Worker RPC exposed'; end if;
end $$;
reset role;
do $$ declare j jsonb; replay jsonb; c jsonb; a jsonb; b jsonb; begin
  j:=public.newspaper_image_enqueue('a1280000-0000-4000-8000-000000000001','key-one','hash-one','2026-09-28','main','prompt',null,'{"provider":"grsai","model":"gpt-image-2-vip","size":"auto","quality":"high","aspect_ratio":"auto"}',1,'[]','https://grsai.dakka.com.cn');
  replay:=public.newspaper_image_enqueue('a1280000-0000-4000-8000-000000000001','key-one','hash-one','2026-09-28','main','new prompt',null,'{}',9,'[]','https://grsai.dakka.com.cn');
  if replay->>'id' is distinct from j->>'id' or replay->>'prompt'<>'prompt' then raise exception 'Idempotent replay changed job'; end if;
  begin
    perform public.newspaper_image_enqueue('a1280000-0000-4000-8000-000000000001','key-one','different','2026-09-28','main','p',null,'{}',1,'[]','https://grsai.dakka.com.cn');
    raise exception 'Expected idempotency conflict';
  exception when sqlstate 'P0001' then if sqlerrm not like '%IDEMPOTENCY_CONFLICT%' then raise; end if; end;
  select to_jsonb(x) into c from public.newspaper_image_claim(1) x;
  if c->>'id' is distinct from j->>'id' then raise exception 'Job not claimed'; end if;
  if exists(select 1 from public.newspaper_image_claim(1)) then raise exception 'Double claim'; end if;
  if not public.newspaper_image_checkpoint((j->>'id')::uuid,(c->>'lease_token')::uuid,'saving','provider-one','{"url":"https://example.com/a.png"}',null,0) then raise exception 'Checkpoint failed'; end if;
  a:=public.newspaper_image_finish((j->>'id')::uuid,(c->>'lease_token')::uuid,'a1280000-0000-4000-8000-000000000001/originals/a.png','a1280000-0000-4000-8000-000000000001/thumbnails/a.png',1024,1024);
  b:=public.newspaper_image_finish((j->>'id')::uuid,(c->>'lease_token')::uuid,'wrong','wrong',1,1);
  if a->>'id' is distinct from b->>'id' then raise exception 'Duplicate saving inserted another asset'; end if;
  if (select count(*) from public.newspaper_image_assets where user_id='a1280000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate assets'; end if;
  j:=public.newspaper_image_enqueue('a1280000-0000-4000-8000-000000000001','key-two','hash-two','2026-09-28','main','p',null,'{}',1,'[]','https://grsai.dakka.com.cn');
  if not exists(select 1 from public.newspaper_image_assets where id=(a->>'id')::uuid and active) then raise exception 'Old image removed before success'; end if;
  select to_jsonb(x) into c from public.newspaper_image_claim(1) x;
  perform public.newspaper_image_checkpoint((j->>'id')::uuid,(c->>'lease_token')::uuid,'submitting',null,null,null,0);
  update public.newspaper_image_jobs set lease_until=now()-interval '1 minute' where id=(j->>'id')::uuid;
  perform public.newspaper_image_claim(1);
  if not exists(select 1 from public.newspaper_image_jobs where id=(j->>'id')::uuid and status='unknown') then raise exception 'Uncertain submission retried'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a1280000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.newspaper_image_assets) or exists(select 1 from public.newspaper_image_jobs) then raise exception 'Cross-user image leak'; end if;
end $$;
reset role;
rollback;
