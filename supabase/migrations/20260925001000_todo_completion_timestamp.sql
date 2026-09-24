begin;
-- Do not backfill: neither created_at nor updated_at proves when a todo was completed.
alter table public.todos add column completed_at timestamptz;
comment on column public.todos.completed_at is 'Server-owned latest completion time; NULL on a completed legacy todo means unknown. Cleared when reopened.';

create or replace function public.todo_completion_timestamp() returns trigger
language plpgsql set search_path='' as $$
begin
 if not new.is_completed then
   new.completed_at := null;
 elsif tg_op = 'INSERT' then
   new.completed_at := statement_timestamp();
 elsif not old.is_completed then
   new.completed_at := statement_timestamp();
 else
   -- Preserve legacy NULLs and ignore client attempts to change the timestamp.
   new.completed_at := old.completed_at;
 end if;
 return new;
end $$;
create trigger todo_completion_timestamp before insert or update on public.todos
for each row execute function public.todo_completion_timestamp();
create index todos_completed_at_idx on public.todos(user_id,completed_at) where completed_at is not null;

-- Mutation responses use the same read-only projection as list/get.
update agent_private.module_contracts
set contract=jsonb_set(contract,'{readColumns}',(contract->'readColumns') || '["completed_at"]'::jsonb)
where module='todo' and not ((contract->'readColumns') ? 'completed_at');
commit;
