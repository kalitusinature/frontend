import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Ban,
  BedDouble,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { ApiError, api } from '../api'
import { RecordPaymentModal } from '../components/RecordPaymentModal'
import type {
  DashboardData,
  Lodge,
  Reservation,
  ReservationInput,
  ReservationSource,
  ReservationStatus,
} from '../types'
import {
  EmptyState,
  ErrorState,
  CancellationModal,
  FormActions,
  FormField,
  LoadingState,
  Modal,
  PageHeading,
  PageLoadingScreen,
  ResultsLoadingIndicator,
  StatusPill,
} from '../components/ui'
import {
  formatDate,
  formatDateTime,
  formatUGX,
  reservationStatusLabels,
} from '../utils'

const filters: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: reservationStatusLabels.pending },
  { value: 'confirmed', label: reservationStatusLabels.confirmed },
  { value: 'declined', label: reservationStatusLabels.declined },
  { value: 'cancelled', label: reservationStatusLabels.cancelled },
  { value: 'checked_in', label: reservationStatusLabels.checked_in },
  { value: 'completed', label: reservationStatusLabels.completed },
]

const sourceOptions: { value: ReservationSource; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone call' },
  { value: 'staff', label: 'Admin / staff' },
]

type CalendarMode = 'day' | 'week' | 'month'

function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDateValue(date)
}

function calendarWindow(mode: CalendarMode, focusDate: string): { start: string; end: string } {
  if (mode === 'day') return { start: focusDate, end: shiftDate(focusDate, 1) }
  if (mode === 'week') {
    const date = new Date(`${focusDate}T12:00:00`)
    const mondayOffset = (date.getDay() + 6) % 7
    const start = shiftDate(focusDate, -mondayOffset)
    return { start, end: shiftDate(start, 7) }
  }
  const date = new Date(`${focusDate}T12:00:00`)
  const start = localDateValue(new Date(date.getFullYear(), date.getMonth(), 1, 12))
  const end = localDateValue(new Date(date.getFullYear(), date.getMonth() + 1, 1, 12))
  return { start, end }
}

function blankReservation(lodgeId: number): ReservationInput {
  const today = localDateValue(new Date())
  return {
    status: 'pending',
    source: 'staff',
    lodge: lodgeId,
    guest_name: '',
    email: '',
    phone: '',
    check_in: today,
    check_out: shiftDate(today, 1),
    adults: 1,
    children: 0,
    total_due_ugx: 0,
    note: '',
    occasion: '',
  }
}

