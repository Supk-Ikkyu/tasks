self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Calendar reminder', body: event.data?.text() || '' } }
  event.waitUntil(self.registration.showNotification(data.title || 'Calendar reminder', {
    body: data.body || 'An event is starting soon.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'calendar-reminder',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(targetUrl)
        return client.focus()
      }
    }
    return self.clients.openWindow(targetUrl)
  })())
})
