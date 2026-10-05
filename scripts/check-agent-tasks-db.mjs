// Isolated integration tests: no production data or credentials.
// daily_tasks must precede its older-named 4d_evaluation alteration.
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}')$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant execute on all functions in schema auth to authenticated,anon,service_role;
    alter default privileges in schema public grant all on tables to authenticated,anon;`);
  for (const file of ['20260330112130_60582f13-ce1f-453e-9c76-af7fb0aa87d1.sql','20260331051433_40c8c912-1a92-4e13-8861-e86b93e0e34e.sql','20260331054032_042ff76d-b7ea-4f3c-bd1e-1744912ed017.sql','20260331055944_d83999f7-819b-4cb8-b104-ba505c6b781c.sql','20260416_project_management.sql','20260511_learning_notes.sql','20260508_add_todo_archive.sql','20260518_today_todo.sql','20260518130000_4d_evaluation.sql','20260519160000_add_todo_parent_id.sql','20260523012448_add_day_start_hour.sql','20260902_todo_habits_routines.sql','20260921120000_agent_access.sql','20260921150000_agent_hardening.sql','20260924133000_daily_task_workflow.sql','20260924143000_agent_onboarding.sql','20260925001000_todo_completion_timestamp.sql','20260928010000_agent_task_workflows.sql','20260930170000_once_task_single_open_day.sql','20261005010000_agent_api_keys.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(readFileSync('supabase/tests/daily_task_workflow.sql', 'utf8'));
  await db.exec(readFileSync('supabase/tests/agent_task_workflows.sql', 'utf8'));
  await db.exec(readFileSync('supabase/tests/agent_api_keys.sql', 'utf8'));
  await db.exec(readFileSync('supabase/tests/agent_access.sql', 'utf8'));
  console.log('PASS: merged task workflow, once-task single open date, routine copy, atomic rollback, permissions, idempotency, API key lifecycle and OAuth regression.');
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where }));
  process.exitCode = 1;
} finally { await db.close(); }