export function ReservationsPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [status, setStatus] = useState<ReservationStatus | 'all'>('all')
  const [source, setSource] = useState<ReservationSource | 'all'>('all')
  const [lodgeFilter, setLodgeFilter] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [ordering, setOrdering] = useState<'-created_at' | 'check_in'>('-created_at')
  const [page, setPage] = useState(1)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [cancellationReservation, setCancellationReservation] = useState<Reservation | null>(null)
  const [deletingReservation, setDeletingReservation] = useState<Reservation | null>(null)
  const [paymentReservation, setPaymentReservation] = useState<Reservation | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionError, setActionError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [lodges, setLodges] = useState<Lodge[]>([])
  const [lodgeError, setLodgeError] = useState('')
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<ReservationInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [result, setResult] = useState<{
    key: string
    reservations?: Reservation[]
    count?: number
    error?: string
  } | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week')
  const [calendarDate, setCalendarDate] = useState(() => localDateValue(new Date()))
  const [calendarResult, setCalendarResult] = useState<{
    key: string
    reservations?: Reservation[]
    error?: string
  } | null>(null)
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null)

  const requestKey = `${token}:${status}:${source}:${lodgeFilter}:${query}:${startDate}:${endDate}:${ordering}:${page}`
  const reservations = result?.key === requestKey ? result.reservations ?? [] : []
  const count = result?.key === requestKey ? result.count ?? 0 : 0
  const loading = result?.key !== requestKey
  const error = actionError || (result?.key === requestKey ? result.error ?? '' : '')
  const dateWindow = useMemo(
    () => calendarWindow(calendarMode, calendarDate),
    [calendarDate, calendarMode],
  )
  const calendarKey = `${token}:${dateWindow.start}:${dateWindow.end}`
  const calendarReservations =
    calendarResult?.key === calendarKey ? calendarResult.reservations ?? [] : []
  const calendarLoading = calendarResult?.key !== calendarKey
  const calendarError = calendarResult?.key === calendarKey ? calendarResult.error ?? '' : ''

  useEffect(() => {
    let active = true
    api.reservations(token, {
      status,
      source,
      lodge: lodgeFilter,
      query,
      startDate,
      endDate,
      ordering,
      page,
    })
      .then((response) => {
        if (active) {
          setResult({
            key: requestKey,
            reservations: response.results,
            count: response.count,
          })
        }
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
  }, [token, requestKey, refreshKey, status, source, lodgeFilter, query, startDate, endDate, ordering, page])

  useEffect(() => {
    let active = true
    api.lodges(token)
      .then((items) => {
        if (active) {
          setLodges(items)
          setLodgeError('')
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setLodgeError(
            requestError instanceof Error ? requestError.message : 'Could not load lodges.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    let active = true
    api.dashboard(token)
      .then((data) => {
        if (active) {
          setDashboard(data)
          setDashboardError('')
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setDashboard(null)
          setDashboardError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load reservation statistics.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [token, refreshKey])

  useEffect(() => {
    let active = true
    api.calendarReservations(token, dateWindow.start, dateWindow.end)
      .then((items) => {
        if (active) setCalendarResult({ key: calendarKey, reservations: items })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setCalendarResult({
            key: calendarKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load the reservation calendar.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, calendarKey, dateWindow.start, dateWindow.end])

  const openCreate = () => {
    setEditing(null)
    setCreating(true)
    setDraft(blankReservation(lodges[0]?.id ?? 0))
    setEditError('')
  }

  const openEdit = (reservation: Reservation) => {
    setEditing(reservation)
    setCreating(false)
    setDraft({
      status: reservation.status,
      source: reservation.source,
      lodge: reservation.lodge,
      guest_name: reservation.guest_name,
      email: reservation.email,
      phone: reservation.phone,
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      adults: reservation.adults,
      children: reservation.children,
      total_due_ugx: reservation.total_due_ugx,
      note: reservation.note,
      occasion: reservation.occasion,
    })
    setEditError('')
  }

  const closeEditor = () => {
    if (saving) return
    setEditing(null)
    setCreating(false)
    setDraft(null)
    setEditError('')
  }

  const saveReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    setEditError('')
    try {
      if (editing) {
        await api.updateReservation(token, editing.id, draft)
        notify(`Reservation ${editing.reference} updated.`)
      } else {
        const created = await api.createReservation(token, draft)
        notify(`Reservation ${created.reference} created.`)
      }
      closeEditor()
      setPage(1)
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setEditError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save this reservation.',
      )
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (
    reservation: Reservation,
    next: ReservationStatus,
    cancellationReason?: string,
  ): Promise<boolean> => {
    if (
      next === 'declined' &&
      !window.confirm(`Reject reservation ${reservation.reference}?`)
    ) {
      return false
    }
    setWorkingId(reservation.id)
    setActionError('')
    try {
      await api.updateReservation(token, reservation.id, {
        status: next,
        ...(cancellationReason !== undefined && { cancellation_reason: cancellationReason }),
      })
      setRefreshKey((value) => value + 1)
      notify(
        next === 'cancelled'
          ? `Reservation ${reservation.reference} cancelled.`
          : `Reservation ${reservation.reference} marked ${reservationStatusLabels[next]}.`,
      )
      return true
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update this reservation.',
      )
      return false
    } finally {
      setWorkingId(null)
    }
  }

  const cancelReservation = async (reason: string) => {
    if (!cancellationReservation) return
    const updated = await updateStatus(cancellationReservation, 'cancelled', reason)
    if (updated) setCancellationReservation(null)
  }

  const confirmDeleteReservation = async () => {
    if (!deletingReservation) return
    const reservation = deletingReservation
    setWorkingId(reservation.id)
    setDeleteError('')
    try {
      await api.deleteReservation(token, reservation.id)
      setRefreshKey((value) => value + 1)
      notify(`Reservation ${reservation.reference} deleted.`)
      setDeletingReservation(null)
    } catch (requestError) {
      setDeleteError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not delete this reservation.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  const changeCalendar = (direction: -1 | 1) => {
    setSelectedCalendarDay(null)
    const jump = calendarMode === 'day' ? 1 : calendarMode === 'week' ? 7 : 0
    if (jump) {
      setCalendarDate(shiftDate(calendarDate, jump * direction))
      return
    }
    const date = new Date(`${calendarDate}T12:00:00`)
    date.setMonth(date.getMonth() + direction)
    setCalendarDate(localDateValue(date))
  }

  const calendarDays = useMemo(() => {
    const days: string[] = []
    for (let day = dateWindow.start; day < dateWindow.end; day = shiftDate(day, 1)) {
      days.push(day)
    }
    return days
  }, [dateWindow])
  const monthOffset =
    calendarMode === 'month'
      ? (new Date(`${dateWindow.start}T12:00:00`).getDay() + 6) % 7
      : 0
  const calendarTitle =
    calendarMode === 'month'
      ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
          new Date(`${calendarDate}T12:00:00`),
        )
      : calendarMode === 'day'
        ? formatDate(calendarDate)
        : `${formatDate(dateWindow.start)} – ${formatDate(shiftDate(dateWindow.end, -1))}`
  const compactCalendarTitle = (() => {
    const start = new Date(`${dateWindow.start}T12:00:00`)
    const end = new Date(`${shiftDate(dateWindow.end, -1)}T12:00:00`)
    if (calendarMode === 'month') {
      return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(start)
    }
    if (calendarMode === 'day') {
      return new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(start)
    }
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(start)
      return `${start.getDate()}–${end.getDate()} ${month} ${start.getFullYear()}`
    }
    const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })
    return start.getFullYear() === end.getFullYear()
      ? `${dateFormat.format(start)}–${dateFormat.format(end)} ${end.getFullYear()}`
      : `${dateFormat.format(start)} ${start.getFullYear()}–${dateFormat.format(end)} ${end.getFullYear()}`
  })()
  const selectedDayReservations = selectedCalendarDay
    ? calendarReservations.filter(
        (reservation) =>
          reservation.check_in <= selectedCalendarDay &&
          reservation.check_out > selectedCalendarDay,
      )
    : []

  const reservationCards = (items: Reservation[]) => items.map((reservation) => (
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
          <StatusPill
            status={reservation.status}
            label={reservationStatusLabels[reservation.status]}
          />
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
        <div className="reservation-payment-summary">
          <span>Total due <strong>{formatUGX(reservation.total_due_ugx)}</strong></span>
          <span>Paid <strong>{formatUGX(reservation.amount_paid_ugx)}</strong></span>
          <span>Balance <strong>{formatUGX(reservation.balance_ugx)}</strong></span>
        </div>
        {reservation.total_due_ugx === 0 &&
          !['declined', 'cancelled'].includes(reservation.status) && (
            <p className="reservation-payment-hint">
              Set the total due in Edit details before recording payment. The review invitation is emailed after check-out, regardless of payment.
            </p>
          )}
        {(reservation.occasion || reservation.note) && (
          <p className="reservation-note">
            {reservation.occasion && <strong>{reservation.occasion}: </strong>}
            {reservation.note && `“${reservation.note}”`}
          </p>
        )}
        {reservation.cancellation_reason && (
          <p className="reservation-cancellation-reason">
            <strong>Cancellation reason:</strong> {reservation.cancellation_reason}
          </p>
        )}
        <div className="reservation-meta">
          <span>Source: {sourceOptions.find((option) => option.value === reservation.source)?.label}</span>
          <span>Updated {formatDateTime(reservation.updated_at)}</span>
        </div>
        <div className="reservation-actions">
          {reservation.balance_ugx > 0 &&
            !['declined', 'cancelled'].includes(reservation.status) && (
              <button
                className="button button-outline"
                disabled={workingId === reservation.id}
                onClick={() => setPaymentReservation(reservation)}
              >
                Record payment
              </button>
            )}
          <button
            className="button button-outline"
            disabled={workingId === reservation.id}
            onClick={() => openEdit(reservation)}
          >
            <Pencil size={15} /> Edit details
          </button>
          {['pending', 'confirmed'].includes(reservation.status) && (
            <button
              className="button button-outline button-danger"
              disabled={workingId === reservation.id}
              onClick={() => {
                setActionError('')
                setCancellationReservation(reservation)
              }}
            >
              <Ban size={15} /> Cancel
            </button>
          )}
          {reservation.status === 'pending' && (
            <>
              <button
                className="button button-outline button-danger"
                disabled={workingId === reservation.id}
                onClick={() => void updateStatus(reservation, 'declined')}
              >
                <X size={15} /> Reject
              </button>
              <button
                className="button button-primary button-small"
                disabled={workingId === reservation.id}
                onClick={() => void updateStatus(reservation, 'confirmed')}
              >
                <Check size={15} /> Confirm
              </button>
            </>
          )}
          {reservation.status === 'confirmed' && (
            <>
              <button
                className="button button-primary button-small"
                disabled={workingId === reservation.id}
                onClick={() => void updateStatus(reservation, 'checked_in')}
              >
                <Check size={15} /> Check in
              </button>
            </>
          )}
          {reservation.status === 'checked_in' && (
            <button
              className="button button-primary button-small"
              disabled={workingId === reservation.id}
              onClick={() => void updateStatus(reservation, 'completed')}
            >
              <Check size={15} /> Check out
            </button>
          )}
          {['declined', 'cancelled', 'completed'].includes(reservation.status) && (
            <button
              className="button button-outline button-danger"
              disabled={workingId === reservation.id}
              onClick={() => {
                setDeleteError('')
                setDeletingReservation(reservation)
              }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>
    </article>
  ))

  const currentPageCount = Math.max(1, Math.ceil(count / 20))

  return (
    <>
      <div className="compact-action-heading">
        <PageHeading
          eyebrow="GUEST SERVICES"
          title="Reservations"
          description="Review guest stays, manage availability, and track reservations on the calendar."
          action={
            <button className="button button-primary" onClick={openCreate}>
              <Plus size={17} /> Add reservation
            </button>
          }
        />
      </div>
      {((loading && reservations.length === 0) || (calendarLoading && calendarReservations.length === 0)) && (
        <PageLoadingScreen
          label={calendarLoading ? 'Loading reservation calendar…' : 'Loading guest stays…'}
        />
      )}
      {dashboard && (
        <div className="reservation-metrics">
          {[
            ['Total', dashboard.reservations_total],
            ['Pending Review', dashboard.reservations_by_status.pending ?? 0],
            ['Confirmed', dashboard.reservations_by_status.confirmed ?? 0],
            ['Checked In', dashboard.reservations_by_status.checked_in ?? 0],
            ['Cancelled', dashboard.reservations_by_status.cancelled ?? 0],
            ['Checked Out', dashboard.reservations_by_status.completed ?? 0],
          ].map(([label, amount]) => (
            <div className="metric-card" key={label}>
              <span>{label}</span><strong>{amount}</strong>
            </div>
          ))}
        </div>
      )}
      {dashboardError && (
        <ErrorState message={dashboardError} retry={() => setRefreshKey((value) => value + 1)} />
      )}
      <section className="panel reservation-calendar">
        <div className="calendar-toolbar">
          <div className="calendar-heading">
            <span className="eyebrow"><CalendarDays size={13} /> STAY CALENDAR</span>
            <div className="calendar-title-row">
              <h2 title={calendarTitle} aria-label={calendarTitle}>
                <span className="calendar-title-full">{calendarTitle}</span>
                <span className="calendar-title-compact">{compactCalendarTitle}</span>
              </h2>
              <div className="calendar-controls">
                <div className="calendar-mode" role="group" aria-label="Calendar view">
                  {(['day', 'week', 'month'] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      className={calendarMode === mode ? 'is-selected' : ''}
                      aria-pressed={calendarMode === mode}
                      onClick={() => {
                        setSelectedCalendarDay(null)
                        setCalendarMode(mode)
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="calendar-navigation">
                  <button className="icon-button" aria-label="Previous period" onClick={() => changeCalendar(-1)}>
                    <ChevronLeft size={17} />
                  </button>
                  <button className="icon-button" aria-label="Next period" onClick={() => changeCalendar(1)}>
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="calendar-legend" aria-label="Reservation status legend">
          {[
            ['pending', reservationStatusLabels.pending],
            ['confirmed', reservationStatusLabels.confirmed],
            ['declined', reservationStatusLabels.declined],
            ['cancelled', reservationStatusLabels.cancelled],
            ['checked_in', reservationStatusLabels.checked_in],
            ['completed', reservationStatusLabels.completed],
          ].map(([status, label]) => (
            <span key={status}>
              <i className={`calendar-legend-dot is-${status}`} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
        {calendarError && <ErrorState message={calendarError} retry={() => setRefreshKey((value) => value + 1)} />}
        {calendarLoading ? (
          <LoadingState label="Loading reservation calendar…" />
        ) : (
          <div className={`calendar-grid calendar-${calendarMode}`}>
            {calendarMode === 'month' && (
              ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span className="calendar-weekday" key={day}>{day}</span>
              ))
            )}
            {Array.from({ length: monthOffset }, (_, index) => (
              <span className="calendar-empty" key={`empty-${index}`} />
            ))}
            {calendarDays.map((day) => {
              const stays = calendarReservations.filter(
                (reservation) => reservation.check_in <= day && reservation.check_out > day,
              )
              return (
                <div className="calendar-cell" key={day}>
                  <button
                    type="button"
                    className="calendar-cell-open"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => setSelectedCalendarDay(day)}
                  />
                  <button
                    type="button"
                    className="calendar-date"
                    aria-label={`Show reservations for ${formatDate(day)}`}
                    onClick={() => setSelectedCalendarDay(day)}
                  >
                    {new Date(`${day}T12:00:00`).getDate()}
                  </button>
                  {stays.map((reservation) => (
                    <button
                      type="button"
                      key={reservation.id}
                      className={`calendar-reservation is-${reservation.status}`}
                      onClick={() => setSelectedCalendarDay(day)}
                      aria-label={`${reservation.reference}, ${reservation.guest_name}, ${reservation.lodge_name}, ${reservation.status}`}
                      title={`${reservation.reference} · ${reservation.guest_name} · ${reservation.lodge_name}`}
                    >
                      <span>{reservation.guest_name}</span>
                      <small>{reservation.lodge_name}</small>
                    </button>
                  ))}
                  {!stays.length && calendarMode !== 'month' && (
                    <small className="calendar-empty-label">No stays</small>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="status-tabs" role="group" aria-label="Filter reservations by status">
        {filters.map((filter) => (
          <button
            type="button"
            className="status-tab"
            aria-pressed={status === filter.value}
            key={filter.value}
            onClick={() => {
              setPage(1)
              setStatus(filter.value)
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="reservation-filters">
        <FormField label="Search name, phone, or reference">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setPage(1)
              setQuery(event.target.value)
            }}
            placeholder="Search reservations"
          />
        </FormField>
        <FormField label="Booking source">
          <select
            value={source}
            onChange={(event) => {
              setPage(1)
              setSource(event.target.value as ReservationSource | 'all')
            }}
          >
            <option value="all">All sources</option>
            {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <FormField label="Cottage or lodge">
          <select
            value={lodgeFilter}
            onChange={(event) => {
              setPage(1)
              setLodgeFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }}
          >
            <option value="all">All stays</option>
            {lodges.map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.name}</option>)}
          </select>
        </FormField>
        <FormField label="From date">
          <input type="date" value={startDate} onChange={(event) => { setPage(1); setStartDate(event.target.value) }} />
        </FormField>
        <FormField label="To date">
          <input type="date" value={endDate} onChange={(event) => { setPage(1); setEndDate(event.target.value) }} />
        </FormField>
        <FormField label="Sort by">
          <select value={ordering} onChange={(event) => { setPage(1); setOrdering(event.target.value as '-created_at' | 'check_in') }}>
            <option value="-created_at">Newest request</option>
            <option value="check_in">Check-in date</option>
          </select>
        </FormField>
      </div>
      <div className="toolbar">
        {loading && <ResultsLoadingIndicator label="Updating reservations…" />}
        <span className="toolbar-count">{count} reservation{count === 1 ? '' : 's'}</span>
        <span className="toolbar-count">Page {page} of {currentPageCount}</span>
      </div>
      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <LoadingState label="Loading guest stays…" />
      ) : reservations.length ? (
        <>
          <div className="reservation-list">{reservationCards(reservations)}</div>
          {currentPageCount > 1 && (
            <div className="pagination-controls">
              <button className="button button-outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft size={15} /> Previous
              </button>
              <span>Page {page} of {currentPageCount}</span>
              <button className="button button-outline" disabled={page >= currentPageCount} onClick={() => setPage((value) => value + 1)}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="panel">
          <EmptyState
            title={
              status === 'all'
                ? 'No reservations yet'
                : `No ${reservationStatusLabels[status]} reservations`
            }
            description="New lodge and cottage requests will appear here."
          />
        </div>
      )}

      {(editing || creating) && draft && (
        <Modal
          title={editing ? `Edit reservation ${editing.reference}` : 'Add reservation'}
          subtitle="Enter guest, stay, booking source, and review details."
          onClose={closeEditor}
        >
          <form className="editor-form" onSubmit={(event) => void saveReservation(event)}>
            {lodgeError && <div className="form-error" role="alert">{lodgeError}</div>}
            <FormField label="Cottage or lodge">
              <select
                required
                value={draft.lodge || ''}
                onChange={(event) => setDraft({ ...draft, lodge: Number(event.target.value) })}
              >
                <option value="" disabled>Choose a stay</option>
                {lodges.map((lodge) => (
                  <option key={lodge.id} value={lodge.id}>
                    {lodge.name}{lodge.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Guest name">
              <input
                required
                maxLength={120}
                value={draft.guest_name}
                onChange={(event) => setDraft({ ...draft, guest_name: event.target.value })}
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Phone">
                <input required maxLength={40} type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
              </FormField>
              <FormField label="Email (optional)">
                <input maxLength={254} type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
              </FormField>
            </div>
            <div className="form-grid reservation-date-fields">
              <FormField label="Check-in">
                <input required type="date" value={draft.check_in} onChange={(event) => setDraft({ ...draft, check_in: event.target.value })} />
              </FormField>
              <FormField label="Check-out">
                <input required type="date" min={draft.check_in} value={draft.check_out} onChange={(event) => setDraft({ ...draft, check_out: event.target.value })} />
              </FormField>
            </div>
            <div className="form-grid">
              <FormField label="Adults">
                <input required type="number" min="1" max="50" value={draft.adults} onChange={(event) => setDraft({ ...draft, adults: Number(event.target.value) })} />
              </FormField>
              <FormField label="Children">
                <input required type="number" min="0" max="50" value={draft.children} onChange={(event) => setDraft({ ...draft, children: Number(event.target.value) })} />
              </FormField>
            </div>
            <FormField label="Total due (UGX)">
              <input
                type="number"
                min="0"
                step="1"
                value={draft.total_due_ugx}
                onChange={(event) =>
                  setDraft({ ...draft, total_due_ugx: Number(event.target.value) })
                }
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Booking source">
                <select value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value as ReservationSource })}>
                  {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>
              <FormField label="Booking status">
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReservationStatus })}>
                  {filters.filter((filter) => filter.value !== 'all' && (filter.value !== 'cancelled' || editing?.status === 'cancelled')).map((filter) => (
                    <option key={filter.value} value={filter.value}>{filter.label}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Occasion (optional)">
              <input maxLength={100} value={draft.occasion} onChange={(event) => setDraft({ ...draft, occasion: event.target.value })} placeholder="Anniversary, birthday…" />
            </FormField>
            <FormField label="Guest note / special requests">
              <textarea rows={3} maxLength={2000} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
            </FormField>
            {editError && <div className="form-error" role="alert">{editError}</div>}
            <FormActions onCancel={closeEditor} saving={saving} submitLabel={editing ? 'Save reservation' : 'Create reservation'} />
          </form>
        </Modal>
      )}
      {selectedCalendarDay && (
        <Modal
          className="calendar-day-modal"
          title={`Stays on ${formatDate(selectedCalendarDay)}`}
          subtitle={`${selectedDayReservations.length} reservation${selectedDayReservations.length === 1 ? '' : 's'} scheduled`}
          onClose={() => setSelectedCalendarDay(null)}
        >
          {selectedDayReservations.length ? (
            <div className="calendar-day-bookings">
              {selectedDayReservations.map((reservation) => (
                <article
                  className={`calendar-day-booking is-${reservation.status}`}
                  key={reservation.id}
                >
                  <div className="calendar-day-booking-heading">
                    <div>
                      <strong>{reservation.guest_name}</strong>
                      <small>{reservation.reference}</small>
                    </div>
                    <StatusPill
                      status={reservation.status}
                      label={reservationStatusLabels[reservation.status]}
                    />
                  </div>
                  <p className="calendar-day-booking-lodge">{reservation.lodge_name}</p>
                  <div className="calendar-day-booking-facts">
                    <span><strong>Check-in</strong>{formatDate(reservation.check_in)}</span>
                    <span><strong>Check-out</strong>{formatDate(reservation.check_out)}</span>
                    <span>
                      <strong>Guests</strong>
                      {reservation.adults} adult{reservation.adults === 1 ? '' : 's'}
                      {reservation.children
                        ? ` · ${reservation.children} child${reservation.children === 1 ? '' : 'ren'}`
                        : ''}
                    </span>
                    <span>
                      <strong>Source</strong>
                      {sourceOptions.find((option) => option.value === reservation.source)?.label
                        ?? reservation.source}
                    </span>
                  </div>
                  <div className="calendar-day-booking-contact">
                    <a href={`tel:${reservation.phone}`}><Phone size={13} /> {reservation.phone}</a>
                    {reservation.email && (
                      <a href={`mailto:${reservation.email}`}>
                        <Mail size={13} /> {reservation.email}
                      </a>
                    )}
                  </div>
                  {(reservation.occasion || reservation.note) && (
                    <p className="calendar-day-booking-note">
                      {reservation.occasion && <strong>{reservation.occasion}: </strong>}
                      {reservation.note}
                    </p>
                  )}
                  {reservation.cancellation_reason && (
                    <p className="reservation-cancellation-reason">
                      <strong>Cancellation reason:</strong> {reservation.cancellation_reason}
                    </p>
                  )}
                  <button
                    type="button"
                    className="button button-outline calendar-day-booking-edit"
                    onClick={() => {
                      setSelectedCalendarDay(null)
                      openEdit(reservation)
                    }}
                  >
                    <Pencil size={14} /> Edit reservation
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No stays on this day"
              description="Reservations covering this date will appear here."
            />
          )}
        </Modal>
      )}
      {cancellationReservation && (
        <CancellationModal
          itemType="reservation"
          reference={cancellationReservation.reference}
          saving={workingId === cancellationReservation.id}
          error={actionError}
          onClose={() => {
            if (workingId !== cancellationReservation.id) setCancellationReservation(null)
          }}
          onConfirm={(reason) => void cancelReservation(reason)}
        />
      )}
      {deletingReservation && (
        <Modal
          className="cancellation-modal"
          title={`Permanently delete reservation ${deletingReservation.reference}?`}
          subtitle="This action cannot be undone."
          onClose={() => {
            if (workingId !== deletingReservation.id) {
              setDeletingReservation(null)
              setDeleteError('')
            }
          }}
        >
          <div className="cancellation-form">
            {deleteError && <div className="form-error" role="alert">{deleteError}</div>}
            <div className="cancellation-actions">
              <button
                type="button"
                className="button button-outline"
                autoFocus
                disabled={workingId === deletingReservation.id}
                onClick={() => setDeletingReservation(null)}
              >
                Keep reservation
              </button>
              <button
                type="button"
                className="button button-danger button-outline"
                disabled={workingId === deletingReservation.id}
                onClick={() => void confirmDeleteReservation()}
              >
                {workingId === deletingReservation.id ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {paymentReservation && (
        <RecordPaymentModal
          token={token}
          reservationId={paymentReservation.id}
          reference={paymentReservation.reference}
          totalDue={paymentReservation.total_due_ugx}
          amountPaid={paymentReservation.amount_paid_ugx}
          balance={paymentReservation.balance_ugx}
          customerEmail={paymentReservation.email}
          notify={notify}
          onClose={() => setPaymentReservation(null)}
          onSaved={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </>
  )
}
