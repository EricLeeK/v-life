-- Revision history and a narrowly scoped, revocable V-记 connection.
create table public.prep_content_versions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 entity text not null check(entity in ('question','material')),entity_id uuid not null,revision integer not null,
 content jsonb not null,created_at timestamptz not null default now(),unique(user_id,entity,entity_id,revision)
);
alter table public.prep_content_versions enable row level security;
revoke all on public.prep_content_versions from anon,authenticated;
grant select on public.prep_content_versions to authenticated;
grant all on public.prep_content_versions to service_role;
create policy owner_read on public.prep_content_versions for select to authenticated using(user_id=(select auth.uid()));
create function prep_private.save_content_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.prep_content_versions(user_id,entity,entity_id,revision,content)
 values(new.user_id,case when TG_TABLE_NAME='prep_questions' then 'question' else 'material' end,new.id,new.revision,to_jsonb(new)) on conflict do nothing;
 return new;
end $$;
revoke all on function prep_private.save_content_version() from public,anon,authenticated;
create trigger prep_question_history after insert or update on public.prep_questions for each row execute function prep_private.save_content_version();
create trigger prep_material_history after insert or update on public.prep_materials for each row execute function prep_private.save_content_version();
insert into public.prep_content_versions(user_id,entity,entity_id,revision,content) select user_id,'question',id,revision,to_jsonb(q) from public.prep_questions q;
insert into public.prep_content_versions(user_id,entity,entity_id,revision,content) select user_id,'material',id,revision,to_jsonb(m) from public.prep_materials m;

-- Normal client edits must use the revision-checked operation. The function has
-- explicit ownership checks; its privilege is for this one UPDATE, not arbitrary SQL.
revoke update on public.prep_questions,public.prep_materials from authenticated;
alter function public.prep_edit_question(uuid,integer,jsonb) security definer;
create function public.prep_edit_material(p_material_id uuid,p_expected_revision integer,p_content_md text,p_title text) returns public.prep_materials
language plpgsql security definer set search_path='' as $$
declare m public.prep_materials; begin
 if auth.uid() is null or not public.agent_permission('write') then raise exception 'unauthorized' using errcode='42501'; end if;
 select * into m from public.prep_materials where id=p_material_id and user_id=auth.uid() for update;
 if not found then raise exception 'material not found' using errcode='P0002'; end if;
 if m.revision is distinct from p_expected_revision then raise exception 'material revision conflict' using errcode='40001'; end if;
 update public.prep_materials set content_md=coalesce(p_content_md,m.content_md),title=coalesce(p_title,m.title) where id=m.id returning * into m;return m;
end $$;
revoke all on function public.prep_edit_material(uuid,integer,text,text) from public,anon;
grant execute on function public.prep_edit_material(uuid,integer,text,text) to authenticated;

create table prep_private.connections (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),name text not null default 'V 记',
 created_at timestamptz not null default now(),revoked_at timestamptz,last_used_at timestamptz
);
grant usage on schema prep_private to service_role;
grant all on prep_private.connections to service_role;
create function public.prep_connection_create(p_user_id uuid,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 update prep_private.connections set revoked_at=now() where user_id=p_user_id and revoked_at is null;
 insert into prep_private.connections(user_id,token_hash) values(p_user_id,p_hash) returning id into v_id;return v_id;
end $$;
create function public.prep_connection_resolve(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid;begin
 update prep_private.connections set last_used_at=now() where token_hash=p_hash and revoked_at is null returning user_id into v_user;return v_user;
end $$;
create function public.prep_connection_list() returns table(id uuid,name text,created_at timestamptz,revoked_at timestamptz,last_used_at timestamptz)
language sql security definer set search_path='' as $$select id,name,created_at,revoked_at,last_used_at from prep_private.connections where user_id=auth.uid() and public.agent_permission('read') order by created_at desc$$;
create function public.prep_connection_revoke(p_id uuid) returns void language sql security definer set search_path='' as $$update prep_private.connections set revoked_at=now() where id=p_id and user_id=auth.uid() and public.agent_permission('write')$$;
revoke all on function public.prep_connection_create(uuid,text),public.prep_connection_resolve(text),public.prep_connection_list(),public.prep_connection_revoke(uuid) from public,anon,authenticated;
grant execute on function public.prep_connection_create(uuid,text),public.prep_connection_resolve(text) to service_role;
grant execute on function public.prep_connection_list(),public.prep_connection_revoke(uuid) to authenticated;

-- Only a verified bridge server can establish the acting identity for a scoped edit.
create function public.prep_bridge_edit(p_user_id uuid,p_id uuid,p_revision integer,p_patch jsonb) returns public.prep_questions
language plpgsql security definer set search_path='' as $$
begin
 perform set_config('request.jwt.claim.sub',p_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user_id,'role','authenticated')::text,true);
 return public.prep_edit_question(p_id,p_revision,p_patch);
end $$;
revoke all on function public.prep_bridge_edit(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.prep_bridge_edit(uuid,uuid,integer,jsonb) to service_role;

-- Prevent a client-owned asset row from naming another owner's storage object.
alter table public.prep_assets add constraint prep_asset_owned_path check(storage_path is null or split_part(storage_path,'/',1)=user_id::text);

-- OAuth/API-key scoped clients cannot bypass transport permissions through PostgREST.
do $$ declare t text;begin
 foreach t in array array['exams','banks','materials','questions','exam_banks','bank_questions','exam_questions','review_states','attempts','papers','paper_questions','assets','note_links','pitfalls','pitfall_questions','content_versions'] loop
 execute format('create policy prep_scope_read on public.prep_%I as restrictive for select to authenticated using(public.agent_permission(''read''))',t);
 execute format('create policy prep_scope_insert on public.prep_%I as restrictive for insert to authenticated with check(public.agent_permission(''write''))',t);
 execute format('create policy prep_scope_update on public.prep_%I as restrictive for update to authenticated using(public.agent_permission(''write'')) with check(public.agent_permission(''write''))',t);
 execute format('create policy prep_scope_delete on public.prep_%I as restrictive for delete to authenticated using(public.agent_permission(''delete''))',t);
 end loop;
end $$;

-- Drafts may be incomplete; active questions must be answerable on both clients.
create function public.prep_validate_active() returns trigger language plpgsql set search_path='' as $$
declare a text;begin
 if new.status<>'active' then return new;end if;
 if length(trim(new.stem_md))=0 or new.correct_answer is null or new.correct_answer in ('null'::jsonb,'""'::jsonb,'[]'::jsonb) then raise exception 'active question requires a stem and answer' using errcode='22023';end if;
 if new.question_type<>'text' then
  if jsonb_array_length(new.options)<2 then raise exception 'choice question requires at least two options' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(new.options) o where length(trim(o->>'content_md'))=0) then raise exception 'choice option content is missing' using errcode='22023';end if;
  for a in select jsonb_array_elements_text(case when jsonb_typeof(new.correct_answer)='array' then new.correct_answer else jsonb_build_array(new.correct_answer) end) loop
   if not exists(select 1 from jsonb_array_elements(new.options) o where o->>'key'=a) then raise exception 'answer key does not match any option' using errcode='22023';end if;
  end loop;
  if new.question_type in ('single','judgement') and jsonb_typeof(new.correct_answer)='array' and jsonb_array_length(new.correct_answer)<>1 then raise exception 'single choice requires one answer' using errcode='22023';end if;
 end if;return new;
end $$;
create trigger prep_validate_active before insert or update on public.prep_questions for each row execute function public.prep_validate_active();
