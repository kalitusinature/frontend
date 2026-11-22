import { useEffect, useState, type FormEvent } from 'react'
import { Download, ExternalLink, Mail, Search } from 'lucide-react'
import { ApiError, api } from '../api'
import type { PaymentReceipt } from '../types'
import {
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeading,
  StatusPill,
} from '../components/ui'
import { formatDateTime, formatUGX } from '../utils'

export function PaymentReceiptsPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<PaymentReceipt['payment_status'] | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState<{
    key: string
    receipts?: PaymentReceipt[]
    count?: number
    error?: string
  } | null>(null)

  const requestKey = `${token}:${query}:${status}:${startDate}:${endDate}:${page}`
  const receipts = result?.key === requestKey ? result.receipts ?? [] : []
  const count = result?.key === requestKey ? result.count ?? 0 : 0
  const loading = result?.key !== requestKey

  useEffect(() => {
    let active = true
    api.paymentReceipts(token, {
      query,
      status,
      startDate,
      endDate,
      page,
    })
      .then((response) => {
        if (active) {
          setResult({
            key: requestKey,
            receipts: response.results,
            count: response.count,
          })
          setActionError('')
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error:
              requestError instanceof Error
                ? requestError.message
                : 'Could not load payment receipts.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, requestKey, refreshKey, query, status, startDate, endDate, page])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setQuery(queryInput.trim())
  }

  const downloadReceipt = async (receipt: PaymentReceipt) => {
    setWorkingId(receipt.id)
    setActionError('')
    try {
      const file = await api.downloadPaymentReceipt(token, receipt.id)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `${receipt.receipt_number}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : requestError instanceof Error
            ? requestError.message
            : 'Could not download this receipt.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  const viewReceipt = async (receipt: PaymentReceipt) => {
    const preview = window.open('about:blank', '_blank')
    if (!preview) {
      setActionError('Allow pop-ups to open and print the receipt.')
      return
    }
    preview.opener = null
    setWorkingId(receipt.id)
    setActionError('')
    try {
      const file = await api.downloadPaymentReceipt(token, receipt.id)
      const url = URL.createObjectURL(file)
      preview.location.href = url
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (requestError) {
      preview.close()
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : requestError instanceof Error
            ? requestError.message
            : 'Could not open this receipt.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  const resendReceipt = async (receipt: PaymentReceipt) => {
    if (!receipt.customer_email) {
      setActionError('The customer has no email address on file.')
      return
    }
    setWorkingId(receipt.id)
    setActionError('')
    try {
      await api.resendPaymentReceipt(token, receipt.id)
      notify(`Receipt ${receipt.receipt_number} was emailed to the customer.`)
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : requestError instanceof Error
            ? requestError.message
            : 'Could not resend this receipt.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  const pageCount = Math.max(1, Math.ceil(count / 20))
  const error = actionError || (result?.key === requestKey ? result.error ?? '' : '')

  return (
    <div className="payment-receipts-page">
      <PageHeading
        eyebrow="PAYMENTS"
        title="Payment Receipts"
        description="Search verified order and reservation payments, download receipts, and resend customer copies."
      />
      <section className="panel payment-receipts-filters">
        <form className="search-form" onSubmit={submitSearch}>
          <Search size={16} />
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Receipt, customer, order, reservation, or transaction reference"
            aria-label="Search payment receipts"
          />
          <button type="submit" className="button button-outline button-small">Search</button>
        </form>
        <FormField label="Payment status">
          <select
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as PaymentReceipt['payment_status'] | 'all')
            }}
          >
            <option value="all">All receipts</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Paid in full</option>
          </select>
        </FormField>
        <FormField label="From">
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setPage(1)
              setStartDate(event.target.value)
            }}
          />
        </FormField>
        <FormField label="To">
          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setPage(1)
              setEndDate(event.target.value)
            }}
          />
        </FormField>
      </section>
      {error && (
        <ErrorState
          message={error}
          retry={() => {
            setActionError('')
            setRefreshKey((value) => value + 1)
          }}
        />
      )}
      {loading ? (
        <LoadingState label="Loading verified payment receipts…" />
      ) : receipts.length === 0 ? (
        <EmptyState
          title="No payment receipts found"
          description="Verified payments will appear here after staff records them."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table payment-receipts-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer / booking</th>
                  <th>Payment</th>
                  <th>Balance</th>
                  <th>Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <strong>{receipt.receipt_number}</strong>
                      <small>{receipt.transaction_reference}</small>
                    </td>
                    <td>
                      <strong>{receipt.customer_name}</strong>
                      <small>{receipt.customer_email || 'No email on file'}</small>
                      <small>
                        {receipt.order_number
                          ? `Order ${receipt.order_number}`
                          : `Reservation ${receipt.reservation_reference ?? ''}`}
                      </small>
                    </td>
                    <td>
                      <strong>{formatUGX(receipt.amount_ugx)}</strong>
                      <small>{receipt.method_label}</small>
                    </td>
                    <td>
                      <StatusPill
                        status={receipt.payment_status}
                        label={receipt.payment_status === 'paid' ? 'Paid in full' : 'Partial'}
                      />
                      <small>{formatUGX(receipt.balance_ugx)} due</small>
                    </td>
                    <td>{formatDateTime(receipt.verified_at)}</td>
                    <td>
                      <div className="payment-receipt-actions">
                        <button
                          className="button button-outline button-small"
                          type="button"
                          disabled={workingId === receipt.id}
                          onClick={() => void viewReceipt(receipt)}
                          title="Open and print receipt"
                        >
                          <ExternalLink size={14} /> View / print
                        </button>
                        <button
                          className="button button-outline button-small"
                          type="button"
                          disabled={workingId === receipt.id}
                          onClick={() => void downloadReceipt(receipt)}
                        >
                          <Download size={14} /> Download
                        </button>
                        <button
                          className="button button-outline button-small"
                          type="button"
                          disabled={workingId === receipt.id || !receipt.customer_email}
                          onClick={() => void resendReceipt(receipt)}
                        >
                          <Mail size={14} /> Resend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="button button-outline button-small"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <span>Page {page} of {pageCount} · {count} receipts</span>
            <button
              type="button"
              className="button button-outline button-small"
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
