-- Add background Web Push notifications for calendar reminders.
-- Run this file once in Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, subscription_id, scheduled_for)
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists push_deliveries_pending_idx on public.push_deliveries(scheduled_for, sent_at);

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries enable row level security;

drop policy if exists "Owner only push subscriptions" on public.push_subscriptions;
create policy "Owner only push subscriptions" on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_name text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_name)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_device_name, 300))
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    device_name = excluded.device_name,
    updated_at = now()
  returning id into subscription_id;
  return subscription_id;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.claim_due_calendar_reminders()
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  event_title text,
  event_description text,
  event_start_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select
      e.id as event_id,
      s.id as subscription_id,
      e.start_at - make_interval(mins => e.reminder_minutes) as scheduled_for
    from public.calendar_events e
    join public.push_subscriptions s on s.user_id = e.user_id
    where e.reminder_minutes is not null
      and e.start_at > now() - interval '10 minutes'
      and e.start_at - make_interval(mins => e.reminder_minutes) <= now()
      and e.start_at - make_interval(mins => e.reminder_minutes) > now() - interval '10 minutes'
  ), claimed as (
    insert into public.push_deliveries (event_id, subscription_id, scheduled_for)
    select event_id, subscription_id, scheduled_for from due
    on conflict (event_id, subscription_id, scheduled_for) do nothing
    returning id, event_id, subscription_id
  )
  select
    c.id,
    s.id,
    s.endpoint,
    s.p256dh,
    s.auth,
    e.title,
    e.description,
    e.start_at
  from claimed c
  join public.calendar_events e on e.id = c.event_id
  join public.push_subscriptions s on s.id = c.subscription_id;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.remove_push_subscription(text) from public;
revoke all on function public.claim_due_calendar_reminders() from public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.claim_due_calendar_reminders() to service_role;

commit;
