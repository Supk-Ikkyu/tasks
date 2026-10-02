-- Run this only after deploying the send-calendar-reminders Edge Function.
-- Replace the two placeholder values before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'tasks_project_url',
  'Tasks project URL used by the calendar reminder cron job'
);

select vault.create_secret(
  'REPLACE_WITH_YOUR_CRON_SECRET',
  'tasks_cron_secret',
  'Secret header used by the calendar reminder Edge Function'
);

select cron.schedule(
  'send-calendar-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'tasks_project_url') || '/functions/v1/send-calendar-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tasks_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
