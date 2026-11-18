import { useState, type FormEvent } from 'react'
import { ArrowRight, Leaf, LockKeyhole } from 'lucide-react'
import { ApiError, api } from '../api'
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
      <div className="login-brand">
        <span className="login-brand-mark"><Leaf size={22} /></span>
        <span>
          <strong>Kalitusi</strong>
          <small>RESORT NATURE HOTEL</small>
        </span>
      </div>
      <section className="login-card">
        <div className="login-icon"><LockKeyhole size={21} /></div>
        <div className="eyebrow">STAFF ACCESS</div>
        <h1>Welcome back</h1>
        <p className="login-subtitle">
          Sign in to manage orders, your menu, and guest reservations.
        </p>
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
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in to portal'}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </form>
        <div className="login-footnote">
          <LockKeyhole size={14} />
          <span>Staff-only access · your session stays in this browser tab</span>
        </div>
      </section>
      <footer className="login-footer">KALITUSI RESORT NATURE HOTEL <span>·</span> UGANDA</footer>
    </main>
  )
}
