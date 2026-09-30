import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, Circle, ListFilter, Pencil, Plus, Repeat2, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Task, TaskPriority, TaskRecurrence } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'

type Filter = 'open' | 'completed' | 'all'
const blankForm = { title: '', description: '', priority: 'medium' as TaskPriority, due_date: '', recurrence: 'none' as TaskRecurrence }

export function Tasks({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('open')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadTasks = useCallback(async () => {
    setError('')
    const { data, error: requestError } = await supabase!.from('tasks').select('*').eq('user_id', userId).order('completed').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    if (requestError) setError(requestError.message)
    else setTasks((data || []) as Task[])
    setLoading(false)
  }, [userId])

  useEffect(() => { void loadTasks() }, [loadTasks])

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const matchesFilter = filter === 'all' || (filter === 'completed' ? task.completed : !task.completed)
    const searchText = `${task.title} ${task.description}`.toLowerCase()
    return matchesFilter && searchText.includes(query.toLowerCase())
  }), [tasks, filter, query])

  function openCreate() {
    setEditing(null)
    setForm(blankForm)
    setModalOpen(true)
  }

  function openEdit(task: Task) {
    setEditing(task)
    setForm({ title: task.title, description: task.description || '', priority: task.priority, due_date: task.due_date || '', recurrence: task.recurrence || 'none' })
    setModalOpen(true)
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault()
    if (form.recurrence !== 'none' && !form.due_date) {
      setError('A recurring task requires a due date.')
      return
    }
    setSaving(true)
    setError('')
    const payload = { ...form, title: form.title.trim(), description: form.description.trim(), due_date: form.due_date || null }
    const request = editing
      ? supabase!.from('tasks').update(payload).eq('id', editing.id).eq('user_id', userId)
      : supabase!.from('tasks').insert({ ...payload, user_id: userId })
    const { error: requestError } = await request
    setSaving(false)
    if (requestError) setError(requestError.message)
    else { setModalOpen(false); await loadTasks() }
  }

  async function toggleTask(task: Task) {
    setError('')

    if (task.completed) {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: false } : item))
      const { error: requestError } = await supabase!.from('tasks').update({ completed: false }).eq('id', task.id).eq('user_id', userId)
      if (requestError) { setError(requestError.message); await loadTasks() }
      return
    }

    const shouldCreateNext = task.recurrence && task.recurrence !== 'none' && task.due_date && !task.recurrence_spawned
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: true } : item))

    const { error: completeError } = await supabase!
      .from('tasks')
      .update({ completed: true, ...(shouldCreateNext ? { recurrence_spawned: true } : {}) })
      .eq('id', task.id)
      .eq('user_id', userId)

    if (completeError) {
      setError(completeError.message)
      await loadTasks()
      return
    }

    if (shouldCreateNext) {
      const { error: insertError } = await supabase!.from('tasks').insert({
        user_id: userId,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        due_date: nextRecurringDate(task.due_date!, task.recurrence),
        recurrence: task.recurrence,
        recurrence_spawned: false,
        completed: false,
      })

      if (insertError) {
        await supabase!.from('tasks').update({ recurrence_spawned: false }).eq('id', task.id).eq('user_id', userId)
        setError(`The task was completed, but the next occurrence could not be created: ${insertError.message}`)
      }
      await loadTasks()
    }
  }

  async function confirmDeleteTask() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: requestError } = await supabase!.from('tasks').delete().eq('id', deleteTarget.id).eq('user_id', userId)
    setDeleting(false)
    if (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    }
    else {
      setTasks((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="page-stack">
      <div className="action-row">
        <div className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" /></div>
        <button className="primary-button" id="tour-new-task" type="button" onClick={openCreate}><Plus size={18} />New task</button>
      </div>

      <div className="filter-row" aria-label="Task filters">
        <span><ListFilter size={17} />Show</span>
        {(['open', 'completed', 'all'] as Filter[]).map((item) => <button key={item} type="button" className={filter === item ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>

      {error && <ErrorMessage message={error} />}
      {loading ? <LoadingState label="Loading tasks…" /> : visibleTasks.length === 0 ? (
        <EmptyState icon={<CheckCircle2 />} title={query ? 'No matching tasks' : filter === 'completed' ? 'Nothing completed yet' : 'Your task list is clear'} detail={query ? 'Try a different search term.' : 'Add a task when there is something you want to remember.'} />
      ) : (
        <div className="task-list">
          {visibleTasks.map((task) => (
            <article key={task.id} className={task.completed ? 'task-card completed' : 'task-card'}>
              <button className="task-check" type="button" onClick={() => toggleTask(task)} aria-label={task.completed ? `Mark ${task.title} as open` : `Mark ${task.title} as completed`}>
                {task.completed ? <CheckCircle2 /> : <Circle />}
              </button>
              <div className="task-content">
                <div className="task-title-row"><h3>{task.title}</h3><span className={`priority-label ${task.priority}`}><span>{task.priority === 'high' ? '!' : task.priority === 'medium' ? '–' : '·'}</span>{task.priority} priority</span></div>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <span>{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}</span>
                  {task.recurrence && task.recurrence !== 'none' && <span><Repeat2 size={14} />Repeats {task.recurrence}</span>}
                  {task.completed && <span className="status-text"><Check size={14} />Completed</span>}
                </div>
              </div>
              <div className="card-actions">
                <button className="icon-button" type="button" onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}><Pencil size={17} /></button>
                <button className="icon-button danger" type="button" onClick={() => setDeleteTarget(task)} aria-label={`Delete ${task.title}`}><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal title={editing ? 'Edit task' : 'New task'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveTask}>
          <label><span>Task title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} autoFocus required /></label>
          <label><span>Description <small>Optional</small></span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={1000} /></label>
          <div className="form-grid">
            <label><span>Priority</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label><span>Due date <small>Optional</small></span><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          </div>
          <label>
            <span>Repeat <small>A due date is required</small></span>
            <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as TaskRecurrence })}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</button></div>
        </form>
      </Modal>
      <DeleteConfirmation open={Boolean(deleteTarget)} itemType="task" itemName={deleteTarget?.title || ''} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteTask} />
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function nextRecurringDate(value: string, recurrence: TaskRecurrence) {
  const date = new Date(`${value}T00:00:00`)
  if (recurrence === 'daily') date.setDate(date.getDate() + 1)
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7)
  if (recurrence === 'monthly') {
    const originalDay = date.getDate()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    date.setDate(Math.min(originalDay, lastDay))
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
