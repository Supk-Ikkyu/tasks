import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CheckSquare2, Database, Settings2 } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Section } from './types'
import { Layout } from './components/Layout'
import { LoadingState } from './components/Feedback'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Notes } from './pages/Notes'
import { Links } from './pages/Links'
import { Calendar } from './pages/Calendar'

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ikkyu-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ikkyu-theme', theme)
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <SetupRequired />
  if (authLoading) return <div className="center-page"><LoadingState /></div>
  if (!session) return <Login />

  const userId = session.user.id
  const page = {
    dashboard: <Dashboard userId={userId} navigate={setSection} />,
    tasks: <Tasks userId={userId} />,
    notes: <Notes userId={userId} />,
    calendar: <Calendar userId={userId} />,
    links: <Links userId={userId} />,
  }[section]

  return (
    <Layout
      section={section}
      setSection={setSection}
      theme={theme}
      toggleTheme={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
      onSignOut={() => supabase!.auth.signOut()}
      email={session.user.email || ''}
    >
      {page}
    </Layout>
  )
}
