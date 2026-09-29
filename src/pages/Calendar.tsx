import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Bell, BellRing, CalendarDays, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'

const blankForm = { title: '', description: '', start_at: '', end_at: '', reminder_minutes: '15' }

export function Calendar({ userId }: { userId: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => 'Notification' in window ? Notification.permission : 'denied')

  const loadEvents = useCallback(async () => {
    const rangeStart = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString()
    const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString()
    const { data, error: requestError } = await supabase!.from('calendar_events').select('*').eq('user_id', userId).gte('start_at', rangeStart).lt('start_at', rangeEnd).order('start_at')
    if (requestError) setError(requestError.message)
    else setEvents((data || []) as CalendarEvent[])
    setLoading(false)
  }, [month, userId])

  useEffect(() => { void loadEvents() }, [loadEvents])

  useEffect(() => {
    if (notificationPermission !== 'granted') return
    const timers: number[] = []
    for (const event of events) {
      if (event.reminder_minutes === null) continue
      const delay = new Date(event.start_at).getTime() - event.reminder_minutes * 60_000 - Date.now()
      if (delay > 0 && delay < 2_147_000_000) {
        timers.push(window.setTimeout(() => {
          new Notification(event.title, { body: `${formatEventTime(event.start_at)}${event.description ? ` — ${event.description}` : ''}`, icon: '/favicon.svg' })
        }, delay))
      }
    }
    return () => timers.forEach(window.clearTimeout)
  }, [events, notificationPermission])

  const days = useMemo(() => buildMonthGrid(month), [month])
  const selectedEvents = useMemo(() => events.filter((event) => toDateKey(new Date(event.start_at)) === selectedDate), [events, selectedDate])

  function openCreate(date = selectedDate) {
    setEditing(null)
    setForm({ ...blankForm, start_at: `${date}T09:00`, end_at: `${date}T10:00` })
    setModalOpen(true)
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event)
    setForm({ title: event.title, description: event.description || '', start_at: toLocalInput(event.start_at), end_at: event.end_at ? toLocalInput(event.end_at) : '', reminder_minutes: event.reminder_minutes === null ? '' : String(event.reminder_minutes) })
    setModalOpen(true)
  }

  async function saveEvent(formEvent: FormEvent) {
    formEvent.preventDefault()
    setSaving(true)
    setError('')
    const start = new Date(form.start_at)
    const end = form.end_at ? new Date(form.end_at) : null
    if (end && end < start) { setError('The end time must be after the start time.'); setSaving(false); return }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      start_at: start.toISOString(),
      end_at: end?.toISOString() || null,
      reminder_minutes: form.reminder_minutes === '' ? null : Number(form.reminder_minutes),
    }
    const request = editing
      ? supabase!.from('calendar_events').update(payload).eq('id', editing.id).eq('user_id', userId)
      : supabase!.from('calendar_events').insert({ ...payload, user_id: userId })
    const { error: requestError } = await request
    setSaving(false)
    if (requestError) setError(requestError.message)
    else { setModalOpen(false); setSelectedDate(toDateKey(start)); await loadEvents() }
  }

  async function deleteEvent(event: CalendarEvent) {
    if (!window.confirm(`Delete “${event.title}”?`)) return
    const { error: requestError } = await supabase!.from('calendar_events').delete().eq('id', event.id).eq('user_id', userId)
    if (requestError) setError(requestError.message)
    else setEvents((current) => current.filter((item) => item.id !== event.id))
  }

  async function requestNotifications() {
    if (!('Notification' in window)) { setError('This browser does not support notifications.'); return }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === 'denied') setError('Notifications are blocked. You can enable them from your browser site settings.')
  }

  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    setSelectedDate(toDateKey(next))
  }

  return (
    <div className="page-stack">
      <div className="calendar-actions">
        <button className="secondary-button" type="button" onClick={requestNotifications}>
          {notificationPermission === 'granted' ? <BellRing size={18} /> : <Bell size={18} />}
          {notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
        </button>
        <button className="primary-button" type="button" onClick={() => openCreate()}><Plus size={18} />New event</button>
      </div>
      <p className="notification-hint">Calendar reminders are delivered while this website is open. Background push notifications can be added in a later version.</p>
      {error && <ErrorMessage message={error} />}
      {loading ? <LoadingState label="Loading calendar…" /> : (
        <div className="calendar-layout">
          <section className="calendar-panel">
            <div className="calendar-heading">
              <div><p className="eyebrow">Monthly view</p><h2>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)}</h2></div>
              <div className="calendar-navigation"><button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft /></button><button className="today-button" type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(toDateKey(now)) }}>Today</button><button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight /></button></div>
            </div>
            <div className="weekday-row" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {days.map((date) => {
                const key = toDateKey(date)
                const count = events.filter((event) => toDateKey(new Date(event.start_at)) === key).length
                const outside = date.getMonth() !== month.getMonth()
                const today = key === toDateKey(new Date())
                return (
                  <button key={key} type="button" className={`calendar-day${outside ? ' outside' : ''}${today ? ' today' : ''}${selectedDate === key ? ' selected' : ''}`} onClick={() => setSelectedDate(key)}>
                    <span>{date.getDate()}</span>
                    {count > 0 && <small>{count} {count === 1 ? 'event' : 'events'}</small>}
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="agenda-panel">
            <div className="panel-heading"><div><p className="eyebrow">Selected day</p><h2>{formatSelectedDate(selectedDate)}</h2></div><button className="icon-button" type="button" onClick={() => openCreate(selectedDate)} aria-label="Add event on selected day"><Plus /></button></div>
            {selectedEvents.length === 0 ? (
              <EmptyState icon={<CalendarDays />} title="No events" detail="This day is currently free." />
            ) : (
              <div className="agenda-list">
                {selectedEvents.map((event) => (
                  <article key={event.id} className="agenda-item">
                    <div className="agenda-time"><Clock3 size={16} /><span>{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start_at))}</span></div>
                    <h3>{event.title}</h3>
                    {event.description && <p>{event.description}</p>}
                    {event.reminder_minutes !== null && <small><Bell size={14} />Reminder {event.reminder_minutes} minutes before</small>}
                    <div className="card-actions"><button className="icon-button" type="button" onClick={() => openEdit(event)} aria-label={`Edit ${event.title}`}><Pencil size={17} /></button><button className="icon-button danger" type="button" onClick={() => deleteEvent(event)} aria-label={`Delete ${event.title}`}><Trash2 size={17} /></button></div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      <Modal title={editing ? 'Edit event' : 'New event'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveEvent}>
          <label><span>Event title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} autoFocus required /></label>
          <label><span>Description <small>Optional</small></span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={1000} /></label>
          <div className="form-grid"><label><span>Starts</span><input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required /></label><label><span>Ends <small>Optional</small></span><input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></label></div>
          <label><span>Reminder</span><select value={form.reminder_minutes} onChange={(e) => setForm({ ...form, reminder_minutes: e.target.value })}><option value="">No reminder</option><option value="0">At start time</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add event'}</button></div>
        </form>
      </Modal>
    </div>
  )
}

function buildMonthGrid(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalInput(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function formatSelectedDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
