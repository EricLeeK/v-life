-- Run against a migrated local database; all test records are rolled back.
begin;
do $$
declare tid uuid; stamp timestamptz;
begin
 insert into public.todos(title) values ('completion timestamp regression') returning id into tid;
 if (select completed_at from public.todos where id=tid) is not null then raise exception 'incomplete todo has timestamp'; end if;
 update public.todos set is_completed=true where id=tid;
 select completed_at into stamp from public.todos where id=tid;
 if stamp is null then raise exception 'completion has no timestamp'; end if;
 update public.todos set title='edited',is_completed=true,completed_at='2000-01-01' where id=tid;
 if (select completed_at from public.todos where id=tid) is distinct from stamp then raise exception 'repeat completion overwrote timestamp'; end if;
 update public.todos set completed_at='2000-01-01' where id=tid;
 if (select completed_at from public.todos where id=tid) is distinct from stamp then raise exception 'timestamp is caller controlled'; end if;
 update public.todos set is_completed=false where id=tid;
 if (select completed_at from public.todos where id=tid) is not null then raise exception 'reopen did not clear timestamp'; end if;
 update public.todos set is_completed=true where id=tid;
 if (select completed_at from public.todos where id=tid) is null then raise exception 'recompletion has no timestamp'; end if;
 insert into public.todos(title,is_completed,completed_at) values ('created completed',true,'2000-01-01') returning completed_at into stamp;
 if stamp is null or stamp='2000-01-01'::timestamptz then raise exception 'insert did not use server time'; end if;
end $$;
-- Legacy completions must remain unknown, including repeated true updates.
alter table public.todos disable trigger todo_completion_timestamp;
insert into public.todos(title,is_completed,completed_at) values ('legacy completion regression',true,null);
alter table public.todos enable trigger todo_completion_timestamp;
update public.todos set is_completed=true where title='legacy completion regression';
do $$ begin
 if exists(select 1 from public.todos where title='legacy completion regression' and completed_at is not null) then raise exception 'invented legacy completion time'; end if;
end $$;
rollback;
