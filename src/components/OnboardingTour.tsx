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
    detail: 'This updated guide covers the essential tools in your private workspace, including focus sessions, subtasks, repeating tasks, account security, and data exports.',
    section: 'dashboard',
  },
  {
    title: 'Your daily overview',
    detail: 'The Dashboard brings together your open tasks, saved notes, important links, and upcoming events.',
    section: 'dashboard',
    target: '#tour-dashboard-overview',
  },
  {
    title: 'Create and organise tasks',
    detail: 'Break large tasks into checkable subtasks. Repeating tasks copy their subtask list into the next occurrence.',
    section: 'tasks',
    target: '#tour-new-task',
  },
  {
    title: 'Focus on one thing',
    detail: 'Open Focus from the navigation, drag around the circular dial to set any duration from 1 to 90 minutes, and start the countdown.',
    section: 'focus',
    target: '.focus-card',
  },
  {
    title: 'Keep useful notes',
    detail: 'Create notes for ideas, references, or information you want to keep close at hand.',
    section: 'notes',
    target: '#tour-new-note',
  },
  {
    title: 'Plan with the calendar',
    detail: 'Add events and optional reminders. Enable background notifications on each device to receive reminders even when Tasks is closed.',
    section: 'calendar',
    target: '#tour-calendar-tools',
  },
  {
    title: 'Move between sections',
    detail: 'Use the navigation to open your Dashboard, Tasks, Notes, Calendar, Important Links, and Focus Timer.',
    section: 'dashboard',
    target: '[data-tour="main-navigation"]',
  },
  {
    title: 'Account security and exports',
    detail: 'Open your account settings to change your display name or password and download a JSON copy of your data. Use Forgot password on the sign-in page if you lose access, and select Help to replay this guide.',
    section: 'dashboard',
    target: '#tour-account-actions',
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
        <div className="tour-progress" aria-hidden="true">
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
