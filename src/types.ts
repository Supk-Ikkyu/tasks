export type Section = 'dashboard' | 'tasks' | 'notes' | 'calendar' | 'links' | 'focus'

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Task {
  id: string
  user_id: string
  title: string
  description: string
  completed: boolean
  priority: TaskPriority
  due_date: string | null
  recurrence: TaskRecurrence
  recurrence_spawned: boolean
  created_at: string
  updated_at: string
}

export interface Subtask {
  id: string
  user_id: string
  task_id: string
  title: string
  completed: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface ImportantLink {
  id: string
  user_id: string
  title: string
  url: string
  category: string
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string
  start_at: string
  end_at: string | null
  reminder_minutes: number | null
  created_at: string
  updated_at: string
}
