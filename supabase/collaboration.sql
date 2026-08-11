-- Real-time collaboration for Athena Scheduler.
-- Run this after supabase/schema.sql in the Supabase SQL editor.
-- Enable Google under Authentication > Providers and add the deployed app URL
-- to Authentication > URL Configuration before using the browser sign-in flow.

create table if not exists public.schedule_sessions (
  id text primary key,
  schedule_data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_edit_log (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.schedule_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null default 'System',
  event_type text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists schedule_edit_log_session_created_idx
  on public.schedule_edit_log (session_id, created_at desc);

drop trigger if exists schedule_sessions_touch_updated_at on public.schedule_sessions;
create trigger schedule_sessions_touch_updated_at
before update on public.schedule_sessions
for each row execute function public.touch_updated_at();

alter table public.schedule_sessions enable row level security;
alter table public.schedule_edit_log enable row level security;

drop policy if exists "schedule_sessions_authenticated_read" on public.schedule_sessions;
create policy "schedule_sessions_authenticated_read"
on public.schedule_sessions for select to authenticated using (true);

drop policy if exists "schedule_edit_log_own_read" on public.schedule_edit_log;
create policy "schedule_edit_log_own_read"
on public.schedule_edit_log for select to authenticated
using (user_id = auth.uid());

-- Server-side writes use SUPABASE_SERVICE_ROLE_KEY and bypass RLS.
-- Authenticated clients receive schedule changes through Realtime only.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'schedule_sessions'
  ) then
    alter publication supabase_realtime add table public.schedule_sessions;
  end if;
end $$;
