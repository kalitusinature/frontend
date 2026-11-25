import { useEffect, useState } from 'react'
import { ApiError, api } from '../api'
import type { Paginated, SupportTicket } from '../types'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from '../components/ui'
import { formatDateTime } from '../utils'

export function SupportTicketsPage({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: Paginated<SupportTicket>
    error?: string
  } | null>(null)
  const requestKey = `${token}:${page}`
  const data = result?.key === requestKey ? result.data : undefined
  const error = result?.key === requestKey ? result.error ?? '' : ''
  const loading = result?.key !== requestKey

  useEffect(() => {
    let active = true
    api.supportTickets(token, page)
      .then((response) => {
        if (active) setResult({ key: requestKey, data: response })
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setResult({
          key: requestKey,
          error:
            requestError instanceof ApiError
              ? requestError.message
              : requestError instanceof Error
                ? requestError.message
                : 'Could not load support tickets.',
        })
      })
    return () => {
      active = false
    }
  }, [page, refreshKey, requestKey, token])

  const tickets = data?.results ?? []
  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / 20))

  return (
    <div className="support-tickets-page">
      <PageHeading
        eyebrow="CUSTOMER SUPPORT"
        title="Support Tickets"
        description="Review requests submitted through the Contact Us form."
        action={
          <button
            type="button"
            className="button button-outline"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Refresh
          </button>
        }
      />
      {error && (
        <ErrorState
          message={error}
          retry={() => setRefreshKey((value) => value + 1)}
        />
      )}
      {loading ? (
        <LoadingState label="Loading support tickets…" />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No support tickets yet"
          description="Requests from the Contact Us form will appear here."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table support-tickets-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Customer</th>
                  <th>Subject and message</th>
                  <th>Email copy</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{formatDateTime(ticket.created_at)}</td>
                    <td>
                      <div className="support-ticket-customer">
                        <strong>{ticket.name}</strong>
                        <a href={`mailto:${ticket.email}`}>{ticket.email}</a>
                        {ticket.phone && <small>{ticket.phone}</small>}
                      </div>
                    </td>
                    <td className="support-ticket-message-cell">
                      <strong>{ticket.subject}</strong>
                      <p>{ticket.message}</p>
                    </td>
                    <td>
                      <span
                        className={`support-ticket-email-status ${ticket.email_sent ? 'support-ticket-email-sent' : 'support-ticket-email-failed'}`}
                      >
                        {ticket.email_sent ? 'Sent' : 'Not sent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-controls support-ticket-pagination">
            <span>
              {data?.count ?? 0} ticket{data?.count === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="button button-outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <span>Page {page} of {pageCount}</span>
            <button
              type="button"
              className="button button-outline"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
