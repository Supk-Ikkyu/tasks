import { useState, type FormEvent } from 'react'
import { CheckSquare2, Eye, EyeOff, Instagram, KeyRound, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ErrorMessage } from '../components/Feedback'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password'

export function Login() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalisedEmail = email.trim().toLowerCase()

    if (mode === 'forgot-password') {
      setLoading(true)
      const { error: resetError } = await supabase!.auth.resetPasswordForEmail(normalisedEmail, {
        redirectTo: `${window.location.origin}/?type=recovery`,
      })
      setLoading(false)
      if (resetError) setError(resetError.message)
      else setSuccess('If an account exists for this address, a password reset link has been sent.')
      return
    }

    if (mode === 'sign-up') {
      if (displayName.trim().length < 2 || displayName.trim().length > 40) {
        setError('Display name must contain between 2 and 40 characters.')
        return
      }
      if (password.length < 8) {
        setError('Password must contain at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.')
        return
      }
    }

    setLoading(true)

    if (mode === 'sign-in') {
      const { error: signInError } = await supabase!.auth.signInWithPassword({
        email: normalisedEmail,
        password,
      })
      setLoading(false)
      if (signInError) setError(signInError.message)
      return
    }

    const { data, error: signUpError } = await supabase!.auth.signUp({
      email: normalisedEmail,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (!data.session) {
      setSuccess('Account created. Please check your email and confirm your address before signing in.')
      setDisplayName('')
      setPassword('')
      setConfirmPassword('')
    }
  }

  const isSignUp = mode === 'sign-up'
  const isForgotPassword = mode === 'forgot-password'

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="brand login-brand">
          <span className="brand-mark"><CheckSquare2 size={23} /></span>
          <span><strong>Tasks</strong></span>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Your personal workspace</p>
          <h1>Keep your work clear and your day considered.</h1>
          <p>Notes, priorities, important links, and schedules—organised in one calm place.</p>
        </div>
        <div className="login-meta">
          <div className="privacy-note"><ShieldCheck size={20} /><span>Each account has a private, separate workspace.</span></div>
          <a className="login-instagram" href="https://www.instagram.com/_.ikkyu._/" target="_blank" rel="noreferrer" aria-label="Open Instagram profile @_.ikkyu._">
            <Instagram size={17} />ig: <span>@_.ikkyu._</span>
          </a>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className={`auth-tabs${isForgotPassword ? ' hidden' : ''}`} role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={!isSignUp} className={!isSignUp ? 'active' : ''} onClick={() => changeMode('sign-in')}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignUp} className={isSignUp ? 'active' : ''} onClick={() => changeMode('sign-up')}>Create account</button>
          </div>

          <div className="form-heading">
            <span className="form-icon">{isForgotPassword ? <KeyRound size={22} /> : isSignUp ? <UserPlus size={22} /> : <LockKeyhole size={22} />}</span>
            <div>
              <h2>{isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}</h2>
              <p>{isForgotPassword ? 'Enter your email address to receive a reset link.' : isSignUp ? 'Create a private workspace of your own.' : 'Sign in to continue to your workspace.'}</p>
            </div>
          </div>

          {error && <ErrorMessage message={error} />}
          {success && <div className="success-message" role="status"><ShieldCheck size={19} /><span>{success}</span></div>}

          {isSignUp && (
            <label>
              <span>Display name <small>2–40 characters</small></span>
              <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" minLength={2} maxLength={40} required />
            </label>
          )}

          <label>
            <span>Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>

          {!isForgotPassword && <label>
            <span>Password {isSignUp && <small>At least 8 characters</small>}</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={isSignUp ? 8 : undefined}
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>}

          {isSignUp && (
            <label>
              <span>Confirm password</span>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
          )}

          <button className="primary-button full-width" type="submit" disabled={loading}>
            {loading
              ? (isForgotPassword ? 'Sending reset link…' : isSignUp ? 'Creating account…' : 'Signing in…')
              : (isForgotPassword ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in')}
          </button>
          {isForgotPassword ? (
            <button className="text-button auth-link" type="button" onClick={() => changeMode('sign-in')}>Back to sign in</button>
          ) : !isSignUp && (
            <button className="text-button auth-link" type="button" onClick={() => changeMode('forgot-password')}>Forgot password?</button>
          )}
        </form>
      </section>
    </div>
  )
}
