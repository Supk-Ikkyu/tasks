-- Ikkyu Tasks database schema
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '' check (char_length(content) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  completed boolean not null default false,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.important_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  url text not null check (char_length(url) between 1 and 2048),
  category text not null default 'General' check (char_length(category) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  start_at timestamptz not null,
  end_at timestamptz,
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_event_time check (end_at is null or end_at >= start_at)
);

create index if not exists tasks_user_due_idx on public.tasks(user_id, completed, due_date);
create index if not exists notes_user_updated_idx on public.notes(user_id, updated_at desc);
create index if not exists links_user_category_idx on public.important_links(user_id, category);
create index if not exists events_user_start_idx on public.calendar_events(user_id, start_at);

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_links_updated_at on public.important_links;
create trigger set_links_updated_at before update on public.important_links
for each row execute function public.set_updated_at();

drop trigger if exists set_events_updated_at on public.calendar_events;
create trigger set_events_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.important_links enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "Owner only notes" on public.notes;
create policy "Owner only notes" on public.notes
for all to authenticated
using (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com')
with check (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com');

drop policy if exists "Owner only tasks" on public.tasks;
create policy "Owner only tasks" on public.tasks
for all to authenticated
using (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com')
with check (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com');

drop policy if exists "Owner only links" on public.important_links;
create policy "Owner only links" on public.important_links
for all to authenticated
using (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com')
with check (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com');

drop policy if exists "Owner only events" on public.calendar_events;
create policy "Owner only events" on public.calendar_events
for all to authenticated
using (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com')
with check (user_id = auth.uid() and lower(coalesce(auth.jwt() ->> 'email', '')) = 'supk.ikkyu@gmail.com');
