import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { ApiError, api } from '../api'
import { InstallAppButton } from '../components/InstallAppButton'
import type { LoginResponse } from '../types'

export function LoginPage({
  onLogin,
  initialError = '',
}: {
  onLogin: (result: LoginResponse) => void
  initialError?: string
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
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
          <h1 id="login-title">Welcome back</h1>
          <p className="login-subtitle">
            Sign in to manage orders, your menu, and guest reservations.
          </p>
        </div>
        <form onSubmit={submit} className="login-form">
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
          <button className="button button-primary login-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in to portal'}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </form>
        <InstallAppButton />
        <div className="login-footnote">
          <LockKeyhole size={14} />
          <span>Secure staff access · your session stays in this browser tab</span>
        </div>
      </section>
    </main>
  )
}
