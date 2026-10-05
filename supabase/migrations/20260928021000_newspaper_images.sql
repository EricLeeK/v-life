-- Independent BYOK image settings. API credentials and upstream results never have client grants.
create table public.newspaper_image_styles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 1 and 80), prompt_template text not null check(length(prompt_template) between 1 and 16000),
  is_default boolean not null default false, provider text check(provider in ('grsai','openai','gemini')),model text,size text,quality text,aspect_ratio text,
  reference_images jsonb not null default '[]' check(jsonb_typeof(reference_images)='array' and jsonb_array_length(reference_images)<=14),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index newspaper_image_default_style on public.newspaper_image_styles(user_id) where is_default;
create table public.newspaper_image_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check(provider in ('grsai','openai','gemini')),model text not null,size text not null,quality text not null,aspect_ratio text not null,
  base_url text not null,configured boolean not null default false,key_hint text,updated_at timestamptz not null default now()
);
create table public.newspaper_image_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,provider text not null check(provider in ('grsai','openai','gemini')),
  api_key text not null check(length(api_key) between 8 and 4096),updated_at timestamptz not null default now(),primary key(user_id,provider)
);
create table public.newspaper_image_slots (
  user_id uuid not null references auth.users(id) on delete cascade,report_date date not null,
  section_id text not null check(section_id in ('main','chronicle','learning','finance','health','thoughts')),generation bigint not null default 0,
  primary key(user_id,report_date,section_id),foreign key(user_id,report_date) references public.newspaper_reports(user_id,report_date) on delete cascade
);
create table public.newspaper_image_jobs (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,section_id text not null check(section_id in ('main','chronicle','learning','finance','health','thoughts')),
  status text not null default 'queued' check(status in ('queued','submitting','running','saving','succeeded','failed','unknown')),
  idempotency_key text not null check(length(idempotency_key) between 1 and 200),request_hash text not null,
  prompt text not null,style_snapshot jsonb,options jsonb not null,source_revision integer not null,reference_images jsonb not null default '[]',base_url text not null,
  generation bigint not null,provider_job_id text,provider_result jsonb,asset_id uuid,error text,
  lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz not null default now(),attempts integer not null default 0,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key),foreign key(user_id,report_date) references public.newspaper_reports(user_id,report_date) on delete cascade
);
create index newspaper_image_jobs_due on public.newspaper_image_jobs(next_attempt_at) where status in ('queued','submitting','running','saving');
create table public.newspaper_image_assets (
  id uuid primary key default gen_random_uuid(),job_id uuid not null unique references public.newspaper_image_jobs(id),user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,section_id text not null,storage_path text not null,thumbnail_path text not null,
  width integer not null check(width between 1 and 16384),height integer not null check(height between 1 and 16384),caption text not null default '' check(length(caption)<=2000),
  active boolean not null default false,prompt text not null,style_snapshot jsonb,options jsonb not null,source_revision integer not null,created_at timestamptz not null default now(),
  foreign key(user_id,report_date) references public.newspaper_reports(user_id,report_date) on delete cascade,
  check(storage_path<>thumbnail_path)
);
create unique index newspaper_image_active_asset on public.newspaper_image_assets(user_id,report_date,section_id) where active;
-- Client SELECT is limited to safe job columns; upstream URLs/base64 are service-only.
revoke all on public.newspaper_image_secrets,public.newspaper_image_slots,public.newspaper_image_jobs,public.newspaper_image_assets,public.newspaper_image_styles,public.newspaper_image_configs from public,anon,authenticated,vlife_agent_executor;
grant select on public.newspaper_image_styles,public.newspaper_image_configs,public.newspaper_image_assets to authenticated;
grant select(id,user_id,report_date,section_id,status,error,asset_id,created_at,updated_at) on public.newspaper_image_jobs to authenticated;
grant all on public.newspaper_image_styles,public.newspaper_image_configs,public.newspaper_image_secrets,public.newspaper_image_slots,public.newspaper_image_jobs,public.newspaper_image_assets to service_role;
do $$ declare t text;begin
  foreach t in array array['newspaper_image_styles','newspaper_image_configs','newspaper_image_secrets','newspaper_image_slots','newspaper_image_jobs','newspaper_image_assets'] loop
    execute format('alter table public.%I enable row level security',t);
    if t not in ('newspaper_image_secrets','newspaper_image_slots') then execute format('create policy owner_read on public.%I for select to authenticated using (user_id=auth.uid() and public.agent_permission(''read''))',t);end if;
  end loop;
end $$;

