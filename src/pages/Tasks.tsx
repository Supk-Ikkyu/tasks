import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, Circle, ListFilter, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Task, TaskPriority } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'

type Filter = 'open' | 'completed' | 'all'
const blankForm = { title: '', description: '', priority: 'medium' as TaskPriority, due_date: '' }

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
    setForm({ title: task.title, description: task.description || '', priority: task.priority, due_date: task.due_date || '' })
    setModalOpen(true)
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault()
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
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))
    const { error: requestError } = await supabase!.from('tasks').update({ completed: !task.completed }).eq('id', task.id).eq('user_id', userId)
    if (requestError) { setError(requestError.message); await loadTasks() }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return
    const { error: requestError } = await supabase!.from('tasks').delete().eq('id', task.id).eq('user_id', userId)
    if (requestError) setError(requestError.message)
    else setTasks((current) => current.filter((item) => item.id !== task.id))
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
                <div className="task-meta"><span>{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}</span>{task.completed && <span className="status-text"><Check size={14} />Completed</span>}</div>
              </div>
              <div className="card-actions">
                <button className="icon-button" type="button" onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}><Pencil size={17} /></button>
                <button className="icon-button danger" type="button" onClick={() => deleteTask(task)} aria-label={`Delete ${task.title}`}><Trash2 size={17} /></button>
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
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</button></div>
        </form>
      </Modal>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}
