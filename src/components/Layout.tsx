import { useState, type FormEvent, type ReactNode } from 'react'
import {
  CalendarDays,
  CheckSquare2,
  CircleHelp,
  Download,
  KeyRound,
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
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<string | null>
  onExportData: () => Promise<string | null>
  onStartTour: () => void
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
  onChangePassword,
  onExportData,
  onStartTour,
  children,
}: LayoutProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(displayName)
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
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
    setProfileSuccess('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
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
    setProfileSuccess('Display name updated successfully.')
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setProfileError('')
    setProfileSuccess('')
    if (newPassword.length < 8) {
      setProfileError('New password must contain at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setProfileError('The new passwords do not match.')
      return
    }
    if (currentPassword === newPassword) {
      setProfileError('Choose a new password that is different from your current password.')
      return
    }

    setPasswordSaving(true)
    const updateError = await onChangePassword(currentPassword, newPassword)
    setPasswordSaving(false)
    if (updateError) {
      setProfileError(updateError)
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setProfileSuccess('Password changed successfully.')
  }

  async function exportData() {
    setProfileError('')
    setProfileSuccess('')
    setExporting(true)
    const exportError = await onExportData()
    setExporting(false)
    if (exportError) {
      setProfileError(exportError)
      return
    }
    setProfileSuccess('Your data export has been downloaded.')
  }

  function signOut() {
    setProfileOpen(false)
    onSignOut()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setSection('dashboard')}>
          <span className="brand-mark"><CheckSquare2 size={22} /></span>
          <span><strong>Tasks</strong></span>
        </button>

        <nav className="side-nav" aria-label="Main navigation" data-tour="main-navigation">
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
          <div className="topbar-actions" id="tour-account-actions">
            <button className="theme-toggle" type="button" onClick={onStartTour} aria-label="Open getting started guide">
              <CircleHelp size={19} />
              <span>Help</span>
            </button>
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

      <nav className="mobile-nav" aria-label="Mobile navigation" data-tour="main-navigation">
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
        <div className="account-settings-stack">
          {profileError && <ErrorMessage message={profileError} />}
          {profileSuccess && <div className="success-message" role="status"><CheckSquare2 size={19} /><span>{profileSuccess}</span></div>}

          <section className="account-section">
            <div className="account-section-heading"><UserRound size={19} /><div><h3>Profile</h3><p>Your display name is visible only inside this workspace.</p></div></div>
            <form className="modal-form" onSubmit={saveProfile}>
              <label><span>Display name <small>2–40 characters</small></span><input type="text" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} minLength={2} maxLength={40} autoComplete="nickname" required /></label>
              <label><span>Email address</span><input type="email" value={email} disabled /></label>
              <div className="modal-actions"><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</button></div>
            </form>
          </section>

          <section className="account-section">
            <div className="account-section-heading"><KeyRound size={19} /><div><h3>Change password</h3><p>Confirm your current password before choosing a new one.</p></div></div>
            <form className="modal-form" onSubmit={changePassword}>
              <label><span>Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
              <div className="form-grid">
                <label><span>New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
                <label><span>Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
              </div>
              <div className="modal-actions"><button className="secondary-button" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Changing…' : 'Change password'}</button></div>
            </form>
          </section>

          <section className="account-section export-section">
            <div className="account-section-heading"><Download size={19} /><div><h3>Export your data</h3><p>Download your tasks, subtasks, notes, links, and calendar events as a JSON file.</p></div></div>
            <button className="secondary-button" type="button" onClick={exportData} disabled={exporting}><Download size={17} />{exporting ? 'Preparing export…' : 'Download data'}</button>
          </section>

          <section className="account-section sign-out-section">
            <div><h3>Sign out</h3><p>End your session on this device.</p></div>
            <button className="secondary-button danger-button" type="button" onClick={signOut}><LogOut size={17} />Sign out</button>
          </section>

          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Close</button></div>
        </div>
      </Modal>
    </div>
  )
}
