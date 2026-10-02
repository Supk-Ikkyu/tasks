import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, ChevronDown, ChevronUp, Circle, ListChecks, ListFilter, Pencil, Plus, Repeat2, Search, Timer, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Subtask, Task, TaskPriority, TaskRecurrence } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'
import { FocusTimer } from '../components/FocusTimer'

type Filter = 'open' | 'completed' | 'all'
const blankForm = { title: '', description: '', priority: 'medium' as TaskPriority, due_date: '', recurrence: 'none' as TaskRecurrence }

export function Tasks({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
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
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({})
  const [addingSubtask, setAddingSubtask] = useState<string | null>(null)
  const [subtaskDeleteTarget, setSubtaskDeleteTarget] = useState<Subtask | null>(null)
  const [focusTaskId, setFocusTaskId] = useState('')

  const loadTasks = useCallback(async () => {
    setError('')
    const [tasksResult, subtasksResult] = await Promise.all([
      supabase!.from('tasks').select('*').eq('user_id', userId).order('completed').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase!.from('subtasks').select('*').eq('user_id', userId).order('position').order('created_at'),
    ])
    const requestError = tasksResult.error || subtasksResult.error
    if (requestError) setError(requestError.message)
    else {
      setTasks((tasksResult.data || []) as Task[])
      setSubtasks((subtasksResult.data || []) as Subtask[])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { void loadTasks() }, [loadTasks])

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const matchesFilter = filter === 'all' || (filter === 'completed' ? task.completed : !task.completed)
    const childText = subtasks.filter((subtask) => subtask.task_id === task.id).map((subtask) => subtask.title).join(' ')
    const searchText = `${task.title} ${task.description} ${childText}`.toLowerCase()
    return matchesFilter && searchText.includes(query.toLowerCase())
  }), [tasks, subtasks, filter, query])

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
      const { data: nextTask, error: insertError } = await supabase!.from('tasks').insert({
        user_id: userId,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        due_date: nextRecurringDate(task.due_date!, task.recurrence),
        recurrence: task.recurrence,
        recurrence_spawned: false,
        completed: false,
      }).select('id').single()

      if (insertError) {
        await supabase!.from('tasks').update({ recurrence_spawned: false }).eq('id', task.id).eq('user_id', userId)
        setError(`The task was completed, but the next occurrence could not be created: ${insertError.message}`)
      } else {
        const childItems = subtasks.filter((subtask) => subtask.task_id === task.id)
        if (childItems.length > 0) {
          const { error: copyError } = await supabase!.from('subtasks').insert(childItems.map((subtask, index) => ({
            user_id: userId,
            task_id: nextTask.id,
            title: subtask.title,
            completed: false,
            position: index,
          })))
          if (copyError) setError(`The next task was created, but its subtasks could not be copied: ${copyError.message}`)
        }
      }
      await loadTasks()
    }
  }

  function toggleSubtasks(taskId: string) {
    setExpandedTasks((current) => {
      const next = new Set(current)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  async function addSubtask(event: FormEvent, taskId: string) {
    event.preventDefault()
    const title = (subtaskDrafts[taskId] || '').trim()
    if (!title) return
    setAddingSubtask(taskId)
    setError('')
    const taskSubtasks = subtasks.filter((subtask) => subtask.task_id === taskId)
    const { data, error: requestError } = await supabase!.from('subtasks').insert({
      user_id: userId,
      task_id: taskId,
      title,
      position: taskSubtasks.length,
    }).select('*').single()
    setAddingSubtask(null)
    if (requestError) setError(requestError.message)
    else {
      setSubtasks((current) => [...current, data as Subtask])
      setSubtaskDrafts((current) => ({ ...current, [taskId]: '' }))
    }
  }

  async function toggleSubtask(subtask: Subtask) {
    const completed = !subtask.completed
    setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, completed } : item))
    const { error: requestError } = await supabase!.from('subtasks').update({ completed }).eq('id', subtask.id).eq('user_id', userId)
    if (requestError) {
      setError(requestError.message)
      await loadTasks()
    }
  }

  async function confirmDeleteSubtask() {
    if (!subtaskDeleteTarget) return
    setDeleting(true)
    const { error: requestError } = await supabase!.from('subtasks').delete().eq('id', subtaskDeleteTarget.id).eq('user_id', userId)
    setDeleting(false)
    if (requestError) setError(requestError.message)
    else setSubtasks((current) => current.filter((item) => item.id !== subtaskDeleteTarget.id))
    setSubtaskDeleteTarget(null)
  }

  function focusOnTask(taskId: string) {
    setFocusTaskId(taskId)
    window.requestAnimationFrame(() => document.getElementById('focus-timer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
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
      setSubtasks((current) => current.filter((item) => item.task_id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="page-stack">
      <FocusTimer userId={userId} tasks={tasks} requestedTaskId={focusTaskId} />

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
          {visibleTasks.map((task) => {
            const taskSubtasks = subtasks.filter((subtask) => subtask.task_id === task.id)
            const completedSubtasks = taskSubtasks.filter((subtask) => subtask.completed).length
            const expanded = expandedTasks.has(task.id)
            const subtaskProgress = taskSubtasks.length > 0 ? (completedSubtasks / taskSubtasks.length) * 100 : 0
            return (
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
                    {taskSubtasks.length > 0 && <span><ListChecks size={14} />{completedSubtasks} of {taskSubtasks.length} subtasks</span>}
                    {task.completed && <span className="status-text"><Check size={14} />Completed</span>}
                  </div>

                  <div className="subtask-section">
                    <button className="subtask-toggle" type="button" onClick={() => toggleSubtasks(task.id)} aria-expanded={expanded}>
                      <span><ListChecks size={16} />{taskSubtasks.length === 0 ? 'Add subtasks' : `${completedSubtasks} of ${taskSubtasks.length} completed`}</span>
                      {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    </button>
                    {taskSubtasks.length > 0 && <div className="subtask-progress" aria-hidden="true"><span style={{ width: `${subtaskProgress}%` }} /></div>}
                    {expanded && (
                      <div className="subtask-panel">
                        {taskSubtasks.length > 0 && (
                          <div className="subtask-list">
                            {taskSubtasks.map((subtask) => (
                              <div className={subtask.completed ? 'subtask-row completed' : 'subtask-row'} key={subtask.id}>
                                <button type="button" onClick={() => toggleSubtask(subtask)} aria-label={subtask.completed ? `Mark ${subtask.title} as open` : `Mark ${subtask.title} as completed`}>
                                  {subtask.completed ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                                </button>
                                <span>{subtask.title}</span>
                                <button className="subtask-delete" type="button" onClick={() => setSubtaskDeleteTarget(subtask)} aria-label={`Delete ${subtask.title}`}><Trash2 size={15} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <form className="subtask-form" onSubmit={(event) => addSubtask(event, task.id)}>
                          <input value={subtaskDrafts[task.id] || ''} onChange={(event) => setSubtaskDrafts((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Add a smaller step" maxLength={200} aria-label={`Add a subtask to ${task.title}`} />
                          <button className="secondary-button" type="submit" disabled={addingSubtask === task.id || !(subtaskDrafts[task.id] || '').trim()}><Plus size={16} />Add</button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
                <div className="card-actions">
                  {!task.completed && <button className="icon-button" type="button" onClick={() => focusOnTask(task.id)} aria-label={`Focus on ${task.title}`} title="Start a focus session"><Timer size={17} /></button>}
                  <button className="icon-button" type="button" onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}><Pencil size={17} /></button>
                  <button className="icon-button danger" type="button" onClick={() => setDeleteTarget(task)} aria-label={`Delete ${task.title}`}><Trash2 size={17} /></button>
                </div>
              </article>
            )
          })}
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
      <DeleteConfirmation open={Boolean(subtaskDeleteTarget)} itemType="subtask" itemName={subtaskDeleteTarget?.title || ''} deleting={deleting} onCancel={() => setSubtaskDeleteTarget(null)} onConfirm={confirmDeleteSubtask} />
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
