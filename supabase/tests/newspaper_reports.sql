-- Run against a migrated local Supabase database; no fixture survives this transaction.
begin;
insert into auth.users(id) values ('ac000000-0000-4000-8000-000000000001'),('ac000000-0000-4000-8000-000000000002');
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled)
values('ac000000-0000-4000-8000-000000000001','newspaper-test','Newspaper tests',true,false,false);
set local role service_role;
select public.newspaper_save_snapshot('ac000000-0000-4000-8000-000000000001','2026-09-27','{"date":"2026-09-27","timezone":"Asia/Shanghai","day_start_hour":4,"source_fingerprint":"one","sections":[],"metrics":[],"coverage":[],"captured_at":"2026-09-27T23:00:00Z"}','archived',false);
do $$ declare a jsonb;b jsonb;begin
 a:=public.newspaper_claim_review('ac000000-0000-4000-8000-000000000001','review-key','2026-09-27');
 b:=public.newspaper_claim_review('ac000000-0000-4000-8000-000000000001','review-key','2026-09-27');
 if not (a->>'claimed')::boolean or (b->>'claimed')::boolean then raise exception 'paid review claimed more than once';end if;
 begin
  perform public.newspaper_claim_review('ac000000-0000-4000-8000-000000000001','review-key','2026-09-26');raise exception 'Expected conflict';
 exception when sqlstate 'P0001' then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 a:=public.newspaper_complete_review('ac000000-0000-4000-8000-000000000001','review-key','{"overview":"valid review","source_revision":1,"source_fingerprint":"one"}');
 if not (a->>'applied')::boolean then raise exception 'review did not attach';end if;
 b:=public.newspaper_claim_review('ac000000-0000-4000-8000-000000000001','review-key','2026-09-27');
 if b->>'status'<>'succeeded' or b->'review'->>'overview'<>'valid review' then raise exception 'paid result not replayable';end if;
end $$;
reset role;
insert into public.newspaper_supplements(user_id,report_date,body) values('ac000000-0000-4000-8000-000000000001','2026-09-27','keep original supplement');
set local role service_role;
select public.newspaper_save_snapshot('ac000000-0000-4000-8000-000000000001','2026-09-27','{"date":"2026-09-27","timezone":"Asia/Shanghai","day_start_hour":4,"source_fingerprint":"two","sections":[],"metrics":[],"coverage":[],"captured_at":"2026-09-28T10:00:00Z"}','reconstructed',false);
-- A scheduled rerun must not replace an existing historical report.
select public.newspaper_save_snapshot('ac000000-0000-4000-8000-000000000001','2026-09-27','{"date":"2026-09-27","timezone":"Asia/Shanghai","day_start_hour":4,"source_fingerprint":"bad","sections":[],"metrics":[],"coverage":[],"captured_at":"2026-09-28T11:00:00Z"}','archived',true);
reset role;
do $$ begin
 if (select status from public.newspaper_reports where user_id='ac000000-0000-4000-8000-000000000001' and report_date='2026-09-27')<>'archived' then raise exception 'refresh changed archive provenance';end if;
 if (select count(*) from public.newspaper_report_revisions where user_id='ac000000-0000-4000-8000-000000000001')<>2 then raise exception 'revision history lost or scheduled rerun mutated it';end if;
 if not exists(select 1 from public.newspaper_report_revisions where revision=1 and snapshot->>'source_fingerprint'='one' and user_id='ac000000-0000-4000-8000-000000000001') then raise exception 'old snapshot changed';end if;
 if not exists(select 1 from public.newspaper_supplements where body='keep original supplement' and user_id='ac000000-0000-4000-8000-000000000001') then raise exception 'refresh lost supplements';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"newspaper-test"}',true);
set local role authenticated;
do $$ begin
 if not public.newspaper_authorize('read') or public.newspaper_authorize('write') then raise exception 'wrong agent authorization';end if;
 if (select count(*) from public.newspaper_reports)<>1 then raise exception 'authorized report read failed';end if;
 begin
  perform public.newspaper_save_snapshot('ac000000-0000-4000-8000-000000000002','2026-09-27','{}','archived',false);
  raise exception 'authenticated identity spoofed service RPC';
 exception when insufficient_privilege then null;end;
 begin
  update public.newspaper_reports set snapshot='{}';raise exception 'client altered immutable snapshot';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.newspaper_supplements(user_id,report_date,body) values('ac000000-0000-4000-8000-000000000001','2026-09-27','bypass');raise exception 'OAuth direct mutation bypassed service';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.agent_client_access set revoked_at=now() where client_id='newspaper-test';
set local role authenticated;
do $$ begin if exists(select 1 from public.newspaper_reports) or public.newspaper_authorize('read') then raise exception 'revoked agent read report';end if;end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.newspaper_reports) or exists(select 1 from public.newspaper_report_revisions) or exists(select 1 from public.newspaper_supplements) then raise exception 'cross-user newspaper exposure';end if;end $$;
reset role;
rollback;

