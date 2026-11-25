import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  CreditCard,
  Gauge,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  ReceiptText,
  Salad,
  Shapes,
  TreePalm,
  UserRound,
  X,
} from 'lucide-react'
import { ApiError, api } from './api'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { LodgesPage } from './pages/LodgesPage'
import { OrdersPage } from './pages/OrdersPage'
import { ChatPage } from './pages/ChatPage'
import { SupportTicketsPage } from './pages/SupportTicketsPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReservationsPage } from './pages/ReservationsPage'
import { PaymentReceiptsPage } from './pages/PaymentReceiptsPage'
import { MyAccountPage } from './pages/MyAccountPage'
import { LoginPage } from './pages/LoginPage'
import type { LoginResponse } from './types'
import { InstallAppButton } from './components/InstallAppButton'
import { BrowserNotificationsButton } from './components/BrowserNotificationsButton'
import { PageLoadingScreen } from './components/ui'
import './App.css'

export type PageId =
  | 'dashboard'
  | 'orders'
  | 'chats'
  | 'support-tickets'
  | 'products'
  | 'reservations'
  | 'payment-receipts'
  | 'categories'
  | 'lodges'
  | 'account'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'orders', label: 'Orders', icon: ReceiptText },
  { id: 'chats', label: 'Customer chat', icon: MessageCircle },
  { id: 'support-tickets', label: 'Support tickets', icon: Mail },
  { id: 'products', label: 'Menu products', icon: Salad },
  { id: 'reservations', label: 'Reservations', icon: CalendarDays },
  { id: 'payment-receipts', label: 'Payment receipts', icon: CreditCard },
  { id: 'categories', label: 'Categories', icon: Shapes },
  { id: 'lodges', label: 'Lodges & cottages', icon: TreePalm },
] as const

function titleForPage(page: PageId): string {
  if (page === 'account') return 'My account'
  return navigation.find((item) => item.id === page)?.label ?? 'Dashboard'
}

type IncomingCounts = {
  orders: number
  reservations: number
  chats: number
}

