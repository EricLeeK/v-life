-- Projects: manual ordering within status groups (ProjectSidebar drag).
-- Same convention as todos: display order is (sort_order asc, priority) until
-- a drag re-indexes the affected group 0..n-1.
alter table public.projects
  add column if not exists sort_order integer not null default 0;
