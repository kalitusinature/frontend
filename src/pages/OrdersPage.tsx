import { useEffect, useState, type FormEvent } from 'react'
import { Ban, Check, Search, UtensilsCrossed } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Order, OrderStatus } from '../types'
import { RecordPaymentModal } from '../components/RecordPaymentModal'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  CancellationModal,
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
  const [cancellationOrder, setCancellationOrder] = useState<Order | null>(null)
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState<{
    key: string
    orders?: Order[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${status}:${searchTerm}`
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
    updates: {
      status?: OrderStatus
      cancellation_reason?: string
    },
  ): Promise<boolean> => {
    setWorkingId(order.id)
    setActionError('')
    try {
      await api.updateOrder(token, order.id, updates)
      setRefreshKey((value) => value + 1)
      notify(
        updates.status === 'cancelled'
          ? `${order.number} cancelled.`
          : `${order.number} updated successfully.`,
      )
      return true
    } catch (requestError) {
      setActionError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update this order.',
      )
      return false
    } finally {
      setWorkingId(null)
    }
  }

  const cancelOrder = async (reason: string) => {
    if (!cancellationOrder) return
    const updated = await updateOrder(cancellationOrder, {
      status: 'cancelled',
      cancellation_reason: reason,
    })
    if (updated) {
      setCancellationOrder(null)
      setSelectedOrderId(null)
    }
  }

  return (
    <div className="orders-page">
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
        <>
          <LoadingState label="Loading guest orders…" />
        </>
      ) : orders.length ? (
        <>
          <div className="table-wrap orders-desktop-table">
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
                  <tr
                    key={order.id}
                    className="order-clickable-row"
                    tabIndex={0}
                    role="button"
                    aria-label={`View order ${order.number}`}
                    onClick={() => setSelectedOrderId(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedOrderId(order.id)
                      }
                    }}
                  >
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
                        {order.email && <a href={`mailto:${order.email}`} onClick={(event) => event.stopPropagation()}>{order.email}</a>}
                        <a href={`tel:${order.phone}`} onClick={(event) => event.stopPropagation()}>{order.phone}</a>
                      </div>
                    </td>
                    <td className="orders-items-cell">
                      <div className="order-items order-items-table">
                        {order.items.map((item) => (
                          <button
                            type="button"
                            className="order-item-chip order-item-chip-button"
                            key={item.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            aria-label={`View ${item.quantity} ${item.product_name} in ${order.number}`}
                          >
                            {item.product_image_url && (
                              <img src={item.product_image_url} alt="" />
                            )}
                            <span>{item.quantity} × {item.product_name}</span>
                          </button>
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
                        ) : order.payment_status === 'partial' ? (
                          <span className="payment-link payment-partial">
                            Partial · {formatUGX(order.balance_ugx)} due
                          </span>
                        ) : order.status === 'cancelled' ? (
                          <span className="payment-link">Unpaid</span>
                        ) : (
                          <button
                            className="payment-link"
                            type="button"
                            disabled={workingId === order.id || order.balance_ugx <= 0}
                            aria-label={`Record payment for ${order.number}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setPaymentOrder(order)
                            }}
                          >
                            Record payment
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
          <div className="orders-mobile-list">
            {orders.map((order) => (
              <article
                className="orders-mobile-card"
                key={order.id}
                tabIndex={0}
                role="button"
                aria-label={`View order ${order.number}`}
                onClick={() => setSelectedOrderId(order.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedOrderId(order.id)
                  }
                }}
              >
                <div className="orders-mobile-card-heading">
                  <div className="order-id-group">
                    <span className="order-icon"><UtensilsCrossed size={15} /></span>
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
                  <StatusPill
                    status={order.status}
                    label={orderStatusLabels[order.status]}
                  />
                </div>
                <div className="orders-mobile-summary">
                  <div className="orders-mobile-field">
                    <span>Guest</span>
                    <strong>{order.guest_name}</strong>
                    <a href={`tel:${order.phone}`}>{order.phone}</a>
                    {order.email && <a href={`mailto:${order.email}`}>{order.email}</a>}
                  </div>
                  <div className="orders-mobile-field">
                    <span>Service</span>
                    <strong>{order.order_type === 'dine_in' ? 'Dine in' : 'Lodge / cottage'}</strong>
                    <small>{order.location}</small>
                  </div>
                  <div className="orders-mobile-field">
                    <span>Payment</span>
                    <strong>{order.payment_method === 'cash' ? 'Cash at resort' : 'Card at counter'}</strong>
                    {order.payment_status === 'paid' ? (
                      <small className="payment-paid">Paid</small>
                    ) : order.payment_status === 'partial' ? (
                      <small className="payment-partial">
                        Partial · {formatUGX(order.balance_ugx)} due
                      </small>
                    ) : order.status === 'cancelled' ? (
                      <small>Unpaid</small>
                    ) : (
                      <button
                        className="payment-link"
                        type="button"
                        disabled={workingId === order.id || order.balance_ugx <= 0}
                        onClick={(event) => {
                          event.stopPropagation()
                          setPaymentOrder(order)
                        }}
                      >
                        Record payment
                      </button>
                    )}
                  </div>
                  <div className="orders-mobile-field">
                    <span>Total</span>
                    <strong className="orders-mobile-total">{formatUGX(order.total_ugx)}</strong>
                  </div>
                </div>
                <div className="orders-mobile-items">
                  <div className="orders-mobile-items-heading">
                    <strong>Items</strong>
                    <span>{order.items.length} line{order.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="order-items">
                    {order.items.map((item) => (
                      <button
                        type="button"
                        className="order-item-chip order-item-chip-button"
                        key={item.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        aria-label={`View ${item.quantity} ${item.product_name} in ${order.number}`}
                      >
                        {item.product_image_url && (
                          <img src={item.product_image_url} alt="" />
                        )}
                        <span>{item.quantity} × {item.product_name}</span>
                      </button>
                    ))}
                  </div>
                  {order.note && <p className="orders-mobile-note">Note: {order.note}</p>}
                  {order.cancellation_reason && (
                    <p className="order-cancellation-reason">
                      <strong>Cancellation reason:</strong> {order.cancellation_reason}
                    </p>
                  )}
                </div>
                <div className="orders-mobile-actions">
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={workingId === order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    View order
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="panel">
          <EmptyState
            title="No orders found"
            description={searchTerm ? 'Try another search or clear the filter.' : 'New orders will appear here as guests place them.'}
          />
        </div>
      )}
      {selectedOrder && !cancellationOrder && (
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
              <span>Email</span>
              {selectedOrder.email ? (
                <a href={`mailto:${selectedOrder.email}`}>{selectedOrder.email}</a>
              ) : (
                <strong>Not provided</strong>
              )}
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
              <strong>
                {selectedOrder.payment_status === 'paid'
                  ? 'Paid in full'
                  : selectedOrder.payment_status === 'partial'
                    ? 'Partially paid'
                    : 'Unpaid'}
              </strong>
            </div>
            <div className="order-detail-field">
              <span>Paid to date</span>
              <strong>{formatUGX(selectedOrder.amount_paid_ugx)}</strong>
            </div>
            <div className="order-detail-field">
              <span>Outstanding balance</span>
              <strong>{formatUGX(selectedOrder.balance_ugx)}</strong>
            </div>
          </div>
          <div className="order-detail-lines">
            <h3>Items</h3>
            {selectedOrder.items.map((item) => (
              <div className="order-detail-line" key={item.id}>
                <button
                  type="button"
                  className="order-detail-item"
                  onClick={() => setSelectedOrderId(selectedOrder.id)}
                >
                  {item.product_image_url ? (
                    <img
                      className="order-detail-item-image"
                      src={item.product_image_url}
                      alt={item.product_name}
                    />
                  ) : (
                    <span className="order-detail-item-image order-detail-item-placeholder" aria-hidden="true" />
                  )}
                  <span>{item.quantity} × {item.product_name}</span>
                </button>
                <strong>{formatUGX(item.line_total_ugx)}</strong>
              </div>
            ))}
          </div>
          {selectedOrder.note && (
            <p className="order-detail-note"><strong>Guest note:</strong> {selectedOrder.note}</p>
          )}
          {selectedOrder.cancellation_reason && (
            <p className="order-cancellation-reason">
              <strong>Cancellation reason:</strong> {selectedOrder.cancellation_reason}
            </p>
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
            {selectedOrder.balance_ugx > 0 &&
              selectedOrder.status !== 'cancelled' && (
              <button
                type="button"
                className="button button-outline"
                disabled={workingId === selectedOrder.id}
                onClick={() => setPaymentOrder(selectedOrder)}
              >
                Record payment
              </button>
            )}
            {!['completed', 'cancelled'].includes(selectedOrder.status) && (
              <button
                type="button"
                className="button button-outline order-cancel-button"
                disabled={workingId === selectedOrder.id}
                onClick={() => {
                  setActionError('')
                  setCancellationOrder(selectedOrder)
                }}
              >
                <Ban size={15} />
                Cancel order
              </button>
            )}
          </div>
        </Modal>
      )}
      {cancellationOrder && (
        <CancellationModal
          itemType="order"
          reference={cancellationOrder.number}
          saving={workingId === cancellationOrder.id}
          error={actionError}
          onClose={() => {
            if (workingId !== cancellationOrder.id) setCancellationOrder(null)
          }}
          onConfirm={(reason) => void cancelOrder(reason)}
        />
      )}
      {paymentOrder && (
        <RecordPaymentModal
          token={token}
          orderId={paymentOrder.id}
          reference={paymentOrder.number}
          totalDue={paymentOrder.total_ugx}
          amountPaid={paymentOrder.amount_paid_ugx}
          balance={paymentOrder.balance_ugx}
          customerEmail={paymentOrder.email}
          notify={notify}
          onClose={() => setPaymentOrder(null)}
          onSaved={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  )
}
