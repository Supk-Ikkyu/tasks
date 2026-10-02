import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Pause, Play, Plus, RotateCcw, Timer, Zap } from 'lucide-react'

interface TimerState {
  durationMinutes: number
  remainingSeconds: number
  running: boolean
  endsAt: number | null
  finished: boolean
}

const DEFAULT_MINUTES = 25
const MAX_MINUTES = 90
const DIAL_RADIUS = 132
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS

export function FocusTimer({ userId }: { userId: string }) {
  const storageKey = `tasks-focus-timer-v2:${userId}`
  const initialState = useMemo(() => readTimer(storageKey), [storageKey])
  const [timer, setTimer] = useState<TimerState>(initialState)
  const dialRef = useRef<SVGSVGElement>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(timer))
  }, [storageKey, timer])

  useEffect(() => {
    if (!timer.running || !timer.endsAt) return
    const updateRemaining = () => {
      const next = Math.max(0, Math.ceil((timer.endsAt! - Date.now()) / 1000))
      if (next === 0) {
        setTimer((current) => ({ ...current, remainingSeconds: 0, running: false, endsAt: null, finished: true }))
        if (!completedRef.current) {
          completedRef.current = true
          playCompletionTone()
        }
      } else {
        setTimer((current) => current.remainingSeconds === next ? current : { ...current, remainingSeconds: next })
      }
    }
    updateRemaining()
    const interval = window.setInterval(updateRemaining, 250)
    return () => window.clearInterval(interval)
  }, [timer.running, timer.endsAt])

  useEffect(() => {
    const originalTitle = document.title
    if (timer.running) document.title = `${formatTime(timer.remainingSeconds)} · Focus | Tasks`
    return () => { document.title = originalTitle }
  }, [timer.running, timer.remainingSeconds])

  function setMinutes(minutes: number) {
    const nextMinutes = Math.min(MAX_MINUTES, Math.max(1, Math.round(minutes)))
    completedRef.current = false
    setTimer({ durationMinutes: nextMinutes, remainingSeconds: nextMinutes * 60, running: false, endsAt: null, finished: false })
  }

  function updateFromPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (timer.running || !dialRef.current) return
    const rect = dialRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    let angle = Math.atan2(y, x) + Math.PI / 2
    if (angle < 0) angle += Math.PI * 2
    const minutes = Math.round((angle / (Math.PI * 2)) * (MAX_MINUTES - 1)) + 1
    setMinutes(minutes)
  }

  function beginDial(event: ReactPointerEvent<SVGSVGElement>) {
    if (timer.running) return
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event)
  }

  function startTimer() {
    completedRef.current = false
    setTimer((current) => {
      const remainingSeconds = current.remainingSeconds > 0 ? current.remainingSeconds : current.durationMinutes * 60
      return { ...current, remainingSeconds, running: true, endsAt: Date.now() + remainingSeconds * 1000, finished: false }
    })
  }

  function pauseTimer() {
    setTimer((current) => ({ ...current, running: false, endsAt: null }))
  }

  function resetTimer() {
    completedRef.current = false
    setTimer((current) => ({ ...current, remainingSeconds: current.durationMinutes * 60, running: false, endsAt: null, finished: false }))
  }

  const remainingRatio = timer.durationMinutes > 0
    ? timer.remainingSeconds / (timer.durationMinutes * 60)
    : 0
  const selectionRatio = (timer.durationMinutes - 1) / (MAX_MINUTES - 1)
  const dialRatio = timer.running || timer.remainingSeconds < timer.durationMinutes * 60 ? remainingRatio : selectionRatio
  const dashOffset = DIAL_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, dialRatio)))
  const knobAngle = selectionRatio * Math.PI * 2 - Math.PI / 2
  const knobX = 160 + DIAL_RADIUS * Math.cos(knobAngle)
  const knobY = 160 + DIAL_RADIUS * Math.sin(knobAngle)

  return (
    <div className="focus-page">
      <section className="focus-card">
        <div className="focus-page-heading">
          <span className="focus-icon"><Timer size={23} /></span>
          <div><p className="eyebrow">Focus session</p><h2>Set a time and focus on one thing</h2></div>
        </div>

        <div className="timer-dial-wrap">
          <svg
            ref={dialRef}
            className={timer.running ? 'timer-dial running' : 'timer-dial'}
            viewBox="0 0 320 320"
            role="slider"
            aria-label="Focus duration"
            aria-valuemin={1}
            aria-valuemax={MAX_MINUTES}
            aria-valuenow={timer.durationMinutes}
            onPointerDown={beginDial}
            onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event) }}
          >
            <circle className="dial-track" cx="160" cy="160" r={DIAL_RADIUS} />
            <circle className="dial-progress" cx="160" cy="160" r={DIAL_RADIUS} strokeDasharray={DIAL_CIRCUMFERENCE} strokeDashoffset={dashOffset} />
            {!timer.running && <circle className="dial-knob" cx={knobX} cy={knobY} r="12" />}
          </svg>
          <div className="timer-display" aria-live="polite">
            <strong>{formatTime(timer.remainingSeconds)}</strong>
            <span>{timer.finished ? 'Session complete' : timer.running ? 'Stay focused' : `${timer.durationMinutes} minutes`}</span>
          </div>
        </div>

        <p className="dial-instruction">Drag around the circle to set 1–90 minutes.</p>

        <div className="minute-adjuster" aria-label="Fine time adjustment">
          <button type="button" onClick={() => setMinutes(timer.durationMinutes - 1)} disabled={timer.running || timer.durationMinutes <= 1} aria-label="Decrease one minute"><Minus size={18} /></button>
          <span>{timer.durationMinutes} min</span>
          <button type="button" onClick={() => setMinutes(timer.durationMinutes + 1)} disabled={timer.running || timer.durationMinutes >= MAX_MINUTES} aria-label="Increase one minute"><Plus size={18} /></button>
        </div>

        <div className="timer-presets" aria-label="Timer presets">
          {[15, 25, 45, 60, 90].map((minutes) => (
            <button key={minutes} className={timer.durationMinutes === minutes ? 'active' : ''} type="button" onClick={() => setMinutes(minutes)} disabled={timer.running}>{minutes} min</button>
          ))}
        </div>

        <div className="focus-page-actions">
          {timer.running ? (
            <button className="primary-button" type="button" onClick={pauseTimer}><Pause size={18} />Pause</button>
          ) : (
            <button className="primary-button" type="button" onClick={startTimer}><Play size={18} />{timer.remainingSeconds < timer.durationMinutes * 60 && timer.remainingSeconds > 0 ? 'Resume' : 'Start focus'}</button>
          )}
          <button className="secondary-button" type="button" onClick={resetTimer}><RotateCcw size={18} />Reset</button>
        </div>

        {timer.finished && <p className="focus-complete"><Zap size={17} />Focus session complete. Take a short break before the next session.</p>}
      </section>
    </div>
  )
}

function readTimer(storageKey: string): TimerState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '') as Partial<TimerState>
    const durationMinutes = clampMinutes(saved.durationMinutes)
    if (saved.running && typeof saved.endsAt === 'number') {
      const remainingSeconds = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000))
      return { durationMinutes, remainingSeconds, running: remainingSeconds > 0, endsAt: remainingSeconds > 0 ? saved.endsAt : null, finished: remainingSeconds === 0 }
    }
    return {
      durationMinutes,
      remainingSeconds: typeof saved.remainingSeconds === 'number' ? Math.max(0, Math.min(durationMinutes * 60, saved.remainingSeconds)) : durationMinutes * 60,
      running: false,
      endsAt: null,
      finished: Boolean(saved.finished),
    }
  } catch {
    return { durationMinutes: DEFAULT_MINUTES, remainingSeconds: DEFAULT_MINUTES * 60, running: false, endsAt: null, finished: false }
  }
}

function clampMinutes(value: unknown) {
  return typeof value === 'number' ? Math.min(MAX_MINUTES, Math.max(1, Math.round(value))) : DEFAULT_MINUTES
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
    // The visual completion state still works when audio is blocked.
  }
}
