begin;
-- The server validates real user JWTs before supplying its private service-role client.
-- OAuth grants are checked from the current database state, never from caller input.
create or replace function public.newspaper_authorize(p_operation text)
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid text:=nullif(auth.jwt()->>'client_id','');
begin
 if uid is null or p_operation not in ('read','write','delete') then return false;end if;
 if cid is null then return true;end if;
 perform 1 from public.agent_client_access where user_id=uid and client_id=cid and revoked_at is null for share;
 return found and public.agent_permission(p_operation);
end $$;
revoke all on function public.newspaper_authorize(text) from public,anon;
grant execute on function public.newspaper_authorize(text) to authenticated;

create table public.newspaper_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,enabled_from date check(enabled_from is null or isfinite(enabled_from)),
 timezone text not null default 'Asia/Shanghai',day_start_hour integer not null default 0 check(day_start_hour between 0 and 23),
 last_archived_date date,archive_checked_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(not enabled or enabled_from is not null)
);
create table public.newspaper_reports (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 report_date date not null check(isfinite(report_date)),status text not null check(status in ('draft','archived','reconstructed')),
 timezone text not null,day_start_hour integer not null check(day_start_hour between 0 and 23),
 current_revision integer not null check(current_revision>0),snapshot jsonb not null,
 search_text text generated always as (snapshot::text) stored,
 review jsonb,hidden_sections text[] not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,report_date),unique(id,user_id),
 check(jsonb_typeof(snapshot)='object' and snapshot->>'date' is not null and snapshot->>'date'=report_date::text),
 check(hidden_sections <@ array['chronicle','learning','finance','health','thoughts']::text[])
);
create index newspaper_reports_archive_idx on public.newspaper_reports(user_id,report_date desc);
create table public.newspaper_report_revisions (
 report_id uuid not null,user_id uuid not null,revision integer not null check(revision>0),
 snapshot jsonb not null,status text not null check(status in ('draft','archived','reconstructed')),
 created_at timestamptz not null default now(),primary key(report_id,revision),
 foreign key(report_id,user_id) references public.newspaper_reports(id,user_id) on delete cascade
);
create table public.newspaper_supplements (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 report_date date not null,body text not null check(length(btrim(body)) between 1 and 50000),occurred_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(user_id,report_date) references public.newspaper_reports(user_id,report_date) on delete cascade
);
create index newspaper_supplements_date_idx on public.newspaper_supplements(user_id,report_date);

