import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { ApiError, api } from '../api'
import type { StaffAccount, StaffCreateInput, StaffUser } from '../types'
import {
  ErrorState,
  FormField,
  LoadingState,
  PageHeading,
  PageLoadingScreen,
} from '../components/ui'

type Props = {
  token: string
  notify: (message: string) => void
  onTokenChanged: (token: string) => void
}

type PasswordDraft = {
  current_password: string
  new_password: string
  confirm_password: string
}

const blankStaff = (): StaffCreateInput => ({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
})

const blankPassword = (): PasswordDraft => ({
  current_password: '',
  new_password: '',
  confirm_password: '',
})

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback
}

function fullName(staff: StaffUser) {
  return [staff.first_name, staff.last_name].filter(Boolean).join(' ') || staff.username
}

function lastLoginLabel(value: string | null) {
  if (!value) return 'Never signed in'
  return `Last sign-in ${new Intl.DateTimeFormat('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))}`
}

function PasswordFormField({
  label,
  autoComplete,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  autoComplete: 'current-password' | 'new-password'
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <FormField label={label}>
      <div className="password-input-wrap">
        <input
          required
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-visibility-toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((previous) => !previous)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </FormField>
  )
}

export function MyAccountPage({ token, notify, onTokenChanged }: Props) {
  const [accountResult, setAccountResult] = useState<{
    token: string
    account?: StaffAccount
    error?: string
  } | null>(null)
  const loading = accountResult?.token !== token
  const account = accountResult?.token === token ? accountResult.account ?? null : null
  const accountError = accountResult?.token === token ? accountResult.error ?? '' : ''
  const [profileDraft, setProfileDraft] = useState({
    email: '',
    first_name: '',
    last_name: '',
  })
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState(blankPassword())
  const [currentPasswordAccepted, setCurrentPasswordAccepted] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    let active = true

    api.staffAccount(token)
      .then((result) => {
        if (!active) return
        setAccountResult({ token, account: result })
        setProfileDraft({
          email: result.email,
          first_name: result.first_name,
          last_name: result.last_name,
        })
      })
      .catch((error: unknown) => {
        if (active) {
          setAccountResult({
            token,
            error: messageFor(error, 'Could not load your account.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [token])

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    try {
      const updated = await api.updateStaffAccount(token, profileDraft)
      setAccountResult({ token, account: updated })
      notify('Account details updated.')
    } catch (error: unknown) {
      setProfileError(messageFor(error, 'Could not update account details.'))
    } finally {
      setProfileSaving(false)
    }
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      setPasswordError('The new passwords do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      const result = await api.changeStaffPassword(
        token,
        passwordDraft.current_password,
        passwordDraft.new_password,
      )
      onTokenChanged(result.token)
      setPasswordDraft(blankPassword())
      setCurrentPasswordAccepted(false)
      setAccountResult((previous) =>
        previous?.token === token && previous.account
          ? {
              token,
              account: { ...previous.account, must_change_password: false },
            }
          : previous,
      )
      notify('Password changed.')
    } catch (error: unknown) {
      setPasswordError(messageFor(error, 'Could not change your password.'))
    } finally {
      setPasswordSaving(false)
    }
  }

  const verifyCurrentPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSaving(true)
    try {
      await api.verifyStaffPassword(token, passwordDraft.current_password)
      setCurrentPasswordAccepted(true)
    } catch (error: unknown) {
      setPasswordError(messageFor(error, 'Could not verify the current password.'))
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT"
        title="My account"
        description="Manage your profile, password, and staff access."
      />

      {account?.must_change_password && (
        <div className="account-required-notice" role="status">
          Change your temporary password to unlock the rest of the staff workspace.
        </div>
      )}

      {accountError && <ErrorState message={accountError} />}
      {loading && (
        <>
          <LoadingState label="Loading your account…" />
          <PageLoadingScreen label="Loading your account…" />
        </>
      )}
      {!loading && account && (
        <>
          <div className="account-grid">
            <section className="panel account-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">PROFILE</span>
                  <h2>Account details</h2>
                </div>
              </div>
              {profileError && <div className="form-error" role="alert">{profileError}</div>}
              <form className="form-grid account-form" onSubmit={(event) => void saveProfile(event)}>
                <FormField label="Username">
                  <input value={account.username} disabled />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    value={profileDraft.email}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, email: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="First name">
                  <input
                    autoComplete="given-name"
                    value={profileDraft.first_name}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, first_name: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Last name">
                  <input
                    autoComplete="family-name"
                    value={profileDraft.last_name}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, last_name: event.target.value })
                    }
                  />
                </FormField>
                <div className="form-actions">
                  <button className="button button-primary" disabled={profileSaving}>
                    {profileSaving ? 'Saving…' : 'Save details'}
                  </button>
                </div>
              </form>
            </section>

            <details
              className="panel account-panel account-collapsible"
              open={account.must_change_password}
            >
              <summary className="panel-heading account-accordion-heading">
                <div>
                  <span className="eyebrow">SECURITY</span>
                  <h2>Change password</h2>
                </div>
                <ChevronDown size={18} />
              </summary>
              {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
              <form
                className="form-grid account-form"
                onSubmit={(event) => {
                  if (currentPasswordAccepted) {
                    void changePassword(event)
                  } else {
                    void verifyCurrentPassword(event)
                  }
                }}
              >
                <PasswordFormField
                  label="Current password"
                  autoComplete="current-password"
                  value={passwordDraft.current_password}
                  disabled={currentPasswordAccepted}
                  onChange={(value) =>
                    setPasswordDraft({ ...passwordDraft, current_password: value })
                  }
                />
                {currentPasswordAccepted && (
                  <>
                    <PasswordFormField
                      label="New password"
                      autoComplete="new-password"
                      value={passwordDraft.new_password}
                      onChange={(value) =>
                        setPasswordDraft({ ...passwordDraft, new_password: value })
                      }
                    />
                    <PasswordFormField
                      label="Confirm new password"
                      autoComplete="new-password"
                      value={passwordDraft.confirm_password}
                      onChange={(value) =>
                        setPasswordDraft({ ...passwordDraft, confirm_password: value })
                      }
                    />
                  </>
                )}
                <div className="form-actions">
                  <button className="button button-primary" disabled={passwordSaving}>
                    {passwordSaving
                      ? currentPasswordAccepted
                        ? 'Updating…'
                        : 'Checking…'
                      : currentPasswordAccepted
                        ? 'Update password'
                        : 'Continue'}
                  </button>
                </div>
              </form>
            </details>
          </div>

          {account.is_superuser && (
            <StaffManagement
              token={token}
              currentUsername={account.username}
              notify={notify}
            />
          )}
        </>
      )}
    </>
  )
}

function StaffManagement({
  token,
  currentUsername,
  notify,
}: {
  token: string
  currentUsername: string
  notify: (message: string) => void
}) {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffError, setStaffError] = useState('')
  const [draft, setDraft] = useState(blankStaff())
  const [creating, setCreating] = useState(false)
  const [busyStaffId, setBusyStaffId] = useState<number | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<{
    username: string
    password: string
  } | null>(null)

  useEffect(() => {
    let active = true
    api.staffUsers(token)
      .then((result) => {
        if (active) setStaff(result)
      })
      .catch((error: unknown) => {
        if (active) setStaffError(messageFor(error, 'Could not load staff accounts.'))
      })
      .finally(() => {
        if (active) setStaffLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  const createStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    setStaffError('')
    setTemporaryPassword(null)
    try {
      const result = await api.createStaffUser(token, draft)
      setStaff((previous) =>
        [...previous, result.staff].sort((first, second) =>
          first.username.localeCompare(second.username),
        ),
      )
      setTemporaryPassword({
        username: result.staff.username,
        password: result.temporary_password,
      })
      setDraft(blankStaff())
      notify(`Staff account created for ${result.staff.username}.`)
    } catch (error: unknown) {
      setStaffError(messageFor(error, 'Could not create the staff account.'))
    } finally {
      setCreating(false)
    }
  }

  const resetPassword = async (user: StaffUser) => {
    if (!window.confirm(`Reset the password for ${user.username}? Their active session will end.`)) {
      return
    }
    setBusyStaffId(user.id)
    setStaffError('')
    setTemporaryPassword(null)
    try {
      const result = await api.resetStaffUserPassword(token, user.id)
      setStaff((previous) =>
        previous.map((entry) => (entry.id === user.id ? result.staff : entry)),
      )
      setTemporaryPassword({
        username: result.staff.username,
        password: result.temporary_password,
      })
      notify(`Temporary password created for ${result.staff.username}.`)
    } catch (error: unknown) {
      setStaffError(messageFor(error, 'Could not reset the password.'))
    } finally {
      setBusyStaffId(null)
    }
  }

  const setActive = async (user: StaffUser) => {
    const nextActive = !user.is_active
    if (!nextActive && !window.confirm(`Deactivate ${user.username}'s account?`)) return

    setBusyStaffId(user.id)
    setStaffError('')
    try {
      const updated = await api.setStaffUserActive(token, user.id, nextActive)
      setStaff((previous) =>
        previous.map((entry) => (entry.id === user.id ? updated : entry)),
      )
      notify(`${user.username} is now ${nextActive ? 'active' : 'deactivated'}.`)
    } catch (error: unknown) {
      setStaffError(messageFor(error, 'Could not update the staff account.'))
    } finally {
      setBusyStaffId(null)
    }
  }

  return (
    <details className="panel account-staff-panel account-collapsible">
      <summary className="panel-heading account-accordion-heading">
        <div>
          <span className="eyebrow">TEAM ACCESS</span>
          <h2>Staff accounts</h2>
        </div>
        <span className="account-staff-count">{staff.length} accounts</span>
        <ChevronDown size={18} />
      </summary>

      <form className="form-grid account-create-form" onSubmit={(event) => void createStaff(event)}>
        <FormField label="Username">
          <input
            required
            autoComplete="off"
            value={draft.username}
            onChange={(event) => setDraft({ ...draft, username: event.target.value })}
          />
        </FormField>
        <FormField label="Email (optional)">
          <input
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          />
        </FormField>
        <FormField label="First name">
          <input
            autoComplete="given-name"
            value={draft.first_name}
            onChange={(event) => setDraft({ ...draft, first_name: event.target.value })}
          />
        </FormField>
        <FormField label="Last name">
          <input
            autoComplete="family-name"
            value={draft.last_name}
            onChange={(event) => setDraft({ ...draft, last_name: event.target.value })}
          />
        </FormField>
        <div className="form-actions">
          <button className="button button-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Add staff'}
          </button>
        </div>
      </form>

      {staffError && <div className="form-error account-staff-error" role="alert">{staffError}</div>}
      {temporaryPassword && (
        <div className="account-temporary-password" role="status">
          <div>
            <strong>Temporary password for {temporaryPassword.username}</strong>
            <p>Share it securely; it is shown only once and must be changed after sign-in.</p>
            <code>{temporaryPassword.password}</code>
          </div>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={() => setTemporaryPassword(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {staffLoading && <LoadingState label="Loading staff accounts…" />}
      {!staffLoading && staff.length === 0 && (
        <p className="account-empty">No staff accounts found.</p>
      )}
      {!staffLoading && staff.length > 0 && (
        <div className="account-staff-list">
          {staff.map((user) => {
            const protectedAccount = user.is_superuser || user.username === currentUsername
            return (
              <article className="account-staff-row" key={user.id}>
                <div className="account-staff-identity">
                  <strong>
                    {fullName(user)}
                    {user.username === currentUsername && <span className="account-self-label">You</span>}
                  </strong>
                  <span>@{user.username}{user.email ? ` · ${user.email}` : ''}</span>
                  <small>
                    {user.is_superuser ? 'Superuser' : user.is_active ? 'Active' : 'Deactivated'}
                    {' · '}
                    {lastLoginLabel(user.last_login)}
                    {user.must_change_password ? ' · Password change required' : ''}
                  </small>
                </div>
                <div className="account-staff-actions">
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={protectedAccount || !user.is_active || busyStaffId === user.id}
                    onClick={() => void resetPassword(user)}
                  >
                    Reset password
                  </button>
                  {!protectedAccount && (
                    <button
                      type="button"
                      className={`button button-small ${user.is_active ? 'button-danger button-outline' : 'button-outline'}`}
                      disabled={busyStaffId === user.id}
                      onClick={() => void setActive(user)}
                    >
                      {user.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </details>
  )
}
