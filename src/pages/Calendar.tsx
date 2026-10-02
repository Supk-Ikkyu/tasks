import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react'
import { Bell, BellRing, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'

const blankForm = { title: '', description: '', start_at: '', end_at: '', reminder_minutes: '15' }
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)))

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
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(month.getMonth())
  const [pickerYear, setPickerYear] = useState(String(month.getFullYear()))
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => 'Notification' in window ? Notification.permission : 'denied')
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const swipeHandled = useRef(false)

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

  async function confirmDeleteEvent() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: requestError } = await supabase!.from('calendar_events').delete().eq('id', deleteTarget.id).eq('user_id', userId)
    setDeleting(false)
    if (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    }
    else {
      setEvents((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
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

  function openMonthPicker() {
    setPickerMonth(month.getMonth())
    setPickerYear(String(month.getFullYear()))
    setMonthPickerOpen(true)
  }

  function jumpToMonth(event: FormEvent) {
    event.preventDefault()
    const year = Number(pickerYear)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      setError('Choose a year between 1900 and 2200.')
      return
    }
    const next = new Date(year, pickerMonth, 1)
    setMonth(next)
    setSelectedDate(toDateKey(next))
    setMonthPickerOpen(false)
    setError('')
  }

  function beginSwipe(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1) return
    swipeHandled.current = false
    swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  function finishSwipe(event: TouchEvent<HTMLElement>) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || event.changedTouches.length !== 1) return
    const deltaX = event.changedTouches[0].clientX - start.x
    const deltaY = event.changedTouches[0].clientY - start.y
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return
    swipeHandled.current = true
    moveMonth(deltaX < 0 ? 1 : -1)
    window.setTimeout(() => { swipeHandled.current = false }, 350)
  }

  return (
    <div className="page-stack">
      <div className="calendar-actions" id="tour-calendar-tools">
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
              <div><p className="eyebrow">Monthly view</p><button className="month-title-button" type="button" onClick={openMonthPicker} aria-label="Choose month and year"><span>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)}</span><ChevronDown size={18} /></button></div>
              <div className="calendar-navigation"><button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft /></button><button className="today-button" type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(toDateKey(now)) }}>Today</button><button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight /></button></div>
            </div>
            <div className="weekday-row" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid" onTouchStart={beginSwipe} onTouchEnd={finishSwipe}>
              {days.map((date) => {
                const key = toDateKey(date)
                const count = events.filter((event) => toDateKey(new Date(event.start_at)) === key).length
                const outside = date.getMonth() !== month.getMonth()
                const today = key === toDateKey(new Date())
                return (
                  <button key={key} type="button" className={`calendar-day${outside ? ' outside' : ''}${today ? ' today' : ''}${selectedDate === key ? ' selected' : ''}`} onClick={() => { if (!swipeHandled.current) setSelectedDate(key) }}>
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
                    <div className="card-actions"><button className="icon-button" type="button" onClick={() => openEdit(event)} aria-label={`Edit ${event.title}`}><Pencil size={17} /></button><button className="icon-button danger" type="button" onClick={() => setDeleteTarget(event)} aria-label={`Delete ${event.title}`}><Trash2 size={17} /></button></div>
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
      <Modal title="Choose month and year" open={monthPickerOpen} onClose={() => setMonthPickerOpen(false)}>
        <form className="modal-form" onSubmit={jumpToMonth}>
          <div className="form-grid">
            <label><span>Month</span><select value={pickerMonth} onChange={(event) => setPickerMonth(Number(event.target.value))}>{monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
            <label><span>Year</span><input type="number" value={pickerYear} onChange={(event) => setPickerYear(event.target.value)} min="1900" max="2200" inputMode="numeric" required /></label>
          </div>
          <div className="month-picker-shortcuts">
            <button className="text-button" type="button" onClick={() => { const now = new Date(); setPickerMonth(now.getMonth()); setPickerYear(String(now.getFullYear())) }}>Current month</button>
          </div>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setMonthPickerOpen(false)}>Cancel</button><button className="primary-button" type="submit"><CalendarDays size={17} />Go to month</button></div>
        </form>
      </Modal>
      <DeleteConfirmation open={Boolean(deleteTarget)} itemType="event" itemName={deleteTarget?.title || ''} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteEvent} />
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
