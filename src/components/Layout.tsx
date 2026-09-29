import type { ReactNode } from 'react'
import {
  CalendarDays,
  CheckSquare2,
  LayoutDashboard,
  Link2,
  LogOut,
  Moon,
  NotebookText,
  Sun,
} from 'lucide-react'
import type { Section } from '../types'

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
  children: ReactNode
}

export function Layout({
  section,
  setSection,
  theme,
  toggleTheme,
  onSignOut,
  email,
  children,
}: LayoutProps) {
  const current = navigation.find((item) => item.id === section)!
  const accountName = email.split('@')[0] || 'Account'
  const avatarLetter = accountName.charAt(0).toUpperCase() || 'A'
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

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
          <div className="account-summary">
            <span className="avatar">{avatarLetter}</span>
            <div><strong>{accountName}</strong><span>{email}</span></div>
          </div>
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
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
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
    </div>
  )
}
