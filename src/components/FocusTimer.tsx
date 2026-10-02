import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Timer, Zap } from 'lucide-react'
import type { Task } from '../types'

interface FocusTimerProps {
  userId: string
  tasks: Task[]
  requestedTaskId: string
}

interface TimerState {
  taskId: string
  duration: number
  remaining: number
  running: boolean
  endsAt: number | null
  finished: boolean
}

const DEFAULT_DURATION = 25 * 60

export function FocusTimer({ userId, tasks, requestedTaskId }: FocusTimerProps) {
  const storageKey = `tasks-focus-timer-v1:${userId}`
  const initialState = useMemo(() => readTimer(storageKey), [storageKey])
  const [timer, setTimer] = useState<TimerState>(initialState)
  const completedRef = useRef(false)
  const openTasks = tasks.filter((task) => !task.completed)
  const selectedTask = tasks.find((task) => task.id === timer.taskId)

  useEffect(() => {
    if (!requestedTaskId) return
    setTimer((current) => ({ ...current, taskId: requestedTaskId }))
  }, [requestedTaskId])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(timer))
  }, [storageKey, timer])

  useEffect(() => {
    if (!timer.running || !timer.endsAt) return
    const updateRemaining = () => {
      const next = Math.max(0, Math.ceil((timer.endsAt! - Date.now()) / 1000))
      if (next === 0) {
        setTimer((current) => ({ ...current, remaining: 0, running: false, endsAt: null, finished: true }))
        if (!completedRef.current) {
          completedRef.current = true
          playCompletionTone()
        }
      } else {
        setTimer((current) => current.remaining === next ? current : { ...current, remaining: next })
      }
    }
    updateRemaining()
    const interval = window.setInterval(updateRemaining, 250)
    return () => window.clearInterval(interval)
  }, [timer.running, timer.endsAt])

  useEffect(() => {
    const originalTitle = document.title
    if (timer.running) document.title = `${formatTime(timer.remaining)} · ${selectedTask?.title || 'Focus'} | Tasks`
    return () => { document.title = originalTitle }
  }, [timer.running, timer.remaining, selectedTask?.title])

  function startTimer() {
    completedRef.current = false
    setTimer((current) => {
      const remaining = current.remaining > 0 ? current.remaining : current.duration
      return { ...current, remaining, running: true, endsAt: Date.now() + remaining * 1000, finished: false }
    })
  }

  function pauseTimer() {
    setTimer((current) => ({ ...current, running: false, endsAt: null }))
  }

  function resetTimer() {
    completedRef.current = false
    setTimer((current) => ({ ...current, remaining: current.duration, running: false, endsAt: null, finished: false }))
  }

  function changeDuration(duration: number) {
    setTimer((current) => ({ ...current, duration, remaining: duration, running: false, endsAt: null, finished: false }))
  }

  const progress = timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0

  return (
    <section className={timer.running ? 'focus-timer running' : 'focus-timer'} id="focus-timer" aria-label="Focus timer">
      <div className="focus-timer-heading">
        <span className="focus-icon"><Timer size={22} /></span>
        <div><p className="eyebrow">Focus session</p><h2>{selectedTask?.title || 'Choose a task and begin'}</h2></div>
      </div>
      <div className="focus-timer-controls">
        <label className="focus-field">
          <span>Task</span>
          <select value={timer.taskId} onChange={(event) => setTimer((current) => ({ ...current, taskId: event.target.value }))}>
            <option value="">General focus</option>
            {openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
        </label>
        <label className="focus-field duration-field">
          <span>Duration</span>
          <select value={timer.duration} onChange={(event) => changeDuration(Number(event.target.value))} disabled={timer.running}>
            <option value={15 * 60}>15 minutes</option>
            <option value={25 * 60}>25 minutes</option>
            <option value={50 * 60}>50 minutes</option>
            <option value={90 * 60}>90 minutes</option>
          </select>
        </label>
        <div className="focus-clock" aria-live="polite">
          <strong>{formatTime(timer.remaining)}</strong>
          <small>{timer.finished ? 'Session complete' : timer.running ? 'Stay focused' : 'Ready when you are'}</small>
        </div>
        <div className="focus-buttons">
          {timer.running ? (
            <button className="primary-button" type="button" onClick={pauseTimer}><Pause size={17} />Pause</button>
          ) : (
            <button className="primary-button" type="button" onClick={startTimer}><Play size={17} />{timer.remaining < timer.duration && timer.remaining > 0 ? 'Resume' : 'Start'}</button>
          )}
          <button className="secondary-button" type="button" onClick={resetTimer}><RotateCcw size={17} />Reset</button>
        </div>
      </div>
      <div className="focus-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
      {timer.finished && <p className="focus-complete"><Zap size={16} />Focus session complete. Take a short break or start another session.</p>}
    </section>
  )
}

function readTimer(storageKey: string): TimerState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '') as Partial<TimerState>
    const duration = typeof saved.duration === 'number' && saved.duration > 0 ? saved.duration : DEFAULT_DURATION
    if (saved.running && typeof saved.endsAt === 'number') {
      const remaining = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000))
      return {
        taskId: typeof saved.taskId === 'string' ? saved.taskId : '',
        duration,
        remaining,
        running: remaining > 0,
        endsAt: remaining > 0 ? saved.endsAt : null,
        finished: remaining === 0,
      }
    }
    return {
      taskId: typeof saved.taskId === 'string' ? saved.taskId : '',
      duration,
      remaining: typeof saved.remaining === 'number' ? Math.max(0, saved.remaining) : duration,
      running: false,
      endsAt: null,
      finished: Boolean(saved.finished),
    }
  } catch {
    return { taskId: '', duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION, running: false, endsAt: null, finished: false }
  }
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function playCompletionTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 660
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.5)
  } catch {
    // The visual completion state still works when audio is blocked by the browser.
  }
}
