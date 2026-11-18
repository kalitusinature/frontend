import { useEffect, useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  BedDouble,
  CircleCheck,
  Clock3,
  Package,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react'
import { api } from '../api'
import type { DashboardData, OrderStatus } from '../types'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  StatusPill,
} from '../components/ui'
import type { PageId } from '../App'
import { formatDateTime, formatUGX } from '../utils'

const orderFlowStatuses: { status: OrderStatus; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'accepted', label: 'Confirmed' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'completed', label: 'Delivered' },
  { status: 'cancelled', label: 'Cancelled' },
]

export function DashboardPage({
  token,
  onNavigate,
}: {
  token: string
  onNavigate: (page: PageId) => void
}) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: DashboardData
    error?: string
  } | null>(null)
  const requestKey = `${token}:${refreshKey}`
  const data = result?.key === requestKey ? result.data ?? null : null
  const error = result?.key === requestKey ? result.error ?? '' : ''
  const loading = result?.key !== requestKey
  const orderFlow = data
    ? orderFlowStatuses.flatMap(({ status, label }) => {
        const count = data.orders_by_status[status] ?? 0
        if (!count) return []
        const width = data.orders_total
          ? Math.max((count / data.orders_total) * 100, 5)
          : 0
        return [{ status, label, count, width }]
      })
    : []

  useEffect(() => {
    let active = true
    api.dashboard(token)
      .then((response) => {
        if (active) setResult({ key: requestKey, data: response })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load dashboard.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, requestKey])

  const load = () => setRefreshKey((value) => value + 1)

  return (
    <>
      <div className="dashboard-heading-wrap">
        <PageHeading
          eyebrow="OVERVIEW"
          title="A good day starts here."
          description="A live snapshot of food orders, menu items, and guest stays."
          action={
            <button className="button button-outline" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          }
        />
      </div>
      {error && <ErrorState message={error} retry={load} />}
      {loading && !data ? (
        <LoadingState label="Gathering your resort overview…" />
      ) : data ? (
        <>
          <div className="metric-grid">
            <MetricCard
              label="New orders"
              value={data.new_orders}
              note="Need your attention"
              icon={<Clock3 size={19} />}
              tone="amber"
              onClick={() => onNavigate('orders')}
            />
            <MetricCard
              label="Pending stays"
              value={data.pending_reservations}
              note="Reservation requests"
              icon={<BedDouble size={19} />}
              tone="blue"
              onClick={() => onNavigate('reservations')}
            />
            <MetricCard
              label="Menu products"
              value={data.products_total}
              note="Across all categories"
              icon={<UtensilsCrossed size={19} />}
              tone="green"
              onClick={() => onNavigate('products')}
            />
            <MetricCard
              label="Orders received"
              value={data.orders_total}
              note="All-time"
              icon={<Package size={19} />}
              tone="violet"
              onClick={() => onNavigate('orders')}
            />
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">ORDER FLOW</span>
                  <h2>Orders by status</h2>
                </div>
                <button className="text-button" onClick={() => onNavigate('orders')}>
                  View orders <ArrowRight size={15} />
                </button>
              </div>
              {orderFlow.length ? (
                <div className="order-flow-list">
                  {orderFlow.map(({ status, label, count, width }) => (
                    <div className="flow-row" key={status}>
                      <span>{label}</span>
                      <div className="flow-track">
                        <div
                          className={`flow-fill flow-${status}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No orders yet"
                  description="Order activity will appear here when guests place an order."
                />
              )}
              <div className="flow-footnote">
                <ArrowDownRight size={15} />
                <span>Keep new orders moving so guests aren’t waiting.</span>
              </div>
            </section>

            <section className="panel quick-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">QUICK ACCESS</span>
                  <h2>Manage your resort</h2>
                </div>
              </div>
              <QuickLink
                icon={<UtensilsCrossed size={18} />}
                title="Add a menu item"
                detail="Create or update food and drinks"
                onClick={() => onNavigate('products')}
              />
              <QuickLink
                icon={<CircleCheck size={18} />}
                title="Review incoming orders"
                detail={
                  data.new_orders
                    ? `${data.new_orders} waiting for confirmation`
                    : 'No orders awaiting confirmation'
                }
                onClick={() => onNavigate('orders')}
              />
              <QuickLink
                icon={<BedDouble size={18} />}
                title="Review reservations"
                detail={
                  data.pending_reservations
                    ? `${data.pending_reservations} awaiting approval`
                    : 'No stays awaiting approval'
                }
                onClick={() => onNavigate('reservations')}
              />
            </section>
          </div>

          <div className="dashboard-grid dashboard-grid-bottom">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">LATEST ACTIVITY</span>
                  <h2>Recent orders</h2>
                </div>
                <button className="text-button" onClick={() => onNavigate('orders')}>
                  All orders <ArrowRight size={15} />
                </button>
              </div>
              {data.recent_orders.length ? (
                <div className="compact-list">
                  {data.recent_orders.map((order) => (
                    <button
                      className="compact-row"
                      key={order.id}
                      onClick={() => onNavigate('orders')}
                    >
                      <span className="compact-icon"><UtensilsCrossed size={16} /></span>
                      <span className="compact-main">
                        <strong>{order.number}</strong>
                        <small>{order.guest_name} · {formatDateTime(order.created_at)}</small>
                      </span>
                      <span className="compact-total">{formatUGX(order.total_ugx)}</span>
                      <StatusPill
                        status={order.status}
                        label={
                          order.status === 'completed'
                            ? 'Delivered'
                            : order.status === 'accepted'
                              ? 'Confirmed'
                              : undefined
                        }
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title="No orders yet" description="New food orders will show here." />
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">GUEST STAYS</span>
                  <h2>Recent reservations</h2>
                </div>
                <button className="text-button" onClick={() => onNavigate('reservations')}>
                  All stays <ArrowRight size={15} />
                </button>
              </div>
              {data.recent_reservations.length ? (
                <div className="compact-list">
                  {data.recent_reservations.map((reservation) => (
                    <button
                      className="compact-row"
                      key={reservation.id}
                      onClick={() => onNavigate('reservations')}
                    >
                      <span className="compact-icon compact-icon-blue"><BedDouble size={16} /></span>
                      <span className="compact-main">
                        <strong>{reservation.guest_name}</strong>
                        <small>{reservation.lodge_name} · {reservation.check_in}</small>
                      </span>
                      <StatusPill status={reservation.status} />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title="No reservations yet" description="Guest stay requests will show here." />
              )}
            </section>
          </div>
          <div className="dashboard-footnote">
            <span className="online-dot" />
            Menu and reservation totals: {data.categories_total} categories · {data.lodges_total} lodges
          </div>
        </>
      ) : null}
    </>
  )
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: number
  note: string
  icon: React.ReactNode
  tone: string
  onClick: () => void
}) {
  return (
    <button className="metric-card" onClick={onClick}>
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon metric-${tone}`}>{icon}</span>
      </div>
      <strong className="metric-value">{value.toLocaleString('en-UG')}</strong>
      <span className="metric-note">{note}</span>
    </button>
  )
}

function QuickLink({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button className="quick-link" onClick={onClick}>
      <span className="quick-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRight size={16} />
    </button>
  )
}
