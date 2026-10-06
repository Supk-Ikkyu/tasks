import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Section } from '../types'

interface TourStep {
  title: string
  detail: string
  section?: Section
  target?: string
}

const steps: TourStep[] = [
  {
    title: 'Welcome to Tasks',
    detail: 'This guide introduces every essential part of your workspace. Use Next and Back at your own pace; you can close the guide and replay it from Help at any time.',
    section: 'dashboard',
  },
  {
    title: 'Your daily overview',
    detail: 'The Dashboard gives you a quick picture of open tasks, saved notes, important links, and upcoming events. Select a summary card to move directly to that section.',
    section: 'dashboard',
    target: '#tour-dashboard-overview',
  },
  {
    title: 'Create and organise tasks',
    detail: 'Create a task with a due date, priority, and optional details. Use filters and search to find active, completed, overdue, or important work quickly.',
    section: 'tasks',
    target: '#tour-new-task',
  },
  {
    title: 'Subtasks and repeating work',
    detail: 'Break a large task into smaller checkable subtasks so progress is visible. For routines, set a repeat schedule; the next occurrence keeps the same subtask list.',
    section: 'tasks',
    target: '#tour-new-task',
  },
  {
    title: 'Keep useful notes',
    detail: 'Use Notes for ideas, study references, meeting details, or information you want to keep nearby. Add clear titles so search can find them later.',
    section: 'notes',
    target: '#tour-new-note',
  },
  {
    title: 'Plan with the calendar',
    detail: 'Add events with dates, times, descriptions, and optional reminders. Swipe between months on touch devices or use the month and year controls to jump further ahead.',
    section: 'calendar',
    target: '#tour-calendar-tools',
  },
  {
    title: 'Receive calendar reminders',
    detail: 'Enable background notifications separately on each computer, phone, or tablet. After permission is granted, reminders can arrive even when Tasks is not open.',
    section: 'calendar',
    target: '#tour-calendar-tools',
  },
  {
    title: 'Save important links',
    detail: 'Use Links as a small personal bookmark library for frequently used websites, documents, course pages, or services. Give each link a meaningful title.',
    section: 'links',
  },
  {
    title: 'Focus on one thing',
    detail: 'Open Focus, drag around the circular dial or use the controls to choose 1–90 minutes, then start the countdown. Pause or reset whenever your plan changes.',
    section: 'focus',
    target: '.focus-card',
  },
  {
    title: 'Read the daily U.S. market brief',
    detail: 'Select Market News beside Help to open Market Daily News. Each dated briefing explains the latest completed U.S. session, major index moves, market drivers, important company news, and what to watch next.',
    section: 'dashboard',
    target: '#tour-market-news',
  },
  {
    title: 'Account and security',
    detail: 'Open Account Settings from your name to update your display name, change your password, or sign out. Use Forgot password on the sign-in page if you lose access.',
    section: 'dashboard',
    target: '#tour-account-actions',
  },
  {
    title: 'Export and analyse your data',
    detail: 'Account Settings can download tasks, subtasks, notes, links, and calendar events as JSON. Keep it as a backup or give it to ChatGPT to prioritise work, find overdue tasks, organise notes, and prepare a weekly plan.',
    section: 'dashboard',
    target: '#tour-account-actions',
  },
  {
    title: 'Move around and get help',
    detail: 'Use the sidebar on a computer or the bottom navigation on a phone and tablet. Select Help whenever you want to replay this guide. Your changes sync through your account across supported devices.',
    section: 'dashboard',
    target: '[data-tour="main-navigation"]',
  },
]

interface OnboardingTourProps {
  open: boolean
  onNavigate: (section: Section) => void
  onComplete: () => void
}

interface HighlightRect {
  top: number
  left: number
  width: number
  height: number
}

export function OnboardingTour({ open, onNavigate, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [highlight, setHighlight] = useState<HighlightRect | null>(null)
  const step = steps[stepIndex]

  useEffect(() => {
    if (open) setStepIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (step.section) onNavigate(step.section)

    function updateHighlight() {
      if (!step.target) {
        setHighlight(null)
        return
      }

      const candidates = Array.from(document.querySelectorAll<HTMLElement>(step.target))
      const target = candidates.find((element) => {
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
      })

      if (!target) {
        setHighlight(null)
        return
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const rect = target.getBoundingClientRect()
      const padding = 8
      setHighlight({
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
        height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
      })
    }

    const timer = window.setTimeout(updateHighlight, 180)
    window.addEventListener('resize', updateHighlight)
    window.addEventListener('scroll', updateHighlight, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', updateHighlight)
      window.removeEventListener('scroll', updateHighlight, true)
    }
  }, [open, onNavigate, step])

  const cardStyle = useMemo(() => {
    if (!highlight) return undefined
    const cardWidth = Math.min(420, window.innerWidth - 32)
    const estimatedHeight = 245
    const below = highlight.top + highlight.height + 18
    const top = below + estimatedHeight <= window.innerHeight
      ? below
      : Math.max(16, highlight.top - estimatedHeight - 18)
    const left = Math.min(
      Math.max(16, highlight.left + highlight.width / 2 - cardWidth / 2),
      window.innerWidth - cardWidth - 16,
    )
    return { top, left, width: cardWidth }
  }, [highlight])

  if (!open) return null

  const isLast = stepIndex === steps.length - 1

  function finish() {
    setStepIndex(0)
    onComplete()
  }

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className={highlight ? 'tour-blocker' : 'tour-blocker tour-blocker-solid'} />
      {highlight && <div className="tour-spotlight" style={highlight} aria-hidden="true" />}
      <section className={`tour-card${highlight ? ' positioned' : ''}`} style={cardStyle}>
        <div className="tour-card-heading">
          <span>{stepIndex + 1} of {steps.length}</span>
          <button type="button" onClick={finish} aria-label="Skip guide"><X size={19} /></button>
        </div>
        <span className="tour-icon"><CheckCircle2 size={24} /></span>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.detail}</p>
        <div className="tour-progress" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-hidden="true">
          {steps.map((_, index) => <span key={index} className={index <= stepIndex ? 'active' : ''} />)}
        </div>
        <div className="tour-actions">
          {stepIndex > 0 ? (
            <button className="secondary-button" type="button" onClick={() => setStepIndex((value) => value - 1)}><ChevronLeft size={18} />Back</button>
          ) : (
            <button className="text-button" type="button" onClick={finish}>Skip tour</button>
          )}
          <button className="primary-button" type="button" onClick={() => isLast ? finish() : setStepIndex((value) => value + 1)}>
            {isLast ? 'Finish' : 'Next'}{!isLast && <ChevronRight size={18} />}
          </button>
        </div>
      </section>
    </div>
  )
}
