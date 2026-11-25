import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="loading-state">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function ResultsLoadingIndicator({ label = 'Updating results…' }: { label?: string }) {
  return (
    <div className="results-loading-indicator" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function PageLoadingScreen({ label, delay = 350 }: { label: string; delay?: number }) {
  const [visible, setVisible] = useState(delay === 0)
  const [serverWaking, setServerWaking] = useState(false)

  useEffect(() => {
    const revealTimer = window.setTimeout(() => setVisible(true), delay)
    const slowTimer = window.setTimeout(() => setServerWaking(true), 5000)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(slowTimer)
    }
  }, [delay])

  if (!visible) return null

  return (
    <div className="page-loading-screen" role="status" aria-live="polite">
      <div className="page-loading-card">
        <img
          className="page-loading-logo"
          src={`${import.meta.env.BASE_URL}Kalitusi_Nature_Resort_Sunset_Logo.png`}
          alt="Kalitusi Nature Resort"
        />
        <span className="page-loading-eyebrow">RESORT OPERATIONS</span>
        <span className="page-loading-spinner" aria-hidden="true" />
        <h1>Getting your workspace ready</h1>
        <p className="page-loading-label">{label}</p>
        <div className="page-loading-track" aria-hidden="true">
          <span />
        </div>
        <p className="page-loading-note">
          {serverWaking
            ? 'Render may be waking the server. The first load can take up to a minute; please keep this page open.'
            : 'Connecting securely to your resort data…'}
        </p>
      </div>
    </div>
  )
}

export function ErrorState({
  message,
  retry,
}: {
  message: string
  retry?: () => void
}) {
  return (
    <div className="error-state" role="alert">
      <strong>Something went wrong</strong>
      <span>{message}</span>
      {retry && (
        <button className="button button-outline" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark">—</span>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export function StatusPill({
  status,
  label,
}: {
  status: string
  label?: string
}) {
  return (
    <span className={`status-pill status-${status.replaceAll('_', '-')}`}>
      {label ?? status.replaceAll('_', ' ')}
    </span>
  )
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`modal-card ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function CancellationModal({
  itemType,
  reference,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  itemType: 'order' | 'reservation'
  reference: string
  saving: boolean
  error: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Modal
      className="cancellation-modal"
      title={`Cancel ${itemType}?`}
      subtitle={`${reference} will be marked as cancelled.`}
      onClose={onClose}
    >
      <form
        className="cancellation-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (reason.trim()) onConfirm(reason.trim())
        }}
      >
        <div className="cancellation-notice">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>This action will be recorded. Enter a reason to continue.</p>
        </div>
        <FormField label="Reason (required)">
          <textarea
            required
            autoFocus
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this is being cancelled"
          />
        </FormField>
        <span className="cancellation-character-count">{reason.length}/1000</span>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="cancellation-actions">
          <button type="button" className="button button-outline" onClick={onClose} disabled={saving}>
            Keep {itemType}
          </button>
          <button
            type="submit"
            className="button button-danger button-outline"
            disabled={saving || !reason.trim()}
          >
            {saving ? 'Cancelling…' : `Confirm cancellation`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function FormField({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function FormActions({
  onCancel,
  saving,
  submitLabel,
}: {
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  return (
    <div className="form-actions">
      <button type="button" className="button button-outline" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="button button-primary" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  )
}
