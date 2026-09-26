begin;
-- Only aggregate allowlisted vocabulary. No settings row or record content is exposed.
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
commit;
