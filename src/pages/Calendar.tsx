import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react'
import { Bell, BellRing, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'

const blankForm = { title: '', description: '', start_at: '', end_at: '', reminder_minutes: '15' }
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)))
type PushStatus = 'checking' | 'disabled' | 'enabled' | 'unsupported'

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
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [pushStatus, setPushStatus] = useState<PushStatus>('checking')
  const [pushBusy, setPushBusy] = useState(false)
  const swipeStart = useRef<{ x: number; y: number; time: number; width: number } | null>(null)
  const swipeHandled = useRef(false)
  const calendarViewport = useRef<HTMLDivElement>(null)
  const animationTimer = useRef<number | null>(null)

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
    let active = true
    async function checkPushSubscription() {
      if (!supportsWebPush()) { if (active) setPushStatus('unsupported'); return }
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const subscription = await registration.pushManager.getSubscription()
        if (!active) return
        if (subscription && Notification.permission === 'granted') {
          await savePushSubscription(subscription)
          if (active) setPushStatus('enabled')
        } else setPushStatus('disabled')
      } catch {
        if (active) setPushStatus('unsupported')
      }
    }
    void checkPushSubscription()
    return () => { active = false }
  }, [userId])

  const visibleMonths = useMemo(() => [-1, 0, 1].map((offset) => new Date(month.getFullYear(), month.getMonth() + offset, 1)), [month])
  const selectedEvents = useMemo(() => events.filter((event) => toDateKey(new Date(event.start_at)) === selectedDate), [events, selectedDate])

  useEffect(() => () => {
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
  }, [])

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

  async function togglePushNotifications() {
    setError('')
    if (!supportsWebPush()) {
      setError('Web Push is not supported in this browser. On iPhone or iPad, install this website to the Home Screen and open it from its icon.')
      return
    }
    if (pushStatus !== 'enabled' && isAppleMobile() && !isStandaloneApp()) {
      setError('On iPhone or iPad: open this website in Safari, select Share, choose Add to Home Screen, then open Tasks from the new Home Screen icon and enable notifications there.')
      return
    }
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      if (pushStatus === 'enabled') {
        if (existing) {
          await supabase!.rpc('remove_push_subscription', { p_endpoint: existing.endpoint })
          await existing.unsubscribe()
        }
        setPushStatus('disabled')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notifications are blocked. Enable them in this device\'s browser or notification settings, then try again.')
        setPushStatus('disabled')
        return
      }
      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error('Push notifications have not been configured by the website administrator.')
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await savePushSubscription(subscription)
      setPushStatus('enabled')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Push notifications could not be enabled.')
    } finally {
      setPushBusy(false)
    }
  }

  async function savePushSubscription(subscription: PushSubscription) {
    const json = subscription.toJSON()
    if (!json.keys?.p256dh || !json.keys.auth) throw new Error('This device returned an incomplete push subscription.')
    const { error: requestError } = await supabase!.rpc('save_push_subscription', {
      p_endpoint: subscription.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_device_name: navigator.userAgent,
    })
    if (requestError) throw requestError
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
    if (event.touches.length !== 1 || animating) return
    const width = calendarViewport.current?.clientWidth || 1
    swipeHandled.current = false
    swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now(), width }
    setDragging(true)
  }

  function continueSwipe(event: TouchEvent<HTMLElement>) {
    const start = swipeStart.current
    if (!start || event.touches.length !== 1 || animating) return
    const deltaX = event.touches[0].clientX - start.x
    const deltaY = event.touches[0].clientY - start.y
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      setDragging(false)
      setDragOffset(0)
      swipeStart.current = null
      return
    }
    if (Math.abs(deltaX) > 6) swipeHandled.current = true
    setDragOffset(Math.max(-start.width, Math.min(start.width, deltaX)))
  }

  function finishSwipe(event: TouchEvent<HTMLElement>) {
    const start = swipeStart.current
    swipeStart.current = null
    setDragging(false)
    if (!start || event.changedTouches.length !== 1 || animating) return
    const deltaX = event.changedTouches[0].clientX - start.x
    const deltaY = event.changedTouches[0].clientY - start.y
    const elapsed = Math.max(1, Date.now() - start.time)
    const velocity = Math.abs(deltaX) / elapsed
    const horizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.1
    const shouldChangeMonth = horizontal && (Math.abs(deltaX) >= start.width * 0.24 || (Math.abs(deltaX) >= 30 && velocity >= 0.5))
    if (shouldChangeMonth) animateMonth(deltaX < 0 ? 1 : -1, start.width)
    else snapCalendarBack()
    window.setTimeout(() => { swipeHandled.current = false }, 350)
  }

  function cancelSwipe() {
    swipeStart.current = null
    setDragging(false)
    snapCalendarBack()
  }

  function snapCalendarBack() {
    setAnimating(true)
    setDragOffset(0)
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
    animationTimer.current = window.setTimeout(() => {
      setAnimating(false)
      animationTimer.current = null
    }, 310)
  }

  function animateMonth(offset: -1 | 1, suppliedWidth?: number) {
    if (animating) return
    const width = suppliedWidth || calendarViewport.current?.clientWidth || 1
    setAnimating(true)
    setDragOffset(-offset * width)
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
    animationTimer.current = window.setTimeout(() => {
      moveMonth(offset)
      setAnimating(false)
      setDragOffset(0)
      animationTimer.current = null
    }, 300)
  }

  return (
    <div className="page-stack">
      <div className="calendar-actions" id="tour-calendar-tools">
        <button className="secondary-button" type="button" onClick={togglePushNotifications} disabled={pushBusy || pushStatus === 'checking'}>
          {pushStatus === 'enabled' ? <BellRing size={18} /> : <Bell size={18} />}
          {pushBusy ? 'Updating…' : pushStatus === 'checking' ? 'Checking notifications…' : pushStatus === 'enabled' ? 'Background notifications enabled' : 'Enable background notifications'}
        </button>
        <button className="primary-button" type="button" onClick={() => openCreate()}><Plus size={18} />New event</button>
      </div>
      <p className="notification-hint">Enable notifications once on each device. iPhone and iPad users must first add Tasks to the Home Screen and open it from the installed icon.</p>
      {error && <ErrorMessage message={error} />}
      {loading ? <LoadingState label="Loading calendar…" /> : (
        <div className="calendar-layout">
          <section className="calendar-panel">
            <div className="calendar-heading">
              <div><p className="eyebrow">Monthly view</p><button className="month-title-button" type="button" onClick={openMonthPicker} aria-label="Choose month and year"><span>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)}</span><ChevronDown size={18} /></button></div>
              <div className="calendar-navigation"><button className="icon-button" type="button" onClick={() => animateMonth(-1)} disabled={animating} aria-label="Previous month"><ChevronLeft /></button><button className="today-button" type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(toDateKey(now)); setDragOffset(0) }}>Today</button><button className="icon-button" type="button" onClick={() => animateMonth(1)} disabled={animating} aria-label="Next month"><ChevronRight /></button></div>
            </div>
            <div className="weekday-row" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
            <div
              ref={calendarViewport}
              className="calendar-swipe-viewport"
              onTouchStart={beginSwipe}
              onTouchMove={continueSwipe}
              onTouchEnd={finishSwipe}
              onTouchCancel={cancelSwipe}
            >
              <div className={`calendar-track${dragging ? ' dragging' : ''}${animating ? ' animating' : ''}`} style={{ transform: `translate3d(calc(-100% + ${dragOffset}px), 0, 0)` }}>
                {visibleMonths.map((slideMonth, slideIndex) => {
                  const isCurrentSlide = slideIndex === 1
                  return (
                    <div className="calendar-slide" key={`${slideMonth.getFullYear()}-${slideMonth.getMonth()}`} aria-hidden={!isCurrentSlide}>
                      <div className="calendar-grid">
                        {buildMonthGrid(slideMonth).map((date) => {
                          const key = toDateKey(date)
                          const count = events.filter((event) => toDateKey(new Date(event.start_at)) === key).length
                          const outside = date.getMonth() !== slideMonth.getMonth()
                          const today = key === toDateKey(new Date())
                          return (
                            <button key={key} type="button" tabIndex={isCurrentSlide ? 0 : -1} className={`calendar-day${outside ? ' outside' : ''}${today ? ' today' : ''}${isCurrentSlide && selectedDate === key ? ' selected' : ''}`} onClick={() => { if (isCurrentSlide && !swipeHandled.current) setSelectedDate(key) }}>
                              <span>{date.getDate()}</span>
                              {count > 0 && <small>{count} {count === 1 ? 'event' : 'events'}</small>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
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

function supportsWebPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}
