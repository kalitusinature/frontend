import type { ReactNode } from 'react'
import { X } from 'lucide-react'

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

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${status.replaceAll('_', '-')}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
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
        className="modal-card"
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
