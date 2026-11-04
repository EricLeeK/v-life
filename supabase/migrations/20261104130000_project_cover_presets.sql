begin;

-- Store the project tint once; warehouse groups read it from their parent project.
alter table public.projects add column cover_preset text not null default 'auto'
  check (cover_preset in ('auto','none','sage','sand','clay','mist','iris','ocean','rose','graphite','honey'));

update agent_private.module_contracts
set contract=jsonb_set(jsonb_set(jsonb_set(contract,
  '{readColumns}',(contract->'readColumns')||'["cover_preset"]'::jsonb),
  '{createColumns}',(contract->'createColumns')||'["cover_preset"]'::jsonb),
  '{updateColumns}',(contract->'updateColumns')||'["cover_preset"]'::jsonb)
where module='project';

commit;
