-- Run this file once in Supabase Dashboard > SQL Editor.
-- It changes the original single-email policies into per-account policies.

begin;

drop policy if exists "Owner only notes" on public.notes;
create policy "Owner only notes" on public.notes
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Owner only tasks" on public.tasks;
create policy "Owner only tasks" on public.tasks
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Owner only links" on public.important_links;
create policy "Owner only links" on public.important_links
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Owner only events" on public.calendar_events;
create policy "Owner only events" on public.calendar_events
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;
