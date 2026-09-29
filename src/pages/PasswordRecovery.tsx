import { useState, type FormEvent } from 'react'
import { CheckSquare2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { ErrorMessage } from '../components/Feedback'
import { supabase } from '../lib/supabase'

export function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase!.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    window.history.replaceState({}, '', window.location.origin)
    setSuccess(true)
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="brand login-brand">
          <span className="brand-mark"><CheckSquare2 size={23} /></span>
          <span><strong>Tasks</strong></span>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Account recovery</p>
          <h1>Choose a secure new password.</h1>
          <p>Your tasks, notes, links, and calendar will remain exactly as you left them.</p>
        </div>
        <div className="privacy-note"><ShieldCheck size={20} /><span>Your new password must contain at least eight characters.</span></div>
      </section>

      <section className="login-panel">
        {success ? (
          <div className="login-form">
            <div className="form-heading">
              <span className="form-icon"><ShieldCheck size={22} /></span>
              <div><h2>Password updated</h2><p>Your new password is ready to use.</p></div>
            </div>
            <div className="success-message" role="status"><ShieldCheck size={19} /><span>Your password has been changed successfully.</span></div>
            <button className="primary-button full-width" type="button" onClick={onComplete}>Continue to your workspace</button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-heading">
              <span className="form-icon"><KeyRound size={22} /></span>
              <div><h2>Set a new password</h2><p>Enter and confirm your new password.</p></div>
            </div>
            {error && <ErrorMessage message={error} />}
            <label>
              <span>New password <small>At least 8 characters</small></span>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </label>
            <label><span>Confirm new password</span><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
            <button className="primary-button full-width" type="submit" disabled={loading}>{loading ? 'Updating password…' : 'Update password'}</button>
          </form>
        )}
      </section>
    </div>
  )
}
