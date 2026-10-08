-- Generic preparation workspace. Existing civil data is copied, never removed.
-- Composite foreign keys enforce tenant isolation even for privileged server writes.
create table public.prep_exams (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), exam_date date not null, template text check(template is null or template='civil'), is_primary boolean not null default false, is_archived boolean not null default false, notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_banks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), description_md text not null default '', is_archived boolean not null default false, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_materials (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default '', content_md text not null default '', revision integer not null default 1 check(revision>0), metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_questions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 stem_md text not null default '', question_type text not null default 'text' check(question_type in ('single','multiple','judgement','text')),
 options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'), correct_answer jsonb,
 explanation_md text not null default '', analysis_md text not null default '', tags text[] not null default '{}',
 target_seconds integer check(target_seconds>0), material_id uuid,
 revision integer not null default 1 check(revision>0), status text not null default 'active' check(status in ('draft','active','archived')),
 metadata jsonb not null default '{}'::jsonb,
 foreign key(user_id,material_id) references public.prep_materials(user_id,id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_exam_banks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 exam_id uuid not null,bank_id uuid not null,unique(user_id,exam_id,bank_id),foreign key(user_id,exam_id) references public.prep_exams(user_id,id) on delete cascade,foreign key(user_id,bank_id) references public.prep_banks(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_bank_questions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 bank_id uuid not null,question_id uuid not null,unique(user_id,bank_id,question_id),foreign key(user_id,bank_id) references public.prep_banks(user_id,id) on delete cascade,foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_exam_questions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 exam_id uuid not null,question_id uuid not null, mode text not null default 'include' check(mode in ('include','exclude')),unique(user_id,exam_id,question_id),foreign key(user_id,exam_id) references public.prep_exams(user_id,id) on delete cascade,foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_review_states (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid not null,fsrs jsonb not null default '{}'::jsonb,due_at timestamptz not null default now(),revision integer not null default 0 check(revision>=0),paused boolean not null default false,unique(user_id,question_id),foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid not null, exam_id uuid, idempotency_key uuid not null,
 answer jsonb, duration_seconds integer check(duration_seconds>=0),correct boolean,yellow boolean not null default false,
 reason_tags text[] not null default '{}',content_revision integer not null check(content_revision>0),
 mode text not null check(mode in ('practice','review')),rating integer check(rating between 1 and 4),
 unique(user_id,idempotency_key),foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,foreign key(user_id,exam_id) references public.prep_exams(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_papers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null default '',exam_id uuid,taken_date date not null default current_date,source text not null default '',is_mock boolean not null default false,sections jsonb not null default '[]'::jsonb check(jsonb_typeof(sections)='array'),total_questions integer check(total_questions>=0),total_correct integer check(total_correct>=0),duration_minutes integer check(duration_minutes>=0),total_score numeric,notes text,metadata jsonb not null default '{}'::jsonb,foreign key(user_id,exam_id) references public.prep_exams(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_paper_questions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 paper_id uuid not null,question_id uuid not null,source_number text not null default '',section_key text,unique(user_id,paper_id,question_id),foreign key(user_id,paper_id) references public.prep_papers(user_id,id) on delete cascade,foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_assets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid,material_id uuid,paper_id uuid,storage_path text,url text,sha256 text,mime_type text,metadata jsonb not null default '{}'::jsonb,check(num_nonnulls(question_id,material_id,paper_id)=1),foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,foreign key(user_id,material_id) references public.prep_materials(user_id,id) on delete cascade,foreign key(user_id,paper_id) references public.prep_papers(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_note_links (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid not null,note_id uuid not null,unique(user_id,question_id,note_id),foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_pitfalls (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,content_md text not null default '',tags text[] not null default '{}',is_archived boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.prep_pitfall_questions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 pitfall_id uuid not null,question_id uuid not null,unique(user_id,pitfall_id,question_id),foreign key(user_id,pitfall_id) references public.prep_pitfalls(user_id,id) on delete cascade,foreign key(user_id,question_id) references public.prep_questions(user_id,id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);

-- Explicit grants avoid project-dependent default privilege surprises.
do $$ declare t text; begin
 foreach t in array array['exams','banks','materials','questions','exam_banks','bank_questions','exam_questions','review_states','attempts','papers','paper_questions','assets','note_links','pitfalls','pitfall_questions'] loop
 execute format('alter table public.prep_%I enable row level security',t);
 execute format('revoke all on public.prep_%I from anon,authenticated',t);
 execute format('grant select on public.prep_%I to authenticated',t);
 execute format('grant all on public.prep_%I to service_role',t);
 execute format('create policy owner_select on public.prep_%I for select to authenticated using ((select auth.uid())=user_id)',t);
 if t not in ('attempts','review_states') then
 execute format('grant insert,update,delete on public.prep_%I to authenticated',t);
 execute format('create policy owner_insert on public.prep_%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
 execute format('create policy owner_update on public.prep_%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('create policy owner_delete on public.prep_%I for delete to authenticated using ((select auth.uid())=user_id)',t);
 end if;
 end loop;
end $$;
grant update(paused) on public.prep_review_states to authenticated;
create policy owner_pause on public.prep_review_states for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index prep_review_due on public.prep_review_states(user_id,due_at) where not paused;
create index prep_attempt_history on public.prep_attempts(user_id,question_id,created_at desc);
create index prep_question_tags on public.prep_questions using gin(tags);
create index prep_exam_banks_bank on public.prep_exam_banks(user_id,bank_id);
create index prep_bank_questions_question on public.prep_bank_questions(user_id,question_id);

create function public.prep_touch() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['exams','banks','materials','questions','exam_banks','bank_questions','exam_questions','review_states','papers','paper_questions','assets','note_links','pitfalls','pitfall_questions'] loop
 execute format('create trigger prep_touch before update on public.prep_%I for each row execute function public.prep_touch()',t);
 end loop; end $$;

create function public.prep_question_revision() returns trigger language plpgsql set search_path='' as $$
declare opt jsonb; keys text[]='{}'; begin
 for opt in select value from jsonb_array_elements(new.options) loop
 if jsonb_typeof(opt)<>'object' or jsonb_typeof(opt->'key') is distinct from 'string' or jsonb_typeof(opt->'content_md') is distinct from 'string' or length(trim(opt->>'key'))=0 or (opt->>'key')=any(keys) then
 raise exception 'options require unique key and content_md strings' using errcode='22023'; end if;
 keys=array_append(keys,opt->>'key'); end loop;
 if TG_OP='INSERT' then new.revision=1;
 else
 new.revision=old.revision;
 if row(new.stem_md,new.question_type,new.options,new.correct_answer,new.explanation_md,new.analysis_md,new.material_id,new.tags,new.target_seconds,new.status,new.metadata) is distinct from row(old.stem_md,old.question_type,old.options,old.correct_answer,old.explanation_md,old.analysis_md,old.material_id,old.tags,old.target_seconds,old.status,old.metadata) then new.revision=old.revision+1; end if;
 end if; return new;
end $$;
create trigger prep_question_revision before insert or update on public.prep_questions for each row execute function public.prep_question_revision();
create function public.prep_material_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision; if row(new.content_md,new.title) is distinct from row(old.content_md,old.title) then new.revision=old.revision+1; end if; return new; end $$;
create trigger prep_material_revision before update on public.prep_materials for each row execute function public.prep_material_revision();
-- Shared material edits change the effective question content revision as well.
create function public.prep_material_changed() returns trigger language plpgsql set search_path='' as $$
begin
 if new.revision<>old.revision then
 update public.prep_questions set metadata=jsonb_set(metadata,'{material_revision}',to_jsonb(new.revision)) where user_id=new.user_id and material_id=new.id;
 end if; return new;
end $$;
-- metadata revision is incorporated below by the question revision trigger.
create trigger prep_material_changed after update on public.prep_materials for each row execute function public.prep_material_changed();

create function public.prep_exam_question_ids(p_exam_id uuid) returns table(question_id uuid)
language sql stable security invoker set search_path='' as $$
 select q.id from public.prep_questions q where q.user_id=auth.uid() and q.status='active'
 and exists(select 1 from public.prep_exams e where e.id=p_exam_id and e.user_id=q.user_id)
 and (exists(select 1 from public.prep_exam_questions x where x.user_id=q.user_id and x.exam_id=p_exam_id and x.question_id=q.id and x.mode='include')
 or exists(select 1 from public.prep_exam_banks eb join public.prep_bank_questions bq on bq.user_id=eb.user_id and bq.bank_id=eb.bank_id join public.prep_banks b on b.id=eb.bank_id and b.user_id=eb.user_id where eb.user_id=q.user_id and eb.exam_id=p_exam_id and bq.question_id=q.id and not b.is_archived))
 and not exists(select 1 from public.prep_exam_questions x where x.user_id=q.user_id and x.exam_id=p_exam_id and x.question_id=q.id and x.mode='exclude');
$$;
revoke all on function public.prep_exam_question_ids(uuid) from public,anon;
grant execute on function public.prep_exam_question_ids(uuid) to authenticated,service_role;

create function public.prep_edit_question(p_question_id uuid,p_expected_revision integer,p_patch jsonb) returns public.prep_questions
language plpgsql security invoker set search_path='' as $$
declare q public.prep_questions; begin
 if not public.agent_permission('write') then raise exception 'write permission required' using errcode='42501'; end if;
 select * into q from public.prep_questions where id=p_question_id and user_id=auth.uid() for update;
 if not found then raise exception 'question not found' using errcode='P0002'; end if;
 if q.revision is distinct from p_expected_revision then raise exception 'content revision conflict' using errcode='40001'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('stem_md','question_type','options','correct_answer','explanation_md','analysis_md','tags','target_seconds','material_id','status','legacy_metadata')) then raise exception 'unsupported question field' using errcode='22023'; end if;
 if p_patch?'legacy_metadata' then
 if jsonb_typeof(p_patch->'legacy_metadata') is distinct from 'object' then raise exception 'legacy metadata must be an object' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch->'legacy_metadata') k where k not in ('legacy_title','legacy_user_answer','legacy_image_required','source_date')) then raise exception 'unsupported legacy metadata field' using errcode='22023'; end if;
 end if;
 update public.prep_questions set
 metadata=q.metadata||coalesce(p_patch->'legacy_metadata','{}'::jsonb),
 stem_md=coalesce(p_patch->>'stem_md',q.stem_md),question_type=coalesce(p_patch->>'question_type',q.question_type),
 options=coalesce(p_patch->'options',q.options),correct_answer=case when p_patch?'correct_answer' then p_patch->'correct_answer' else q.correct_answer end,
 explanation_md=coalesce(p_patch->>'explanation_md',q.explanation_md),analysis_md=coalesce(p_patch->>'analysis_md',q.analysis_md),
 tags=case when p_patch?'tags' then array(select jsonb_array_elements_text(p_patch->'tags')) else q.tags end,
 target_seconds=case when p_patch?'target_seconds' then (p_patch->>'target_seconds')::integer else q.target_seconds end,
 material_id=case when p_patch?'material_id' then (p_patch->>'material_id')::uuid else q.material_id end,
 status=coalesce(p_patch->>'status',q.status)
 where id=q.id returning * into q; return q;
end $$;
revoke all on function public.prep_edit_question(uuid,integer,jsonb) from public,anon;
grant execute on function public.prep_edit_question(uuid,integer,jsonb) to authenticated;

-- Only trusted server scheduling code may call this atomic commit. Authenticated clients
-- cannot choose FSRS state, due dates, or append fabricated scheduler transitions.
create function public.prep_commit_attempt(p_user_id uuid,p_question_id uuid,p_idempotency_key uuid,p_input jsonb,p_state_revision integer,p_fsrs jsonb,p_due_at timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.prep_questions; a public.prep_attempts; r public.prep_review_states; v_mode text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_idempotency_key::text,0));
 select * into a from public.prep_attempts where user_id=p_user_id and idempotency_key=p_idempotency_key;
 if found then
 if a.question_id<>p_question_id then raise exception 'idempotency key belongs to another question' using errcode='22023'; end if;
 select * into r from public.prep_review_states where user_id=p_user_id and question_id=p_question_id;
 return jsonb_build_object('attempt',to_jsonb(a),'review_state',to_jsonb(r),'replayed',true); end if;
 select * into q from public.prep_questions where user_id=p_user_id and id=p_question_id for update;
 if not found then raise exception 'question not found' using errcode='P0002'; end if;
 insert into public.prep_review_states(user_id,question_id) values(p_user_id,p_question_id) on conflict(user_id,question_id) do nothing;
 select * into r from public.prep_review_states where user_id=p_user_id and question_id=p_question_id for update;
 v_mode=coalesce(p_input->>'mode','practice');
 if v_mode not in ('practice','review') then raise exception 'invalid attempt mode' using errcode='22023'; end if;
 if (p_input->>'content_revision')::integer is distinct from q.revision or r.paused or q.status<>'active' or p_state_revision is distinct from r.revision then v_mode='practice'; end if;
 if v_mode='review' then
 if p_state_revision<>r.revision then raise exception 'review revision conflict' using errcode='40001'; end if;
 if (p_input->>'rating')::integer not between 1 and 4 or p_input->>'rating' is null or p_due_at is null or jsonb_typeof(p_fsrs)<>'object' then raise exception 'invalid scheduled review' using errcode='22023'; end if;
 update public.prep_review_states set fsrs=p_fsrs,due_at=p_due_at,revision=revision+1 where id=r.id returning * into r;
 end if;
 insert into public.prep_attempts(user_id,question_id,exam_id,idempotency_key,answer,duration_seconds,correct,yellow,reason_tags,content_revision,mode,rating)
 values(p_user_id,p_question_id,(p_input->>'exam_id')::uuid,p_idempotency_key,p_input->'answer',(p_input->>'duration_seconds')::integer,(p_input->>'correct')::boolean,coalesce((p_input->>'yellow')::boolean,false),array(select jsonb_array_elements_text(coalesce(p_input->'reason_tags','[]'))),coalesce((p_input->>'content_revision')::integer,q.revision),v_mode,(p_input->>'rating')::integer) returning * into a;
 return jsonb_build_object('attempt',to_jsonb(a),'review_state',to_jsonb(r),'replayed',false);
end $$;
revoke all on function public.prep_commit_attempt(uuid,uuid,uuid,jsonb,integer,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.prep_commit_attempt(uuid,uuid,uuid,jsonb,integer,jsonb,timestamptz) to service_role;

-- Learning notes derive ownership through their course; enforce it on both roles.
alter table public.prep_note_links add constraint prep_note_exists foreign key(note_id) references public.learning_notes(id) on delete cascade;
create function public.prep_note_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.learning_notes n join public.learning_courses c on c.id=n.course_id where n.id=new.note_id and c.user_id=new.user_id) then raise exception 'note is not owned by user' using errcode='23503'; end if;
 return new;
end $$;
create trigger prep_note_owner before insert or update on public.prep_note_links for each row execute function public.prep_note_owner();

-- Trigger-only privileged writer, outside the exposed API schema.
create schema if not exists prep_private;
revoke all on schema prep_private from public,anon,authenticated;
create function prep_private.initialize_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='active' then
 insert into public.prep_review_states(user_id,question_id) values(new.user_id,new.id) on conflict(user_id,question_id) do nothing;
 end if; return new;
end $$;
revoke all on function prep_private.initialize_review() from public,anon,authenticated;
create trigger prep_initialize_review after insert or update of status on public.prep_questions for each row execute function prep_private.initialize_review();

-- Preserve legacy compact selections (AB) without splitting a real multi-character key.
create function public.prep_legacy_choice_answer(p_answer text,p_options jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare answer text=trim(p_answer); selections text[]; keys text[]; begin
 if answer is null or answer='' then return null; end if;
 select array_agg(coalesce(nullif(o.value->>'key',''),chr(64+o.ordinality::integer))) into keys from jsonb_array_elements(case when jsonb_typeof(p_options)='array' then p_options else '[]'::jsonb end) with ordinality o(value,ordinality);
 if answer=any(keys) then return jsonb_build_array(answer); end if;
 selections=regexp_split_to_array(answer,'[,，、;；[:space:]/]+');
 if cardinality(selections)=1 and length(answer)>1 then
  selections=regexp_split_to_array(answer,'');
  if not selections <@ coalesce(keys,'{}'::text[]) then return jsonb_build_array(answer); end if;
 end if;
 return to_jsonb(selections);
end $$;

-- Historical tables can be absent in isolated installations. No old rows are mutated.
do $$ begin
 if to_regclass('public.civil_exams') is not null then
 insert into public.prep_exams(id,user_id,name,exam_date,template,is_primary,is_archived,notes,created_at,updated_at)
 select id,user_id,name,exam_date,'civil',is_primary,is_archived,notes,coalesce(created_at,now()),coalesce(updated_at,now()) from public.civil_exams on conflict(id) do nothing;
 end if;
 if to_regclass('public.civil_wrong_answers') is not null then
 insert into public.prep_banks(user_id,name,description_md,metadata)
 select distinct user_id,'历史公考错题','从原考公模块保留迁移的题目',jsonb_build_object('legacy','civil_wrong_answers') from public.civil_wrong_answers;
 insert into public.prep_questions(id,user_id,stem_md,question_type,options,correct_answer,explanation_md,analysis_md,tags,status,metadata,created_at,updated_at)
 select w.id,w.user_id,coalesce(nullif(w.content,''),w.title)||case when nullif(w.image_url,'') is not null then E'\n\n![题目配图]('||w.image_url||')' else '' end,
 case when w.question_type='choice' then case when jsonb_array_length(public.prep_legacy_choice_answer(w.correct_answer,w.options))>1 then 'multiple' else 'single' end when w.question_type in ('single','multiple','judgement','text') then w.question_type else 'text' end,
 coalesce((select jsonb_agg(jsonb_build_object('key',coalesce(nullif(x.value->>'key',''),chr(64+x.ordinality::integer)),'content_md',coalesce(x.value->>'content_md',x.value->>'text',x.value->>'content',x.value#>>'{}')) order by x.ordinality) from jsonb_array_elements(case when jsonb_typeof(w.options)='array' then w.options else '[]' end) with ordinality x(value,ordinality)),'[]'),
 case when w.question_type in ('choice','single','multiple') then public.prep_legacy_choice_answer(w.correct_answer,w.options) else to_jsonb(w.correct_answer) end,coalesce(w.knowledge_point,''),coalesce(w.wrong_reason,''),array_remove(array[w.subject_group,w.subject_tag],null),'active',
 jsonb_build_object('legacy','civil_wrong_answers','legacy_title',w.title,'legacy_question_type',w.question_type,'legacy_image_url',w.image_url,'legacy_user_answer',w.user_answer,'legacy_image_required',w.image_required,'legacy_ai_draft_meta',w.ai_draft_meta,'source_date',w.source_date),coalesce(w.created_at,now()),coalesce(w.updated_at,now())
 from public.civil_wrong_answers w on conflict(id) do nothing;
 insert into public.prep_bank_questions(user_id,bank_id,question_id)
 select w.user_id,b.id,w.id from public.civil_wrong_answers w join public.prep_banks b on b.user_id=w.user_id and b.metadata->>'legacy'='civil_wrong_answers' on conflict do nothing;
 -- Legacy questions remain in their bank until the user explicitly associates an exam.
 insert into public.prep_review_states(user_id,question_id,due_at,paused,fsrs)
 select user_id,id,coalesce(next_review_date::timestamp at time zone 'Asia/Shanghai',now()),review_status='mastered',jsonb_build_object('legacy_interval_days',review_interval_days,'legacy_last_reviewed_at',last_reviewed_at) from public.civil_wrong_answers on conflict(user_id,question_id) do update set due_at=excluded.due_at,paused=excluded.paused,fsrs=excluded.fsrs;
 insert into public.prep_assets(user_id,question_id,url,metadata)
 select user_id,id,image_url,jsonb_build_object('legacy','civil_wrong_answers') from public.civil_wrong_answers where nullif(image_url,'') is not null;
 end if;
 if to_regclass('public.civil_xingce_papers') is not null then
 insert into public.prep_papers(id,user_id,name,taken_date,source,is_mock,sections,total_questions,total_correct,duration_minutes,total_score,notes,metadata,created_at,updated_at)
 select id,user_id,coalesce(nullif(source,''),'历史行测套卷'),taken_date,source,is_mock,
 jsonb_build_array(jsonb_build_object('key','verbal','name','言语理解','total',verbal_total,'correct',verbal_correct),jsonb_build_object('key','data','name','资料分析','total',data_total,'correct',data_correct),jsonb_build_object('key','graphic','name','图形推理','total',graphic_total,'correct',graphic_correct),jsonb_build_object('key','logic','name','逻辑判断','total',logic_total,'correct',logic_correct),jsonb_build_object('key','analogy','name','类比推理','total',analogy_total,'correct',analogy_correct),jsonb_build_object('key','quantity','name','数量关系','total',quantity_total,'correct',quantity_correct),jsonb_build_object('key','common','name','常识判断','total',common_total,'correct',common_correct)),
 verbal_total+data_total+graphic_total+logic_total+analogy_total+quantity_total+common_total,
 verbal_correct+data_correct+graphic_correct+logic_correct+analogy_correct+quantity_correct+common_correct,
 duration_minutes,total_score,notes,jsonb_build_object('legacy','civil_xingce_papers','beat_rate',beat_rate),coalesce(created_at,now()),coalesce(updated_at,now()) from public.civil_xingce_papers on conflict(id) do nothing;
 end if;
end $$;

-- Private source images/PDFs: never expose originals through a public bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('prep-assets','prep-assets',false,20971520,array['image/jpeg','image/png','image/webp','image/avif','image/gif','application/pdf'])
on conflict(id) do nothing;
create policy prep_assets_storage_read on storage.objects for select to authenticated using(bucket_id='prep-assets' and split_part(name,'/',1)=(select auth.uid())::text and public.agent_permission('read'));
create policy prep_assets_storage_insert on storage.objects for insert to authenticated with check(bucket_id='prep-assets' and split_part(name,'/',1)=(select auth.uid())::text and public.agent_permission('write'));
create policy prep_assets_storage_update on storage.objects for update to authenticated using(bucket_id='prep-assets' and split_part(name,'/',1)=(select auth.uid())::text and public.agent_permission('write')) with check(bucket_id='prep-assets' and split_part(name,'/',1)=(select auth.uid())::text and public.agent_permission('write'));
create policy prep_assets_storage_delete on storage.objects for delete to authenticated using(bucket_id='prep-assets' and split_part(name,'/',1)=(select auth.uid())::text and public.agent_permission('delete'));
