import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  Link2,
  NotebookText,
  Plus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent, Section, Task } from '../types'
import { ErrorMessage, LoadingState } from '../components/Feedback'

interface DashboardProps {
  userId: string
  navigate: (section: Section) => void
}

interface Summary {
  pendingTasks: number
  notes: number
  links: number
  events: number
  tasks: Task[]
  nextEvent: CalendarEvent | null
}

export function Dashboard({ userId, navigate }: DashboardProps) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  const loadSummary = useCallback(async () => {
    setError('')
    const now = new Date().toISOString()
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const [tasksResult, notesResult, linksResult, eventsResult] = await Promise.all([
      supabase!.from('tasks').select('*', { count: 'exact' }).eq('user_id', userId).eq('completed', false).order('due_date', { ascending: true, nullsFirst: false }).limit(4),
      supabase!.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase!.from('important_links').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase!.from('calendar_events').select('*', { count: 'exact' }).eq('user_id', userId).gte('start_at', now).lte('start_at', weekAhead).order('start_at').limit(1),
    ])

    const firstError = tasksResult.error || notesResult.error || linksResult.error || eventsResult.error
    if (firstError) {
      setError(firstError.message)
      return
    }
    setSummary({
      pendingTasks: tasksResult.count || 0,
      notes: notesResult.count || 0,
      links: linksResult.count || 0,
      events: eventsResult.count || 0,
      tasks: (tasksResult.data || []) as Task[],
      nextEvent: (eventsResult.data?.[0] as CalendarEvent) || null,
    })
  }, [userId])

  useEffect(() => { void loadSummary() }, [loadSummary])

  if (error) return <ErrorMessage message={error} />
  if (!summary) return <LoadingState label="Preparing your overview…" />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="dashboard-page">
      <section className="welcome-card">
        <div>
          <p className="eyebrow">Personal overview</p>
          <h2>{greeting}.</h2>
          <p>You have <strong>{summary.pendingTasks} open {summary.pendingTasks === 1 ? 'task' : 'tasks'}</strong> and <strong>{summary.events} upcoming {summary.events === 1 ? 'event' : 'events'}</strong> in the next seven days.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => navigate('tasks')}><Plus size={18} />Add a task</button>
      </section>

      <section className="stat-grid" aria-label="Workspace summary">
        <button className="stat-card" type="button" onClick={() => navigate('tasks')}>
          <span className="stat-icon blue"><CheckSquare2 /></span><span><strong>{summary.pendingTasks}</strong><small>Open tasks</small></span><ArrowUpRight size={18} />
        </button>
        <button className="stat-card" type="button" onClick={() => navigate('notes')}>
          <span className="stat-icon sand"><NotebookText /></span><span><strong>{summary.notes}</strong><small>Saved notes</small></span><ArrowUpRight size={18} />
        </button>
        <button className="stat-card" type="button" onClick={() => navigate('calendar')}>
          <span className="stat-icon slate"><CalendarDays /></span><span><strong>{summary.events}</strong><small>This week</small></span><ArrowUpRight size={18} />
        </button>
        <button className="stat-card" type="button" onClick={() => navigate('links')}>
          <span className="stat-icon cream"><Link2 /></span><span><strong>{summary.links}</strong><small>Important links</small></span><ArrowUpRight size={18} />
        </button>
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Priority</p><h2>Next tasks</h2></div><button className="text-button" type="button" onClick={() => navigate('tasks')}>View all</button></div>
          {summary.tasks.length === 0 ? (
            <div className="compact-empty"><CheckCircle2 size={22} /><span>No open tasks. Your list is clear.</span></div>
          ) : (
            <div className="dashboard-task-list">
              {summary.tasks.map((task) => (
                <button key={task.id} type="button" onClick={() => navigate('tasks')}>
                  <span className={`priority-symbol ${task.priority}`} aria-label={`${task.priority} priority`}>{task.priority === 'high' ? '!' : task.priority === 'medium' ? '–' : '·'}</span>
                  <span><strong>{task.title}</strong><small>{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}</small></span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel next-event-panel">
          <div className="panel-heading"><div><p className="eyebrow">Schedule</p><h2>Next event</h2></div><button className="text-button" type="button" onClick={() => navigate('calendar')}>Calendar</button></div>
          {summary.nextEvent ? (
            <div className="event-highlight">
              <span className="event-date"><strong>{new Date(summary.nextEvent.start_at).getDate()}</strong><small>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(summary.nextEvent.start_at))}</small></span>
              <div><h3>{summary.nextEvent.title}</h3><p><Clock3 size={16} />{formatTime(summary.nextEvent.start_at)}</p>{summary.nextEvent.description && <span>{summary.nextEvent.description}</span>}</div>
            </div>
          ) : (
            <div className="compact-empty"><CalendarDays size={22} /><span>No event scheduled for the next seven days.</span></div>
          )}
        </section>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
