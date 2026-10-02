import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

interface DueReminder {
  delivery_id: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
  event_title: string
  event_description: string
  event_start_at: string
}

Deno.serve(async (request) => {
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.rpc('claim_due_calendar_reminders')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  let failed = 0
  for (const reminder of (data || []) as DueReminder[]) {
    try {
      await webpush.sendNotification({
        endpoint: reminder.endpoint,
        keys: { p256dh: reminder.p256dh, auth: reminder.auth },
      }, JSON.stringify({
        title: reminder.event_title,
        body: buildBody(reminder),
        url: '/',
        tag: `calendar-${reminder.delivery_id}`,
      }))
      await supabase.from('push_deliveries').update({ sent_at: new Date().toISOString() }).eq('id', reminder.delivery_id)
      sent += 1
    } catch (pushError) {
      failed += 1
      const statusCode = typeof pushError === 'object' && pushError && 'statusCode' in pushError ? Number(pushError.statusCode) : 0
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', reminder.subscription_id)
      } else {
        await supabase.from('push_deliveries').delete().eq('id', reminder.delivery_id)
      }
    }
  }

  return Response.json({ claimed: data?.length || 0, sent, failed })
})

function buildBody(reminder: DueReminder) {
  const starts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(new Date(reminder.event_start_at))
  return `${starts}${reminder.event_description ? ` — ${reminder.event_description}` : ''}`
}
