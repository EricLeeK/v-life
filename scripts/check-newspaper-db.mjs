// Isolated PostgreSQL semantics test; no connection to the linked production database.
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite(); const read=p=>readFileSync(p,'utf8');
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}')$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema public,auth to authenticated,anon,service_role;grant execute on all functions in schema auth to authenticated,anon,service_role;
 alter default privileges in schema public grant all on tables to authenticated,anon;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
 create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 for(const name of ['20260330112130_60582f13-ce1f-453e-9c76-af7fb0aa87d1.sql','20260416_project_management.sql','20260511_learning_notes.sql','20260921120000_agent_access.sql','20260921150000_agent_hardening.sql'])await db.exec(read('supabase/migrations/'+name));
 if(!process.argv.includes('--red'))await db.exec(read('supabase/migrations/20260928020000_newspaper_reports.sql').replace(/^create extension[^\n]+\n/gm,''));
 await db.exec(read('supabase/tests/newspaper_reports.sql'));
 if(!process.argv.includes('--red')){await db.exec(read('supabase/migrations/20260928021000_newspaper_images.sql').replace(/^create extension[^\n]+\n/gm,''));await db.exec(read('supabase/tests/newspaper_images.sql'));await db.exec(read('supabase/tests/newspaper_reports.sql'));}
 console.log('PASS: newspaper revisions, immutable archives, supplement retention, user isolation, OAuth read/revoke, service-only mutation. Cron extensions stubbed; scheduler deployment unverified.');
}catch(e){console.error(JSON.stringify({message:e.message,code:e.code,detail:e.detail,where:e.where}));process.exitCode=1;}finally{await db.close();}
