import type { ReservationStatus } from './types'

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending: 'Pending Review',
  confirmed: 'Confirmed',
  declined: 'Rejected',
  cancelled: 'Cancelled',
  checked_in: 'Checked In',
  completed: 'Checked Out',
}

export function formatUGX(value: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-UG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
