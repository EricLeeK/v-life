alter table public.projects add column if not exists icon_svg text
  check (icon_svg is null or octet_length(icon_svg) <= 24000);
alter table public.project_tasks drop constraint if exists project_tasks_cover_preset_check;
alter table public.project_tasks add constraint project_tasks_cover_preset_check
  check (cover_preset in ('auto','none','sage','sand','clay','mist','iris','ocean','rose','graphite','honey'));
