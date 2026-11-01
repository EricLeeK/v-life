-- Todos: manual ordering.
-- Backs the SortableList drag reorder for subtasks (and later the main list).
-- Existing rows default to 0; display order is (sort_order asc, created_at desc)
-- until a user drags, which re-indexes the affected siblings 0..n-1.
alter table public.todos
  add column if not exists sort_order integer not null default 0;

-- Subtask lists filter by parent_id and sort by (sort_order, created_at).
create index if not exists idx_todos_parent_sort
  on public.todos(parent_id, sort_order);
