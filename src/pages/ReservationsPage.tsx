import { useEffect, useState } from 'react'
import { BedDouble, Check, Mail, Phone, X } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Reservation, ReservationStatus } from '../types'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  StatusPill,
} from '../components/ui'
import { formatDate, formatDateTime } from '../utils'

const filters: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function ReservationsPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [status, setStatus] = useState<ReservationStatus | 'all'>('all')
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState<{
    key: string
    reservations?: Reservation[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${status}:${refreshKey}`
  const reservations =
    result?.key === requestKey ? result.reservations ?? [] : []
  const loading = result?.key !== requestKey
  const error = actionError || (result?.key === requestKey ? result.error ?? '' : '')

  useEffect(() => {
    let active = true
    api.reservations(token, status)
      .then((result) => {
        if (active) setResult({ key: requestKey, reservations: result })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load reservations.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, status, requestKey])

  const updateStatus = async (reservation: Reservation, next: ReservationStatus) => {
    setWorkingId(reservation.id)
  setActionError('')
    try {
      await api.updateReservation(token, reservation.id, next)
      setRefreshKey((value) => value + 1)
      notify(`Reservation ${reservation.reference} marked ${next}.`)
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update this reservation.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="GUEST SERVICES"
        title="Reservations"
        description="Review lodge and cottage requests, then confirm availability."
      />
      <div className="status-tabs" role="group" aria-label="Filter reservations by status">
        {filters.map((filter) => (
          <button
            type="button"
            className="status-tab"
            aria-pressed={status === filter.value}
            key={filter.value}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <span className="toolbar-count">{reservations.length} requests</span>
      </div>
      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <LoadingState label="Loading guest stays…" />
      ) : reservations.length ? (
        <div className="reservation-list">
          {reservations.map((reservation) => (
            <article className="reservation-card" key={reservation.id}>
              <div className="reservation-card-side">
                <span className="reservation-icon"><BedDouble size={20} /></span>
                <span className="eyebrow">STAY REQUEST</span>
                <strong>{reservation.reference}</strong>
                <small>{formatDateTime(reservation.created_at)}</small>
              </div>
              <div className="reservation-card-main">
                <div className="reservation-title">
                  <div>
                    <h2>{reservation.guest_name}</h2>
                    <span className="reservation-lodge">{reservation.lodge_name}</span>
                  </div>
                  <StatusPill status={reservation.status} />
                </div>
                <div className="reservation-details">
                  <div className="reservation-date-block">
                    <span className="eyebrow">CHECK IN</span>
                    <strong>{formatDate(reservation.check_in)}</strong>
                  </div>
                  <span className="date-arrow">→</span>
                  <div className="reservation-date-block">
                    <span className="eyebrow">CHECK OUT</span>
                    <strong>{formatDate(reservation.check_out)}</strong>
                  </div>
                  <div className="guest-count">
                    {reservation.adults} adult{reservation.adults === 1 ? '' : 's'}
                    {reservation.children ? ` · ${reservation.children} child${reservation.children === 1 ? '' : 'ren'}` : ''}
                  </div>
                </div>
                <div className="reservation-contact">
                  <a href={`tel:${reservation.phone}`}><Phone size={14} /> {reservation.phone}</a>
                  {reservation.email && <a href={`mailto:${reservation.email}`}><Mail size={14} /> {reservation.email}</a>}
                </div>
                {reservation.note && <p className="reservation-note">“{reservation.note}”</p>}
                {reservation.status === 'pending' && (
                  <div className="reservation-actions">
                    <button
                      className="button button-outline button-danger"
                      disabled={workingId === reservation.id}
                      onClick={() => void updateStatus(reservation, 'declined')}
                    >
                      <X size={15} /> Decline
                    </button>
                    <button
                      className="button button-primary button-small"
                      disabled={workingId === reservation.id}
                      onClick={() => void updateStatus(reservation, 'confirmed')}
                    >
                      <Check size={15} />
                      {workingId === reservation.id ? 'Checking…' : 'Confirm stay'}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title={status === 'all' ? 'No reservations yet' : `No ${status} reservations`}
            description="New lodge and cottage requests will appear here."
          />
        </div>
      )}
    </>
  )
}
