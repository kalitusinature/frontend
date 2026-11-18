import { useEffect, useState, type FormEvent } from 'react'
import { Check, Search, UtensilsCrossed } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Order, OrderStatus } from '../types'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  StatusPill,
} from '../components/ui'
import { formatDateTime, formatUGX } from '../utils'

const orderStatuses: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'new', label: 'New' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const nextOrderStatus: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'accepted', label: 'Confirm order' },
  accepted: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'completed', label: 'Complete order' },
}

export function OrdersPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState<{
    key: string
    orders?: Order[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${status}:${searchTerm}:${refreshKey}`
  const orders = result?.key === requestKey ? result.orders ?? [] : []
  const loading = result?.key !== requestKey
  const error = actionError || (result?.key === requestKey ? result.error ?? '' : '')

  useEffect(() => {
    let active = true
    api.orders(token, status, searchTerm)
      .then((result) => {
        if (active) setResult({ key: requestKey, orders: result })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load orders.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, status, searchTerm, refreshKey, requestKey])

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm(searchInput.trim())
  }

  const updateOrder = async (
    order: Order,
    updates: { status?: OrderStatus; payment_status?: 'unpaid' | 'paid' },
  ) => {
    setWorkingId(order.id)
    setActionError('')
    try {
      await api.updateOrder(token, order.id, updates)
      setRefreshKey((value) => value + 1)
      notify(
        updates.payment_status
          ? 'Payment status updated.'
          : `${order.number} updated successfully.`,
      )
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update this order.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="FOOD SERVICE"
        title="Orders"
        description="Review guest orders and move each one through service."
      />
      <div className="status-tabs" role="group" aria-label="Filter orders by status">
        {orderStatuses.map((item) => (
          <button
            type="button"
            className="status-tab"
            aria-pressed={status === item.value}
            key={item.value}
            onClick={() => setStatus(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <form className="search-form" onSubmit={search}>
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search order or guest"
            aria-label="Search order or guest"
          />
          <button type="submit">Search</button>
        </form>
        <span className="toolbar-count">{orders.length} orders</span>
      </div>

      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <LoadingState label="Loading guest orders…" />
      ) : orders.length ? (
        <div className="table-wrap">
          <table className="data-table orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Guest</th>
                <th>Items</th>
                <th>Service location</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const next = nextOrderStatus[order.status]
                return (
                  <tr key={order.id}>
                    <td>
                      <div className="order-id-group">
                        <span className="order-icon"><UtensilsCrossed size={17} /></span>
                        <div>
                          <strong>{order.number}</strong>
                          <small>{formatDateTime(order.created_at)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="order-table-cell">
                        <strong>{order.guest_name}</strong>
                        <a href={`tel:${order.phone}`}>{order.phone}</a>
                      </div>
                    </td>
                    <td className="orders-items-cell">
                      <div className="order-items order-items-table">
                        {order.items.map((item) => (
                          <span className="order-item-chip" key={item.id}>
                            {item.quantity} × {item.product_name}
                          </span>
                        ))}
                      </div>
                      {order.note && (
                        <small className="order-note order-note-table">
                          Note: {order.note}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="order-table-cell">
                        <strong>
                          {order.order_type === 'dine_in' ? 'Dine in' : 'Lodge / cottage'}
                        </strong>
                        <small>{order.location}</small>
                      </div>
                    </td>
                    <td>
                      <div className="order-payment-cell">
                        <span>
                          {order.payment_method === 'cash' ? 'Cash at resort' : 'Card at counter'}
                        </span>
                        <button
                          className={`payment-link ${order.payment_status === 'paid' ? 'payment-paid' : ''}`}
                          disabled={workingId === order.id}
                          onClick={() =>
                            void updateOrder(order, {
                              payment_status: order.payment_status === 'paid' ? 'unpaid' : 'paid',
                            })
                          }
                        >
                          {order.payment_status === 'paid' ? 'Paid · mark unpaid' : 'Unpaid · mark paid'}
                        </button>
                      </div>
                    </td>
                    <td className="table-price">{formatUGX(order.total_ugx)}</td>
                    <td><StatusPill status={order.status} /></td>
                    <td className="order-table-actions">
                      <div className="order-actions">
                        <label className="sr-only" htmlFor={`order-status-${order.id}`}>
                          Update {order.number} status
                        </label>
                        <select
                          id={`order-status-${order.id}`}
                          className="status-select"
                          value={order.status}
                          disabled={workingId === order.id}
                          onChange={(event) =>
                            void updateOrder(order, { status: event.target.value as OrderStatus })
                          }
                        >
                          {orderStatuses.slice(1).map((item) => (
                            <option value={item.value} key={item.value}>{item.label}</option>
                          ))}
                        </select>
                        {next && (
                          <button
                            className="button button-primary button-small"
                            disabled={workingId === order.id}
                            onClick={() => void updateOrder(order, { status: next.status })}
                          >
                            <Check size={15} />
                            {workingId === order.id ? 'Saving…' : next.label}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="No orders found"
            description={searchTerm ? 'Try another search or clear the filter.' : 'New orders will appear here as guests place them.'}
          />
        </div>
      )}
    </>
  )
}
