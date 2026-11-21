import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { ApiError, api } from '../api'
import { InstallAppButton } from '../components/InstallAppButton'
import type { LoginResponse } from '../types'

type LoginMode = 'login' | 'forgot' | 'reset'

export function LoginPage({
  onLogin,
  initialError = '',
}: {
  onLogin: (result: LoginResponse) => void
  initialError?: string
}) {
  const resetParams = new URLSearchParams(window.location.search)
  const resetUid = resetParams.get('uid') ?? ''
  const resetToken = resetParams.get('token') ?? ''
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<LoginMode>(() =>
    resetParams.get('reset') === '1' ? 'reset' : 'login',
  )
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      onLogin(await api.login(username.trim(), password))
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to reach the server. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const requestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await api.requestStaffPasswordReset(email.trim())
      setMessage(
        'If an active staff account uses that email, password reset instructions have been sent.',
      )
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to reach the server. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const confirmPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!resetUid || !resetToken) {
      setError('This reset link is incomplete. Request a new password reset link.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.confirmStaffPasswordReset(
        resetUid,
        resetToken,
        newPassword,
      )
      window.history.replaceState({}, document.title, window.location.pathname)
      setMode('login')
      setNewPassword('')
      setConfirmPassword('')
      setMessage(result.detail)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to reach the server. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const changeMode = (nextMode: LoginMode) => {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  const requestAnotherLink = () => {
    window.history.replaceState({}, document.title, window.location.pathname)
    changeMode('forgot')
  }

  return (
    <main className="login-screen">
      <section className="login-showcase" aria-label="Kalitusi Resort staff workspace">
        <div className="login-brand">
          <span className="login-brand-mark">
            <img
              src={`${import.meta.env.BASE_URL}kalitusi logo.jpg`}
              alt=""
            />
          </span>
          <span>
            <strong>Kalitusi</strong>
            <small>RESORT NATURE HOTEL</small>
          </span>
        </div>
        <div className="login-showcase-copy">
          <span className="login-kicker"><span /> STAFF WORKSPACE</span>
          <h2>Hospitality,<br /><em>thoughtfully managed.</em></h2>
          <p>Orders, reservations, and the details that make every guest stay special — all in one place.</p>
        </div>
        <div className="login-showcase-footer">
          <span>RESORT OPERATIONS</span>
          <span>UGANDA</span>
        </div>
        <img
          className="login-mobile-logo"
          src="https://res.cloudinary.com/gxsjjdye/image/upload/v1795006660/kalitusi_logo.jpg"
          alt="Kalitusi Resort Nature Hotel"
        />
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-heading">
          <div className="login-icon"><LockKeyhole size={20} /></div>
          <div className="eyebrow">STAFF ACCESS</div>
          <h1 id="login-title">
            {mode === 'forgot'
              ? 'Reset your password'
              : mode === 'reset'
                ? 'Choose a new password'
                : 'Welcome back'}
          </h1>
          <p className="login-subtitle">
            {mode === 'forgot'
              ? 'Enter the email address saved on your staff account.'
              : mode === 'reset'
                ? 'Choose a strong password for your staff account.'
                : 'Sign in to manage orders, your menu, and guest reservations.'}
          </p>
        </div>
        {mode === 'login' && (
          <form onSubmit={submitLogin} className="login-form">
            <label className="form-field">
              <span>Username</span>
              <input
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your staff username"
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="password-visibility-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            {message && <div className="login-success" role="status">{message}</div>}
            <button
              type="button"
              className="login-secondary-action"
              onClick={() => changeMode('forgot')}
            >
              Forgot password?
            </button>
            <button className="button button-primary login-submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in to portal'}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>
        )}
        {mode === 'forgot' && (
          <form onSubmit={requestPasswordReset} className="login-form">
            <label className="form-field">
              <span>Account email</span>
              <input
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email on your staff account"
              />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            {message && <div className="login-success" role="status">{message}</div>}
            <button className="button button-primary login-submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="login-secondary-action"
              onClick={() => changeMode('login')}
            >
              Back to sign in
            </button>
          </form>
        )}
        {mode === 'reset' && (!resetUid || !resetToken) && (
          <div className="login-form">
            <div className="form-error" role="alert">
              This reset link is incomplete. Request a new one.
            </div>
            <button
              type="button"
              className="login-secondary-action"
              onClick={requestAnotherLink}
            >
              Request a new link
            </button>
          </div>
        )}
        {mode === 'reset' && resetUid && resetToken && (
          <form onSubmit={confirmPasswordReset} className="login-form">
            <label className="form-field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                autoFocus
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter a new password"
              />
            </label>
            <label className="form-field">
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Enter the new password again"
              />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            {message && <div className="login-success" role="status">{message}</div>}
            <button className="button button-primary login-submit" disabled={submitting}>
              {submitting ? 'Updating…' : 'Reset password'}
            </button>
            <button
              type="button"
              className="login-secondary-action"
              onClick={requestAnotherLink}
            >
              Request another link
            </button>
          </form>
        )}
        <InstallAppButton />
        <div className="login-footnote">
          <LockKeyhole size={14} />
          <span>Secure staff access · your session stays in this browser tab</span>
        </div>
      </section>
    </main>
  )
}
