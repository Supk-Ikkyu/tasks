import { useState, type FormEvent } from 'react'
import { CheckSquare2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { allowedEmail, supabase } from '../lib/supabase'
import { ErrorMessage } from '../components/Feedback'

export function Login() {
  const [email, setEmail] = useState(allowedEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (email.trim().toLowerCase() !== allowedEmail) {
      setError('This account is not authorised to access Ikkyu Tasks.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase!.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (signInError) setError(signInError.message)
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="brand login-brand">
          <span className="brand-mark"><CheckSquare2 size={23} /></span>
          <span><strong>Ikkyu</strong> Tasks</span>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Private personal workspace</p>
          <h1>Keep your work clear and your day considered.</h1>
          <p>Notes, priorities, important links, and schedules—organised in one calm place.</p>
        </div>
        <div className="privacy-note"><ShieldCheck size={20} /><span>Access is restricted to one authorised account.</span></div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <span className="form-icon"><LockKeyhole size={22} /></span>
            <div><h2>Welcome back</h2><p>Sign in to continue to your workspace.</p></div>
          </div>
          {error && <ErrorMessage message={error} />}
          <label>
            <span>Email address</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          <button className="primary-button full-width" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}