create or replace function public.newspaper_image_config_set(p_user_id uuid,p_config jsonb,p_api_key text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare hint text;ready boolean;result jsonb;begin
  if p_api_key is not null then
    insert into newspaper_image_secrets(user_id,provider,api_key) values(p_user_id,p_config->>'provider',p_api_key)
    on conflict(user_id,provider) do update set api_key=excluded.api_key,updated_at=now();
  end if;
  select '••••'||right(api_key,4),true into hint,ready from newspaper_image_secrets where user_id=p_user_id and provider=p_config->>'provider';
  insert into newspaper_image_configs(user_id,provider,model,size,quality,aspect_ratio,base_url,configured,key_hint)
  values(p_user_id,p_config->>'provider',p_config->>'model',p_config->>'size',p_config->>'quality',p_config->>'aspect_ratio',p_config->>'base_url',coalesce(ready,false),hint)
  on conflict(user_id) do update set provider=excluded.provider,model=excluded.model,size=excluded.size,quality=excluded.quality,aspect_ratio=excluded.aspect_ratio,base_url=excluded.base_url,configured=excluded.configured,key_hint=excluded.key_hint,updated_at=now()
  returning to_jsonb(newspaper_image_configs)-'user_id' into result;
  return result;
end $$;
create or replace function public.newspaper_image_style_save(p_user_id uuid,p_style jsonb,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid:=coalesce((p_style->>'id')::uuid,gen_random_uuid());result jsonb;begin
  perform pg_advisory_xact_lock(hashtextextended('newspaper-style:'||p_user_id::text,0));
  if p_style->>'id' is not null then
    perform 1 from newspaper_image_styles where id=target and user_id=p_user_id and (p_expected_updated_at is null or updated_at=p_expected_updated_at) for update;
    if not found then raise exception 'STYLE_CONFLICT';end if;
  end if;
  if coalesce((p_style->>'is_default')::boolean,false) then update newspaper_image_styles set is_default=false,updated_at=now() where user_id=p_user_id and is_default and id<>target;end if;
  insert into newspaper_image_styles(id,user_id,name,prompt_template,is_default,provider,model,size,quality,aspect_ratio,reference_images)
  values(target,p_user_id,p_style->>'name',p_style->>'prompt_template',coalesce((p_style->>'is_default')::boolean,false),p_style->>'provider',p_style->>'model',p_style->>'size',p_style->>'quality',p_style->>'aspect_ratio',coalesce(p_style->'reference_images','[]'))
  on conflict(id) do update set name=excluded.name,prompt_template=excluded.prompt_template,is_default=excluded.is_default,provider=excluded.provider,model=excluded.model,size=excluded.size,quality=excluded.quality,aspect_ratio=excluded.aspect_ratio,reference_images=excluded.reference_images,updated_at=now()
  returning to_jsonb(newspaper_image_styles)-'user_id' into result;
  return result;
end $$;
create or replace function public.newspaper_image_enqueue(p_user_id uuid,p_key text,p_hash text,p_date date,p_section text,p_prompt text,p_style jsonb,p_options jsonb,p_revision integer,p_refs jsonb,p_base_url text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare old newspaper_image_jobs;result jsonb;gen bigint;begin
  perform pg_advisory_xact_lock(hashtextextended('newspaper-image:'||p_user_id::text||':'||p_key,0));
  select * into old from newspaper_image_jobs where user_id=p_user_id and idempotency_key=p_key;
  if found then if old.request_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT';end if;return to_jsonb(old);end if;
  if not exists(select 1 from newspaper_reports where user_id=p_user_id and report_date=p_date) then raise exception 'REPORT_NOT_FOUND';end if;
  insert into newspaper_image_slots(user_id,report_date,section_id,generation) values(p_user_id,p_date,p_section,1)
  on conflict(user_id,report_date,section_id) do update set generation=newspaper_image_slots.generation+1 returning generation into gen;
  insert into newspaper_image_jobs(user_id,idempotency_key,request_hash,report_date,section_id,prompt,style_snapshot,options,source_revision,reference_images,base_url,generation)
  values(p_user_id,p_key,p_hash,p_date,p_section,p_prompt,p_style,p_options,p_revision,p_refs,p_base_url,gen) returning to_jsonb(newspaper_image_jobs) into result;
  return result;
end $$;
create or replace function public.newspaper_image_claim(p_limit integer default 2) returns setof public.newspaper_image_jobs
language plpgsql security definer set search_path=public,pg_temp as $$ begin
  -- A crashed submission cannot be repeated safely without an upstream task identifier.
  update newspaper_image_jobs set status='unknown',error='提交结果暂不确定，请核对供应商记录；系统不会自动重复扣费。',lease_token=null,lease_until=null,updated_at=now()
  where status='submitting' and provider_job_id is null and lease_until<now();
  return query with claimed as (
    select id from newspaper_image_jobs where status in ('queued','running','saving') and next_attempt_at<=now() and (lease_until is null or lease_until<now())
    order by next_attempt_at,created_at for update skip locked limit greatest(1,least(p_limit,5))
  ) update newspaper_image_jobs j set lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=j.attempts+1,updated_at=now() from claimed where j.id=claimed.id returning j.*;
end $$;
create or replace function public.newspaper_image_checkpoint(p_id uuid,p_lease uuid,p_status text,p_provider_id text default null,p_result jsonb default null,p_error text default null,p_delay integer default 30) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$ begin
  if p_status not in ('submitting','running','saving','failed','unknown') then raise exception 'INVALID_JOB_STATE';end if;
  update newspaper_image_jobs set status=p_status,provider_job_id=coalesce(p_provider_id,provider_job_id),provider_result=coalesce(p_result,provider_result),error=p_error,
    next_attempt_at=now()+make_interval(secs=>greatest(0,p_delay)),updated_at=now(),
    lease_until=case when p_status in ('submitting','saving') and p_delay=0 then lease_until else null end,
    lease_token=case when p_status in ('submitting','saving') and p_delay=0 then lease_token else null end
  where id=p_id and lease_token=p_lease and lease_until>now() and status in ('queued','submitting','running','saving');return found;
end $$;
create or replace function public.newspaper_image_finish(p_id uuid,p_lease uuid,p_path text,p_thumbnail text,p_width integer,p_height integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j newspaper_image_jobs;result jsonb;selected boolean;asset uuid;begin
  select * into j from newspaper_image_jobs where id=p_id for update;
  if not found then raise exception 'JOB_NOT_FOUND';end if;
  if j.status='succeeded' then select to_jsonb(a) into result from newspaper_image_assets a where id=j.asset_id;return result;end if;
  if j.status<>'saving' or j.lease_token is distinct from p_lease or j.lease_until<now() then raise exception 'LEASE_LOST';end if;
  if p_path not like j.user_id::text||'/originals/%' or p_thumbnail not like j.user_id::text||'/thumbnails/%' then raise exception 'INVALID_STORAGE_PATH';end if;
  select generation=j.generation into selected from newspaper_image_slots where user_id=j.user_id and report_date=j.report_date and section_id=j.section_id for update;
  if selected then update newspaper_image_assets set active=false where user_id=j.user_id and report_date=j.report_date and section_id=j.section_id and active;end if;
  insert into newspaper_image_assets(job_id,user_id,report_date,section_id,storage_path,thumbnail_path,width,height,active,prompt,style_snapshot,options,source_revision)
  values(j.id,j.user_id,j.report_date,j.section_id,p_path,p_thumbnail,p_width,p_height,coalesce(selected,false),j.prompt,j.style_snapshot,j.options,j.source_revision) returning id,to_jsonb(newspaper_image_assets) into asset,result;
  update newspaper_image_jobs set status='succeeded',asset_id=asset,provider_result=null,lease_token=null,lease_until=null,error=null,updated_at=now() where id=j.id;
  return result;
end $$;
create or replace function public.newspaper_image_select(p_user_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a newspaper_image_assets;result jsonb;begin
  select * into a from newspaper_image_assets where id=p_id and user_id=p_user_id;
  if not found then raise exception 'NOT_FOUND';end if;
  update newspaper_image_slots set generation=generation+1 where user_id=p_user_id and report_date=a.report_date and section_id=a.section_id;
  update newspaper_image_assets set active=false where user_id=p_user_id and report_date=a.report_date and section_id=a.section_id and active;
  update newspaper_image_assets set active=true where id=a.id returning to_jsonb(newspaper_image_assets) into result;return result;
end $$;
-- All mutation/worker RPCs are exclusively callable by authenticated server entrypoints.
do $$ declare r record;begin
  for r in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('newspaper_image_config_set','newspaper_image_style_save','newspaper_image_enqueue','newspaper_image_claim','newspaper_image_checkpoint','newspaper_image_finish','newspaper_image_select') loop
    execute format('revoke all on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('newspaper-images','newspaper-images',false,25165824,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy newspaper_image_read on storage.objects for select to authenticated using(bucket_id='newspaper-images' and (storage.foldername(name))[1]=auth.uid()::text and public.agent_permission('read'));
-- Upload and deletion use authenticated Edge functions with user-specific server-built paths.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('newspaper-images-worker','* * * * *',$cron$
  select net.http_post(
    url:=rtrim((select decrypted_secret from vault.decrypted_secrets where name='newspaper_project_url' limit 1),'/')||'/functions/v1/newspaper-images-worker',
    headers:=jsonb_build_object('Content-Type','application/json','x-newspaper-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='newspaper_worker_secret' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=120000
  ) where exists(select 1 from vault.decrypted_secrets where name='newspaper_project_url') and exists(select 1 from vault.decrypted_secrets where name='newspaper_worker_secret');
$cron$);
