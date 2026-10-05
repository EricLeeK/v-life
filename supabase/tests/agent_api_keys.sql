begin;
insert into auth.users(id) values ('ac000000-0000-4000-8000-000000000001'),('ac000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb; item jsonb; raw text; cid text; begin
 if to_regprocedure('public.agent_create_api_key(text,timestamptz,boolean,boolean,boolean)') is null then raise exception 'API key creation is not implemented'; end if;
 r:=public.agent_create_api_key('Hermes',null,true,true,false);raw:=r->>'api_key';cid:=r->>'client_id';
 if raw !~ '^vlife_[a-f0-9]{64}$' then raise exception 'key format or entropy missing';end if;
 select to_jsonb(a) into item from public.agent_client_access a where a.client_id=cid;
 if item->>'credential_type'<>'api_key' or item->>'expires_at' is not null then raise exception 'permanent key missing';end if;
 if item::text like '%'||raw||'%' then raise exception 'raw key persisted in public metadata';end if;
 perform set_config('test.key',raw,true);perform set_config('test.cid',cid,true);
 begin perform public.agent_create_api_key('past',now()-interval '1 second',true,false,false);raise exception 'expired key accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_create_api_key('empty',null,false,false,false);raise exception 'empty grant accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_resolve_api_key(repeat('a',64));raise exception 'browser may resolve hashes';exception when insufficient_privilege then null;end;
 begin perform 1 from agent_private.api_key_hashes;raise exception 'hashes exposed to browser';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ declare r jsonb;begin
 r:=public.agent_resolve_api_key(encode(sha256(convert_to(current_setting('test.key'),'UTF8')),'hex'));
 if r->>'user_id'<>'ac000000-0000-4000-8000-000000000001' then raise exception 'key lookup failed';end if;
 if public.agent_resolve_api_key(repeat('a',64)) is not null then raise exception 'unknown key accepted';end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','ac000000-0000-4000-8000-000000000001','role','authenticated','client_id',current_setting('test.cid'),'agent_key_id',current_setting('test.cid'))::text,true);
set local role authenticated;
do $$ declare r jsonb;begin
 if not public.agent_permission('read') or not public.agent_permission('write') or public.agent_permission('delete') then raise exception 'permissions incorrect';end if;
 r:=public.agent_mutate('todo','create',null,'{"title":"API key task"}', 'api-key-retry','key-test','todo_create');
 if r->'data'->>'id' is null then raise exception 'key does not use existing mutation RPC: %',r;end if;
 if public.agent_mutate('todo','create',null,'{"title":"API key task"}', 'api-key-retry','key-test','todo_create')->'data'->>'id'<>r->'data'->>'id' then raise exception 'key retry duplicated data';end if;
 if exists(select 1 from public.settings) then raise exception 'settings exposed to API key';end if;
 begin perform public.agent_create_api_key('escalate',null,true,true,true);raise exception 'agent created another key';exception when insufficient_privilege then null;end;
 begin perform public.agent_revoke_api_key(current_setting('test.cid'));raise exception 'agent may manage keys';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.agent_client_access set expires_at=now()-interval '1 second' where client_id=current_setting('test.cid');
set local role authenticated;
do $$ declare r jsonb;begin
 if public.agent_permission('read') or public.agent_permission('write') then raise exception 'expiry ignored by RLS';end if;
 if exists(select 1 from public.todos where title='API key task') then raise exception 'expired key reads rows';end if;
 r:=public.agent_mutate('todo','create',null,'{"title":"expired"}');if r->'error'->>'code'<>'PERMISSION_DENIED' then raise exception 'expired key writes';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.agent_revoke_api_key(current_setting('test.cid'));raise exception 'cross-user revoke allowed';exception when no_data_found then null;end;
 if exists(select 1 from public.agent_client_access where client_id=current_setting('test.cid')) then raise exception 'cross-user key metadata exposed';end if;
end $$;
reset role;
update public.agent_client_access set expires_at=null where client_id=current_setting('test.cid');
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.agent_revoke_api_key(current_setting('test.cid'));
select public.agent_revoke_api_key(current_setting('test.cid')); -- retry is safe
reset role;
set local role service_role;
do $$ begin
 if public.agent_resolve_api_key(encode(sha256(convert_to(current_setting('test.key'),'UTF8')),'hex')) is not null then raise exception 'revoked key accepted';end if;
end $$;
reset role;
rollback;