function App() {
  const passwordResetRequested =
    new URLSearchParams(window.location.search).get('reset') === '1'
  const [token, setToken] = useState(
    () =>
      passwordResetRequested
        ? ''
        : window.sessionStorage.getItem('kalitusi-admin-token') ?? '',
  )
  const [username, setUsername] = useState(
    () => window.sessionStorage.getItem('kalitusi-admin-user') ?? '',
  )
  const [activePage, setActivePage] = useState<PageId>(() => {
    const savedPage = window.sessionStorage.getItem('kalitusi-admin-page')
    if (savedPage === 'account') return 'account'
    return navigation.find(({ id }) => id === savedPage)?.id ?? 'dashboard'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [checkingToken, setCheckingToken] = useState(Boolean(token))
  const [authError, setAuthError] = useState('')
  const [unreadOrders, setUnreadOrders] = useState(0)
  const [unreadReservations, setUnreadReservations] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const previousIncomingCounts = useRef<IncomingCounts | null>(null)
  const activePageRef = useRef<PageId>(activePage)
  const [todayLabel] = useState(() =>
    new Intl.DateTimeFormat('en-UG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date()),
  )

  useEffect(() => {
    if (!passwordResetRequested) return
    window.sessionStorage.removeItem('kalitusi-admin-token')
    window.sessionStorage.removeItem('kalitusi-admin-user')
  }, [passwordResetRequested])

  const navigateToPage = (page: PageId) => {
    activePageRef.current = page
    if (page === 'orders') setUnreadOrders(0)
    if (page === 'reservations') setUnreadReservations(0)
    if (page === 'chats') setUnreadChats(0)
    setActivePage(page)
  }

  useEffect(() => {
    window.sessionStorage.setItem('kalitusi-admin-page', activePage)
  }, [activePage])

  useEffect(() => {
    if (!token || !('serviceWorker' in navigator)) return

    const handleNotificationClick = (event: MessageEvent<unknown>) => {
      const message = event.data as { type?: string; page?: string } | null
      if (message?.type !== 'push-notification-click') return
      if (
        message.page !== 'orders' &&
        message.page !== 'reservations' &&
        message.page !== 'chats'
      ) return
      activePageRef.current = message.page
      setActivePage(message.page)
      if (message.page === 'orders') setUnreadOrders(0)
      if (message.page === 'reservations') setUnreadReservations(0)
      if (message.page === 'chats') setUnreadChats(0)
    }

    navigator.serviceWorker.addEventListener('message', handleNotificationClick)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleNotificationClick)
    }
  }, [token])

  useEffect(() => {
    previousIncomingCounts.current = null
    if (!token) return

    let active = true
    let refreshing = false
    let accountChecked = false
    let passwordChangeRequired = false
    const refreshIncomingCounts = async () => {
      if (refreshing || passwordChangeRequired) return
      refreshing = true
      try {
        if (!accountChecked) {
          const account = await api.staffAccount(token)
          if (!active) return
          accountChecked = true
          if (account.must_change_password) {
            passwordChangeRequired = true
            activePageRef.current = 'account'
            setActivePage('account')
            setUnreadOrders(0)
            setUnreadReservations(0)
            setUnreadChats(0)
            return
          }
        }
        const [data, chats] = await Promise.all([
          api.dashboard(token),
          api.unreadChats(token),
        ])
        if (!active) return
        const counts = {
          orders: data.new_orders,
          reservations: data.pending_reservations,
          chats: chats.count,
        }
        const previous = previousIncomingCounts.current
        if (previous === null) {
          setUnreadOrders(activePageRef.current === 'orders' ? 0 : counts.orders)
          setUnreadReservations(
            activePageRef.current === 'reservations' ? 0 : counts.reservations,
          )
          setUnreadChats(activePageRef.current === 'chats' ? 0 : counts.chats)
        } else {
          const newOrders = Math.max(0, counts.orders - previous.orders)
          const newReservations = Math.max(
            0,
            counts.reservations - previous.reservations,
          )
          const newChats = Math.max(0, counts.chats - previous.chats)
          setUnreadOrders((unread) => Math.min(unread, counts.orders) + newOrders)
          setUnreadReservations(
            (unread) => Math.min(unread, counts.reservations) + newReservations,
          )
          setUnreadChats((unread) => Math.min(unread, counts.chats) + newChats)
          if (newChats > 0 && activePageRef.current !== 'chats') {
            setNotice(
              newChats === 1
                ? 'New customer chat message.'
                : `${newChats} new customer chat messages.`,
            )
          }
        }
        previousIncomingCounts.current = counts
        setAuthError('')
      } catch (error: unknown) {
        if (!active) return
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          window.sessionStorage.removeItem('kalitusi-admin-token')
          window.sessionStorage.removeItem('kalitusi-admin-user')
          setToken('')
          setUsername('')
          setUnreadOrders(0)
          setUnreadReservations(0)
          setUnreadChats(0)
          activePageRef.current = 'dashboard'
          setActivePage('dashboard')
        } else {
          setAuthError(
            error instanceof Error ? error.message : 'Could not connect to the server.',
          )
        }
      } finally {
        refreshing = false
        if (active) setCheckingToken(false)
      }
    }

    void refreshIncomingCounts()
    const refreshTimer = window.setInterval(() => {
      void refreshIncomingCounts()
    }, 30_000)

    return () => {
      active = false
      window.clearInterval(refreshTimer)
    }
  }, [token])

  const handleLogin = (result: LoginResponse) => {
    window.sessionStorage.setItem('kalitusi-admin-token', result.token)
    window.sessionStorage.setItem('kalitusi-admin-user', result.username)
    setToken(result.token)
    setUsername(result.username)
    setAuthError('')
    setUnreadOrders(0)
    setUnreadReservations(0)
    setUnreadChats(0)
    const page = result.must_change_password ? 'account' : 'dashboard'
    activePageRef.current = page
    setActivePage(page)
  }

  const handleTokenChanged = (nextToken: string) => {
    window.sessionStorage.setItem('kalitusi-admin-token', nextToken)
    setToken(nextToken)
  }

  const handleLogout = async () => {
    try {
      await api.logout(token)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Signed out locally. ${error.message}`
          : 'Signed out locally; the server could not be notified.',
      )
    } finally {
      window.sessionStorage.removeItem('kalitusi-admin-token')
      window.sessionStorage.removeItem('kalitusi-admin-user')
      setToken('')
      setUsername('')
      setUnreadOrders(0)
      setUnreadReservations(0)
      setUnreadChats(0)
      previousIncomingCounts.current = null
      activePageRef.current = 'dashboard'
      setActivePage('dashboard')
    }
  }

  if (checkingToken) {
    return <PageLoadingScreen label="Checking your secure session…" delay={0} />
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} initialError={authError} />
  }

  const pageProps = { token, notify: setNotice }

  return (
    <div className="admin-shell">
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <img
              src={`${import.meta.env.BASE_URL}Kalitusi_Nature_Resort_Sunset_Logo.png`}
              alt=""
            />
          </div>
          <div>
            <strong>Kalitusi</strong>
            <span>RESORT OPERATIONS</span>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? 'nav-item-active' : ''}`}
              onClick={() => {
                navigateToPage(id)
                setSidebarOpen(false)
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'orders' && unreadOrders > 0 && (
                <span className="nav-count-badge" aria-label={`${unreadOrders} unread orders`}>
                  {unreadOrders > 99 ? '99+' : unreadOrders}
                </span>
              )}
              {id === 'reservations' && unreadReservations > 0 && (
                <span
                  className="nav-count-badge"
                  aria-label={`${unreadReservations} unread reservations`}
                >
                  {unreadReservations > 99 ? '99+' : unreadReservations}
                </span>
              )}
              {id === 'chats' && unreadChats > 0 && (
                <span className="nav-count-badge" aria-label={`${unreadChats} unread chats`}>
                  {unreadChats > 99 ? '99+' : unreadChats}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="profile-button"
            aria-label="Open My account"
            onClick={() => {
              navigateToPage('account')
              setSidebarOpen(false)
            }}
          >
            <span className="avatar">{username.slice(0, 1).toUpperCase() || 'A'}</span>
            <span className="profile-copy">
              <strong>{username || 'Resort admin'}</strong>
              <small>Administrator</small>
            </span>
            <UserRound size={17} />
          </button>
          <button
            className="sidebar-logout-button"
            onClick={() => void handleLogout()}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="mobile-workspace-brand">
            <img
              src={`${import.meta.env.BASE_URL}Kalitusi_Nature_Resort_Sunset_Logo.png`}
              alt="Kalitusi Nature Resort"
            />
            <span>Kalitusi</span>
          </div>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{titleForPage(activePage)}</strong>
          </div>
          <div className="topbar-right">
            <InstallAppButton />
            <BrowserNotificationsButton
              token={token}
              permission={notificationPermission}
              onPermissionChange={setNotificationPermission}
              notify={setNotice}
            />
            <span className="today-label">{todayLabel}</span>
            <button
              className="user-chip"
              aria-label="Open My account"
              onClick={() => navigateToPage('account')}
            >
              <span className="avatar avatar-small">
                {username.slice(0, 1).toUpperCase() || 'A'}
              </span>
              <span>{username || 'Admin'}</span>
              <UserRound size={15} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'dashboard' && (
            <DashboardPage
              {...pageProps}
              onNavigate={navigateToPage}
            />
          )}
          {activePage === 'orders' && <OrdersPage {...pageProps} />}
          {activePage === 'chats' && <ChatPage {...pageProps} />}
          {activePage === 'support-tickets' && (
            <SupportTicketsPage token={token} />
          )}
          {activePage === 'products' && <ProductsPage {...pageProps} />}
          {activePage === 'reservations' && <ReservationsPage {...pageProps} />}
          {activePage === 'payment-receipts' && (
            <PaymentReceiptsPage {...pageProps} />
          )}
          {activePage === 'categories' && <CategoriesPage {...pageProps} />}
          {activePage === 'lodges' && <LodgesPage {...pageProps} />}
          {activePage === 'account' && (
            <MyAccountPage
              token={token}
              notify={setNotice}
              onTokenChanged={handleTokenChanged}
            />
          )}
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default App
