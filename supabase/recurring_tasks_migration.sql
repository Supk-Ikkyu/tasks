-- Add recurring-task support to an existing Tasks database.
-- Run this file once in Supabase Dashboard > SQL Editor.

begin;

alter table public.tasks
  add column if not exists recurrence text not null default 'none';

alter table public.tasks
  add column if not exists recurrence_spawned boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_recurrence_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_check
      check (recurrence in ('none', 'daily', 'weekly', 'monthly'));
  end if;
end
$$;

commit;