-- Tables carry their owner even where a report parent exists, protecting joins and admin filters.
do $$ declare tbl text;begin
 foreach tbl in array array['newspaper_preferences','newspaper_reports','newspaper_report_revisions','newspaper_supplements'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated,vlife_agent_executor',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
  execute format('create policy newspaper_owner_read on public.%I for select to authenticated using (user_id=auth.uid() and (nullif(auth.jwt()->>''client_id'','''') is null or public.agent_permission(''read'')))',tbl);
 end loop;
 foreach tbl in array array['newspaper_preferences','newspaper_supplements'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',tbl);
  execute format('create policy newspaper_browser_insert on public.%I for insert to authenticated with check(user_id=auth.uid() and nullif(auth.jwt()->>''client_id'','''') is null)',tbl);
  execute format('create policy newspaper_browser_update on public.%I for update to authenticated using(user_id=auth.uid() and nullif(auth.jwt()->>''client_id'','''') is null) with check(user_id=auth.uid() and nullif(auth.jwt()->>''client_id'','''') is null)',tbl);
  execute format('create policy newspaper_browser_delete on public.%I for delete to authenticated using(user_id=auth.uid() and nullif(auth.jwt()->>''client_id'','''') is null)',tbl);
 end loop;
 foreach tbl in array array['newspaper_preferences','newspaper_reports','newspaper_supplements'] loop
  execute format('create trigger newspaper_updated_at before update on public.%I for each row execute function public.update_updated_at_column()',tbl);
 end loop;
end $$;

-- Image storage arrives in the next migration. Resolve it lazily without weakening RLS.
create or replace function public.newspaper_caption_matches(p_date date,p_query text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare matched boolean:=false;
begin
 if auth.uid() is null or not public.agent_permission('read') or to_regclass('public.newspaper_image_assets') is null then return false;end if;
 execute 'select exists(select 1 from public.newspaper_image_assets a where a.user_id=auth.uid() and a.report_date=$1 and position(lower($2) in lower(a.caption))>0)'
 into matched using p_date,p_query;
 return matched;
end $$;
create or replace function public.newspaper_search_reports(p_query text,p_date_from date default null,p_date_to date default null,p_limit integer default 20,p_offset integer default 0)
returns setof public.newspaper_reports language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.agent_permission('read') then raise insufficient_privilege using message='Report read permission required';end if;
 if p_query is null or length(p_query)>200 or p_limit is null or p_limit<1 or p_limit>200 or p_offset is null or p_offset<0
  or (p_date_from is not null and not isfinite(p_date_from)) or (p_date_to is not null and not isfinite(p_date_to)) then raise invalid_parameter_value using message='Invalid newspaper search';end if;
 return query select r.* from public.newspaper_reports r
 where r.user_id=auth.uid() and (p_date_from is null or r.report_date>=p_date_from) and (p_date_to is null or r.report_date<=p_date_to)
 and (position(lower(p_query) in lower(r.search_text))>0 or position(lower(p_query) in lower(coalesce(r.review::text,'')))>0
  or exists(select 1 from public.newspaper_supplements s where s.user_id=auth.uid() and s.user_id=r.user_id and s.report_date=r.report_date and position(lower(p_query) in lower(s.body))>0)
  or public.newspaper_caption_matches(r.report_date,p_query))
 order by r.report_date desc limit p_limit+1 offset p_offset;
end $$;
revoke all on function public.newspaper_caption_matches(date,text),public.newspaper_search_reports(text,date,date,integer,integer) from public,anon;
grant execute on function public.newspaper_caption_matches(date,text),public.newspaper_search_reports(text,date,date,integer,integer) to authenticated;

-- Atomically serialize refreshes, append the immutable revision, then advance the report pointer.
-- Only a trusted Edge Function or scheduled worker can call this function with an owner id.
create or replace function public.newspaper_save_snapshot(p_user_id uuid,p_date date,p_snapshot jsonb,p_status text,p_only_if_missing boolean default false)
returns public.newspaper_reports language plpgsql security definer set search_path='' as $$
declare current_report public.newspaper_reports;next_revision integer;
begin
 if p_user_id is null or p_date is null or not isfinite(p_date) or p_status not in ('draft','archived','reconstructed')
  or jsonb_typeof(p_snapshot) is distinct from 'object' or p_snapshot->>'date' is distinct from p_date::text
  or jsonb_typeof(p_snapshot->'sections') is distinct from 'array' or jsonb_typeof(p_snapshot->'coverage') is distinct from 'array'
  or nullif(p_snapshot->>'source_fingerprint','') is null or nullif(p_snapshot->>'timezone','') is null
  or not coalesce((p_snapshot->>'day_start_hour')::integer between 0 and 23,false) then raise invalid_parameter_value using message='Invalid report snapshot';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_snapshot->>'timezone') then raise invalid_parameter_value using message='Invalid report timezone';end if;
 if exists(select 1 from jsonb_array_elements(p_snapshot->'coverage') c where c->>'state' is distinct from 'ok') then raise invalid_parameter_value using message='Incomplete source coverage';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||':'||p_date::text,0));
 select * into current_report from public.newspaper_reports where user_id=p_user_id and report_date=p_date for update;
 if current_report.id is not null and p_only_if_missing and current_report.status<>'draft' then return current_report;end if;
 -- Preserve whether the first historical snapshot was automatic archival or reconstruction.
 if current_report.status in ('archived','reconstructed') then p_status:=current_report.status;end if;
 if current_report.id is not null and current_report.snapshot->>'source_fingerprint'=p_snapshot->>'source_fingerprint' and current_report.status=p_status then return current_report;end if;
 if current_report.id is not null and (current_report.timezone is distinct from p_snapshot->>'timezone' or current_report.day_start_hour is distinct from (p_snapshot->>'day_start_hour')::integer) then raise invalid_parameter_value using message='Historical report calendar cannot change';end if;
 next_revision:=coalesce(current_report.current_revision,0)+1;
 if current_report.id is null then
  insert into public.newspaper_reports(user_id,report_date,status,timezone,day_start_hour,current_revision,snapshot)
  values(p_user_id,p_date,p_status,p_snapshot->>'timezone',(p_snapshot->>'day_start_hour')::integer,next_revision,p_snapshot) returning * into current_report;
 else
  update public.newspaper_reports set status=p_status,current_revision=next_revision,snapshot=p_snapshot where id=current_report.id returning * into current_report;
 end if;
 insert into public.newspaper_report_revisions(report_id,user_id,revision,snapshot,status) values(current_report.id,p_user_id,next_revision,p_snapshot,p_status);
 return current_report;
end $$;
revoke all on function public.newspaper_save_snapshot(uuid,date,jsonb,text,boolean) from public,anon,authenticated,vlife_agent_executor;
grant execute on function public.newspaper_save_snapshot(uuid,date,jsonb,text,boolean) to service_role;

-- Durable text generation claims prevent retries from incurring a second charge.
create table public.newspaper_review_requests (
 user_id uuid not null references auth.users(id) on delete cascade,request_key text not null check(length(request_key) between 1 and 200),
 report_date date not null,status text not null default 'pending' check(status in ('pending','succeeded','failed','unknown')),review jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(user_id,request_key),
 foreign key(user_id,report_date) references public.newspaper_reports(user_id,report_date) on delete cascade
);
alter table public.newspaper_review_requests enable row level security;
revoke all on public.newspaper_review_requests from public,anon,authenticated,vlife_agent_executor;
grant all on public.newspaper_review_requests to service_role;
create or replace function public.newspaper_claim_review(p_user_id uuid,p_key text,p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.newspaper_review_requests;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('newspaper-review:'||p_user_id::text||':'||p_key,0));
 select * into old from public.newspaper_review_requests where user_id=p_user_id and request_key=p_key;
 if found then
  if old.report_date<>p_date then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('claimed',false,'status',old.status,'review',old.review);
 end if;
 insert into public.newspaper_review_requests(user_id,request_key,report_date) values(p_user_id,p_key,p_date);
 return jsonb_build_object('claimed',true,'status','pending');
end $$;
create or replace function public.newspaper_complete_review(p_user_id uuid,p_key text,p_review jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare request public.newspaper_review_requests;applied boolean;
begin
 select * into request from public.newspaper_review_requests where user_id=p_user_id and request_key=p_key for update;
 if not found or request.status not in ('pending','succeeded') then raise exception 'REVIEW_CLAIM_MISSING';end if;
 if request.status='succeeded' then return jsonb_build_object('applied',false,'review',request.review);end if;
 update public.newspaper_reports set review=p_review where user_id=p_user_id and report_date=request.report_date
  and current_revision=(p_review->>'source_revision')::integer and snapshot->>'source_fingerprint'=p_review->>'source_fingerprint';
 applied:=found;
 update public.newspaper_review_requests set status='succeeded',review=p_review,updated_at=now() where user_id=p_user_id and request_key=p_key;
 return jsonb_build_object('applied',applied,'review',p_review);
end $$;
revoke all on function public.newspaper_claim_review(uuid,text,date),public.newspaper_complete_review(uuid,text,jsonb) from public,anon,authenticated,vlife_agent_executor;
grant execute on function public.newspaper_claim_review(uuid,text,date),public.newspaper_complete_review(uuid,text,jsonb) to service_role;

-- Provision Vault secrets newspaper_project_url and newspaper_worker_secret after deployment.
-- The latter must match the Edge Function environment variable NEWSPAPER_WORKER_SECRET.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function public.invoke_newspaper_archive() returns void
language plpgsql security definer set search_path='' as $$
declare project_url text;worker_secret text;
begin
 select decrypted_secret into project_url from vault.decrypted_secrets where name='newspaper_project_url' limit 1;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='newspaper_worker_secret' limit 1;
 if project_url is null or worker_secret is null then return;end if;
 perform net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/newspaper-archive',headers:=jsonb_build_object('Content-Type','application/json','x-newspaper-worker-secret',worker_secret),body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function public.invoke_newspaper_archive() from public,anon,authenticated;
grant execute on function public.invoke_newspaper_archive() to service_role;
select cron.schedule('newspaper-hourly-archive','7 * * * *','select public.invoke_newspaper_archive();');
commit;