-- Search is evaluated over all owned rows before paging, including later supplements.
begin;
insert into auth.users(id) values ('ac000000-0000-4000-8000-000000000011'),('ac000000-0000-4000-8000-000000000012');
insert into public.newspaper_reports(user_id,report_date,status,timezone,day_start_hour,current_revision,snapshot,review)
select 'ac000000-0000-4000-8000-000000000011',d,'archived','UTC',0,1,jsonb_build_object('date',d::date,'sections','[]'::jsonb),case when d='2026-09-25' then '{"overview":"review-only-phrase"}'::jsonb else null end
from generate_series('2026-09-25'::date,'2026-09-27'::date,'1 day'::interval) s(d);
insert into public.newspaper_reports(user_id,report_date,status,timezone,day_start_hour,current_revision,snapshot)
values('ac000000-0000-4000-8000-000000000012','2026-09-24','archived','UTC',0,1,'{"date":"2026-09-24","sections":[]}');
insert into public.newspaper_supplements(user_id,report_date,body) values
 ('ac000000-0000-4000-8000-000000000011','2026-09-26','supplement-only-phrase'),
 ('ac000000-0000-4000-8000-000000000011','2026-09-25','supplement-only-phrase with literal 100%'),
 ('ac000000-0000-4000-8000-000000000012','2026-09-24','foreign-only-phrase');
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
set local role authenticated;
do $$ declare dates date[];begin
 select array_agg(report_date order by report_date desc) into dates from public.newspaper_search_reports('supplement-only-phrase',null,null,1,0);
 if dates is distinct from array['2026-09-26'::date,'2026-09-25'::date] then raise exception 'supplement search was paged before filtering: %',dates;end if;
 select array_agg(report_date) into dates from public.newspaper_search_reports('supplement-only-phrase',null,null,1,1);
 if dates is distinct from array['2026-09-25'::date] then raise exception 'search next page incomplete: %',dates;end if;
 if not exists(select 1 from public.newspaper_search_reports('review-only-phrase',null,null,20,0)) then raise exception 'review not searched';end if;
 if exists(select 1 from public.newspaper_search_reports('foreign-only-phrase',null,null,20,0)) then raise exception 'cross-user supplement search leak';end if;
 if (select count(*) from public.newspaper_search_reports('100%',null,null,20,0))<>1 then raise exception 'literal search wildcard treated as pattern';end if;
 if exists(select 1 from public.newspaper_search_reports('supplement-only-phrase','2026-09-27',null,20,0)) then raise exception 'search ignored date filter';end if;
end $$;
reset role;
insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled,revoked_at)
values('ac000000-0000-4000-8000-000000000011','search-revoked','Search test',true,false,false,now());
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000011","role":"authenticated","client_id":"search-revoked"}',true);
set local role authenticated;
do $$ begin
 begin perform public.newspaper_search_reports('supplement-only-phrase',null,null,20,0);raise exception 'revoked client searched reports';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;

-- Repeat this suite after the image migration to verify lazy caption search and tenant scoping.
begin;
insert into auth.users(id) values ('ac000000-0000-4000-8000-000000000021'),('ac000000-0000-4000-8000-000000000022');
insert into public.newspaper_reports(user_id,report_date,status,timezone,day_start_hour,current_revision,snapshot)
values('ac000000-0000-4000-8000-000000000021','2026-09-27','archived','UTC',0,1,'{"date":"2026-09-27","sections":[]}'),
 ('ac000000-0000-4000-8000-000000000022','2026-09-27','archived','UTC',0,1,'{"date":"2026-09-27","sections":[]}');
do $$ declare uid uuid;jid uuid;begin
 if to_regclass('public.newspaper_image_assets') is null then return;end if;
 foreach uid in array array['ac000000-0000-4000-8000-000000000021'::uuid,'ac000000-0000-4000-8000-000000000022'::uuid] loop
  insert into public.newspaper_image_jobs(user_id,report_date,section_id,idempotency_key,request_hash,prompt,options,source_revision,base_url,generation)
  values(uid,'2026-09-27','main','caption-search','hash','prompt','{}',1,'https://example.test',1) returning id into jid;
  insert into public.newspaper_image_assets(job_id,user_id,report_date,section_id,storage_path,thumbnail_path,width,height,caption,prompt,options,source_revision)
  values(jid,uid,'2026-09-27','main',uid||'/original.png',uid||'/thumb.png',100,100,
   case when uid='ac000000-0000-4000-8000-000000000021' then 'owned-caption-only' else 'foreign-caption-only' end,'prompt','{}',1);
 end loop;
end $$;
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000021","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if to_regclass('public.newspaper_image_assets') is null then
  if public.newspaper_caption_matches('2026-09-27','anything') then raise exception 'missing image table unexpectedly matched';end if;
 else
  if (select count(*) from public.newspaper_search_reports('owned-caption-only',null,null,20,0))<>1 then raise exception 'caption search omitted own asset';end if;
  if exists(select 1 from public.newspaper_search_reports('foreign-caption-only',null,null,20,0)) then raise exception 'caption search leaked another tenant';end if;
 end if;
end $$;
reset role;
rollback;
