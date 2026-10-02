import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CheckSquare2, Database, Settings2 } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Section } from './types'
import { Layout } from './components/Layout'
import { LoadingState } from './components/Feedback'
import { OnboardingTour } from './components/OnboardingTour'
import { Login } from './pages/Login'
import { PasswordRecovery } from './pages/PasswordRecovery'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Notes } from './pages/Notes'
import { Links } from './pages/Links'
import { Calendar } from './pages/Calendar'
import { FocusTimer } from './pages/FocusTimer'

function SetupRequired() {
  return (
    <div className="setup-page">
      <section className="setup-card">
        <span className="setup-icon"><Settings2 size={30} /></span>
        <p className="eyebrow">One-time setup required</p>
        <h1>Connect your Supabase project</h1>
        <p>Add the project URL and anonymous key to a local <code>.env</code> file, then restart the development server.</p>
        <div className="setup-steps">
          <div><Database size={20} /><span>Create the database using <code>supabase/schema.sql</code>.</span></div>
          <div><CheckSquare2 size={20} /><span>Copy <code>.env.example</code> to <code>.env</code> and add your project values.</span></div>
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [section, setSection] = useState<Section>('dashboard')
  const [tourOpen, setTourOpen] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).get('type') === 'recovery' || window.location.hash.includes('type=recovery'))
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('tasks-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tasks-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setAuthLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const completedVersion = Number(session.user.user_metadata.onboarding_version || 0)
    if (completedVersion < 3) setTourOpen(true)
  }, [session])

  if (!isSupabaseConfigured) return <SetupRequired />
  if (authLoading) return <div className="center-page"><LoadingState /></div>
  if (!session) return <Login />
  if (passwordRecovery) return <PasswordRecovery onComplete={() => setPasswordRecovery(false)} />

  const userId = session.user.id
  const metadataName = session.user.user_metadata.display_name
  const displayName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : (session.user.email?.split('@')[0] || 'Account')
  const page = {
    dashboard: <Dashboard userId={userId} navigate={setSection} displayName={displayName} />,
    tasks: <Tasks userId={userId} />,
    notes: <Notes userId={userId} />,
    calendar: <Calendar userId={userId} />,
    links: <Links userId={userId} />,
    focus: <FocusTimer userId={userId} />,
  }[section]

  return (
    <Layout
      section={section}
      setSection={setSection}
      theme={theme}
      toggleTheme={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
      onSignOut={() => supabase!.auth.signOut()}
      email={session.user.email || ''}
      displayName={displayName}
      onStartTour={() => setTourOpen(true)}
      onUpdateDisplayName={async (nextName) => {
        const { error } = await supabase!.auth.updateUser({
          data: { display_name: nextName.trim() },
        })
        return error?.message || null
      }}
      onChangePassword={async (currentPassword, newPassword) => {
        const email = session.user.email
        if (!email) return 'No email address is associated with this account.'
        const { error: verificationError } = await supabase!.auth.signInWithPassword({
          email,
          password: currentPassword,
        })
        if (verificationError) return 'The current password is incorrect.'
        const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword })
        return updateError?.message || null
      }}
      onExportData={async () => {
        const tables = ['tasks', 'subtasks', 'notes', 'important_links', 'calendar_events'] as const
        const results = await Promise.all(tables.map((table) =>
          supabase!.from(table).select('*').eq('user_id', userId),
        ))
        const failed = results.find((result) => result.error)
        if (failed?.error) return failed.error.message

        const exportPayload = {
          schema_version: 2,
          exported_at: new Date().toISOString(),
          account: { email: session.user.email || '', display_name: displayName },
          tasks: results[0].data || [],
          subtasks: results[1].data || [],
          notes: results[2].data || [],
          important_links: results[3].data || [],
          calendar_events: results[4].data || [],
        }
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(downloadUrl)
        return null
      }}
    >
      {page}
      <OnboardingTour
        open={tourOpen}
        onNavigate={setSection}
        onComplete={() => {
          setTourOpen(false)
          void supabase!.auth.updateUser({ data: { onboarding_version: 3 } })
        }}
      />
    </Layout>
  )
}
