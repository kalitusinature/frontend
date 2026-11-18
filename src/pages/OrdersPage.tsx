import { useEffect, useState, type FormEvent } from 'react'
import { Check, Search, UtensilsCrossed } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Order, OrderStatus } from '../types'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeading,
  StatusPill,
} from '../components/ui'
import { formatDateTime, formatUGX } from '../utils'

const orderStatuses: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'new', label: 'New' },
  { value: 'accepted', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const nextOrderStatus: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'accepted', label: 'Confirm order' },
  accepted: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'completed', label: 'Mark delivered' },
}

const orderStatusLabels: Record<OrderStatus, string> = {
  new: 'New',
  accepted: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Delivered',
  cancelled: 'Cancelled',
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
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState<{
    key: string
    orders?: Order[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${status}:${searchTerm}:${refreshKey}`
  const orders = result?.key === requestKey ? result.orders ?? [] : []
  const selectedOrder = result?.orders?.find((order) => order.id === selectedOrderId)
  const loading = result?.key !== requestKey
  const error = actionError || (result?.key === requestKey ? result.error ?? '' : '')

  useEffect(() => {
    let active = true
    const refreshTimer = window.setInterval(() => {
      setRefreshKey((value) => value + 1)
    }, 30_000)

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
      window.clearInterval(refreshTimer)
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

  const cancelOrder = (order: Order) => {
    if (window.confirm(`Cancel order ${order.number}?`)) {
      void updateOrder(order, { status: 'cancelled' })
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
                return (
                  <tr key={order.id}>
                    <td>
                      <div className="order-id-group">
                        <span className="order-icon"><UtensilsCrossed size={17} /></span>
                        <div>
                          <button
                            type="button"
                            className="order-number-link"
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            {order.number}
                          </button>
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
                        {order.payment_status === 'paid' ? (
                          <span className="payment-link payment-paid">Paid</span>
                        ) : order.status === 'cancelled' ? (
                          <span className="payment-link">Unpaid</span>
                        ) : (
                          <button
                            className="payment-link"
                            type="button"
                            disabled={workingId === order.id}
                            aria-label={`Mark ${order.number} paid`}
                            onClick={() =>
                              void updateOrder(order, { payment_status: 'paid' })
                            }
                          >
                            Unpaid · mark paid
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="table-price">{formatUGX(order.total_ugx)}</td>
                    <td>
                      <StatusPill
                        status={order.status}
                        label={orderStatusLabels[order.status]}
                      />
                    </td>
                    <td className="order-table-actions">
                      <div className="order-actions">
                        <button
                          type="button"
                          className="button button-outline button-small"
                          disabled={workingId === order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          View order
                        </button>
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
      {selectedOrder && (
        <Modal
          title={selectedOrder.number}
          subtitle={`Placed ${formatDateTime(selectedOrder.created_at)}`}
          onClose={() => setSelectedOrderId(null)}
        >
          <div className="order-detail-summary">
            <StatusPill
              status={selectedOrder.status}
              label={orderStatusLabels[selectedOrder.status]}
            />
            <strong>{formatUGX(selectedOrder.total_ugx)}</strong>
          </div>
          <div className="order-detail-grid">
            <div className="order-detail-field">
              <span>Guest</span>
              <strong>{selectedOrder.guest_name}</strong>
            </div>
            <div className="order-detail-field">
              <span>Phone</span>
              <a href={`tel:${selectedOrder.phone}`}>{selectedOrder.phone}</a>
            </div>
            <div className="order-detail-field">
              <span>Service</span>
              <strong>
                {selectedOrder.order_type === 'dine_in' ? 'Dine in' : 'Lodge / cottage'}
              </strong>
            </div>
            <div className="order-detail-field">
              <span>Location</span>
              <strong>{selectedOrder.location}</strong>
            </div>
            <div className="order-detail-field">
              <span>Payment method</span>
              <strong>
                {selectedOrder.payment_method === 'cash' ? 'Cash at resort' : 'Card at counter'}
              </strong>
            </div>
            <div className="order-detail-field">
              <span>Payment status</span>
              <strong>{selectedOrder.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</strong>
            </div>
          </div>
          <div className="order-detail-lines">
            <h3>Items</h3>
            {selectedOrder.items.map((item) => (
              <div className="order-detail-line" key={item.id}>
                <span>{item.quantity} × {item.product_name}</span>
                <strong>{formatUGX(item.line_total_ugx)}</strong>
              </div>
            ))}
          </div>
          {selectedOrder.note && (
            <p className="order-detail-note"><strong>Guest note:</strong> {selectedOrder.note}</p>
          )}
          <div className="order-detail-actions">
            {nextOrderStatus[selectedOrder.status] && (
              <button
                type="button"
                className="button button-primary"
                disabled={workingId === selectedOrder.id}
                onClick={() =>
                  void updateOrder(selectedOrder, {
                    status: nextOrderStatus[selectedOrder.status]!.status,
                  })
                }
              >
                <Check size={16} />
                {workingId === selectedOrder.id
                  ? 'Saving…'
                  : nextOrderStatus[selectedOrder.status]!.label}
              </button>
            )}
            {selectedOrder.payment_status === 'unpaid' &&
              selectedOrder.status !== 'cancelled' && (
              <button
                type="button"
                className="button button-outline"
                disabled={workingId === selectedOrder.id}
                onClick={() =>
                  void updateOrder(selectedOrder, { payment_status: 'paid' })
                }
              >
                Mark paid
              </button>
            )}
            {!['completed', 'cancelled'].includes(selectedOrder.status) && (
              <button
                type="button"
                className="button button-outline order-cancel-button"
                disabled={workingId === selectedOrder.id}
                onClick={() => cancelOrder(selectedOrder)}
              >
                Cancel order
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
