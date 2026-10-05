begin;

alter table public.agent_client_access
  add column credential_type text not null default 'oauth' check (credential_type in ('oauth','api_key')),
  add column expires_at timestamptz check (expires_at is null or isfinite(expires_at)),
  add column key_prefix text;

-- Only hashes live here; neither browsers nor agents can read this schema.
create table agent_private.api_key_hashes (
  user_id uuid not null,
  client_id text not null,
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  primary key (user_id,client_id),
  foreign key (user_id,client_id) references public.agent_client_access(user_id,client_id) on delete cascade
);
revoke all on agent_private.api_key_hashes from public,anon,authenticated,service_role;

create or replace function public.agent_create_api_key(
  p_name text, p_expires_at timestamptz default null,
  p_read_enabled boolean default true, p_write_enabled boolean default false, p_delete_enabled boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid text:='key_'||gen_random_uuid()::text; raw_key text; metadata jsonb;
begin
  if uid is null or nullif(auth.jwt()->>'client_id','') is not null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise insufficient_privilege;end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80
    or (p_expires_at is not null and (not isfinite(p_expires_at) or p_expires_at<=clock_timestamp()))
    or p_read_enabled is null or p_write_enabled is null or p_delete_enabled is null
    or not (p_read_enabled or p_write_enabled or p_delete_enabled) then
    raise exception using errcode='22023',message='INVALID_KEY_OPTIONS';
  end if;
  -- Serialize creation per owner and cap live keys to avoid accidental unbounded issuance.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,9182));
  if (select count(*) from public.agent_client_access where user_id=uid and credential_type='api_key' and revoked_at is null and (expires_at is null or expires_at>now()))>=50 then
    raise exception using errcode='22023',message='API_KEY_LIMIT_REACHED';
  end if;
  -- Two cryptographically random UUIDs supply 244 random bits. No pgcrypto dependency.
  raw_key:='vlife_'||replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into public.agent_client_access(user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled,credential_type,expires_at,key_prefix)
    values(uid,cid,btrim(p_name),p_read_enabled,p_write_enabled,p_delete_enabled,'api_key',p_expires_at,left(raw_key,14))
    returning to_jsonb(agent_client_access.*) into metadata;
  insert into agent_private.api_key_hashes values(uid,cid,encode(sha256(convert_to(raw_key,'UTF8')),'hex'));
  return metadata||jsonb_build_object('api_key',raw_key);
end $$;
revoke all on function public.agent_create_api_key(text,timestamptz,boolean,boolean,boolean) from public,anon;
grant execute on function public.agent_create_api_key(text,timestamptz,boolean,boolean,boolean) to authenticated;

create or replace function public.agent_revoke_api_key(p_client_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or nullif(auth.jwt()->>'client_id','') is not null then raise insufficient_privilege;end if;
  update public.agent_client_access set revoked_at=coalesce(revoked_at,clock_timestamp()),read_enabled=false,write_enabled=false,delete_enabled=false
    where user_id=auth.uid() and client_id=p_client_id and credential_type='api_key';
  if not found then raise no_data_found;end if;
  -- Removing the digest makes revocation irreversible even if someone edits metadata.
  delete from agent_private.api_key_hashes where user_id=auth.uid() and client_id=p_client_id;
end $$;
revoke all on function public.agent_revoke_api_key(text) from public,anon;
grant execute on function public.agent_revoke_api_key(text) to authenticated;

-- Only the Edge server may resolve a hash. It never receives a user's browser session.
create or replace function public.agent_resolve_api_key(p_key_hash text)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('user_id',a.user_id,'client_id',a.client_id,
    'read_enabled',a.read_enabled,'write_enabled',a.write_enabled,'delete_enabled',a.delete_enabled,
    'expires_at',a.expires_at,'revoked_at',a.revoked_at)
  from agent_private.api_key_hashes k join public.agent_client_access a using(user_id,client_id)
  where k.key_hash=p_key_hash and a.credential_type='api_key' and a.revoked_at is null
    and (a.expires_at is null or a.expires_at>clock_timestamp());
$$;
revoke all on function public.agent_resolve_api_key(text) from public,anon,authenticated;
grant execute on function public.agent_resolve_api_key(text) to service_role;

-- Existing RPCs and every restrictive RLS policy share this live check. Short internal
-- tokens cannot keep accessing data after key revocation or its configured expiration.
create or replace function public.agent_permission(p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
  select case when nullif(auth.jwt()->>'client_id','') is null then true else exists(
    select 1 from public.agent_client_access a where a.user_id=auth.uid()
      and a.client_id=auth.jwt()->>'client_id' and a.revoked_at is null
      and (a.expires_at is null or a.expires_at>statement_timestamp())
      and (a.credential_type='oauth' or (auth.jwt()->>'agent_key_id'=a.client_id and exists(
        select 1 from agent_private.api_key_hashes k where k.user_id=a.user_id and k.client_id=a.client_id)))
      and case p_operation when 'read' then a.read_enabled when 'write' then a.write_enabled
        when 'delete' then a.delete_enabled else false end
  ) end;
$$;
revoke all on function public.agent_permission(text) from public,anon;
grant execute on function public.agent_permission(text) to authenticated;

commit;
