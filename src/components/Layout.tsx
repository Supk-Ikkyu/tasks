import { useState, type FormEvent, type ReactNode } from 'react'
import {
  CalendarDays,
  CheckSquare2,
  LayoutDashboard,
  Link2,
  LogOut,
  Moon,
  NotebookText,
  Sun,
  UserRound,
} from 'lucide-react'
import type { Section } from '../types'
import { ErrorMessage } from './Feedback'
import { Modal } from './Modal'

const navigation: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare2 },
  { id: 'notes', label: 'Notes', icon: NotebookText },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'links', label: 'Links', icon: Link2 },
]

interface LayoutProps {
  section: Section
  setSection: (section: Section) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  onSignOut: () => void
  email: string
  displayName: string
  onUpdateDisplayName: (displayName: string) => Promise<string | null>
  children: ReactNode
}

export function Layout({
  section,
  setSection,
  theme,
  toggleTheme,
  onSignOut,
  email,
  displayName,
  onUpdateDisplayName,
  children,
}: LayoutProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(displayName)
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const current = navigation.find((item) => item.id === section)!
  const avatarLetter = displayName.charAt(0).toUpperCase() || 'A'
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  function openProfile() {
    setNameDraft(displayName)
    setProfileError('')
    setProfileOpen(true)
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    const nextName = nameDraft.trim()
    if (nextName.length < 2 || nextName.length > 40) {
      setProfileError('Display name must contain between 2 and 40 characters.')
      return
    }

    setProfileSaving(true)
    setProfileError('')
    const updateError = await onUpdateDisplayName(nextName)
    setProfileSaving(false)
    if (updateError) {
      setProfileError(updateError)
      return
    }
    setProfileOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setSection('dashboard')}>
          <span className="brand-mark"><CheckSquare2 size={22} /></span>
          <span><strong>Tasks</strong></span>
        </button>

        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setSection(item.id)}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="account-summary account-summary-button" type="button" onClick={openProfile}>
            <span className="avatar">{avatarLetter}</span>
            <div><strong>{displayName}</strong><span>{email}</span></div>
          </button>
          <button className="nav-item" type="button" onClick={onSignOut}>
            <LogOut size={19} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">{today}</p>
            <h1>{current.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle profile-button" type="button" onClick={openProfile} aria-label="Edit account">
              <UserRound size={19} />
              <span>{displayName}</span>
            </button>
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
              <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'}
              onClick={() => setSection(item.id)}
              aria-label={item.label}
              aria-current={section === item.id ? 'page' : undefined}
            >
              <Icon size={21} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <Modal title="Account settings" open={profileOpen} onClose={() => setProfileOpen(false)}>
        <form className="modal-form" onSubmit={saveProfile}>
          {profileError && <ErrorMessage message={profileError} />}
          <label>
            <span>Display name <small>2–40 characters</small></span>
            <input type="text" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} minLength={2} maxLength={40} autoComplete="nickname" required autoFocus />
          </label>
          <label>
            <span>Email address</span>
            <input type="email" value={email} disabled />
          </label>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
