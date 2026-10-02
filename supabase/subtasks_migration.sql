-- Add subtasks to an existing Tasks database.
-- Run this file once in Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  completed boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subtasks_task_position_idx
  on public.subtasks(task_id, position, created_at);

drop trigger if exists set_subtasks_updated_at on public.subtasks;
create trigger set_subtasks_updated_at before update on public.subtasks
for each row execute function public.set_updated_at();

alter table public.subtasks enable row level security;

drop policy if exists "Owner only subtasks" on public.subtasks;
create policy "Owner only subtasks" on public.subtasks
for all to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks
    where tasks.id = subtasks.task_id
      and tasks.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks
    where tasks.id = subtasks.task_id
      and tasks.user_id = auth.uid()
  )
);

commit;
