import { useEffect, useState } from 'react'
import {
  BedDouble,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Tags,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { ApiError, api } from './api'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { LodgesPage } from './pages/LodgesPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReservationsPage } from './pages/ReservationsPage'
import { LoginPage } from './pages/LoginPage'
import type { LoginResponse } from './types'
import { InstallAppButton } from './components/InstallAppButton'
import './App.css'

export type PageId =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'reservations'
  | 'categories'
  | 'lodges'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'products', label: 'Menu products', icon: UtensilsCrossed },
  { id: 'reservations', label: 'Reservations', icon: BedDouble },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'lodges', label: 'Lodges & cottages', icon: BedDouble },
] as const

function titleForPage(page: PageId): string {
  return navigation.find((item) => item.id === page)?.label ?? 'Dashboard'
}

function App() {
  const [token, setToken] = useState(
    () => window.sessionStorage.getItem('kalitusi-admin-token') ?? '',
  )
  const [username, setUsername] = useState(
    () => window.sessionStorage.getItem('kalitusi-admin-user') ?? '',
  )
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [checkingToken, setCheckingToken] = useState(Boolean(token))
  const [authError, setAuthError] = useState('')
  const [todayLabel] = useState(() =>
    new Intl.DateTimeFormat('en-UG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date()),
  )

  useEffect(() => {
    if (!token) return

    let active = true
    api
      .dashboard(token)
      .catch((error: unknown) => {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          window.sessionStorage.removeItem('kalitusi-admin-token')
          window.sessionStorage.removeItem('kalitusi-admin-user')
          setToken('')
          setUsername('')
        } else {
          setAuthError(
            error instanceof Error ? error.message : 'Could not connect to the server.',
          )
        }
      })
      .finally(() => {
        if (active) setCheckingToken(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const handleLogin = (result: LoginResponse) => {
    window.sessionStorage.setItem('kalitusi-admin-token', result.token)
    window.sessionStorage.setItem('kalitusi-admin-user', result.username)
    setToken(result.token)
    setUsername(result.username)
    setAuthError('')
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
      setActivePage('dashboard')
    }
  }

  if (checkingToken) {
    return <div className="app-boot">Connecting to Kalitusi…</div>
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
                setActivePage(id)
                setSidebarOpen(false)
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'orders' && <span className="nav-live-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="profile-button" onClick={handleLogout}>
            <span className="avatar">{username.slice(0, 1).toUpperCase() || 'A'}</span>
            <span className="profile-copy">
              <strong>{username || 'Resort admin'}</strong>
              <small>Administrator</small>
            </span>
            <LogOut size={17} />
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
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{titleForPage(activePage)}</strong>
          </div>
          <div className="topbar-right">
            <InstallAppButton />
            <span className="today-label">{todayLabel}</span>
            <button className="user-chip" onClick={() => void handleLogout()}>
              <span className="avatar avatar-small">
                {username.slice(0, 1).toUpperCase() || 'A'}
              </span>
              <span>{username || 'Admin'}</span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'dashboard' && (
            <DashboardPage
              {...pageProps}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'orders' && <OrdersPage {...pageProps} />}
          {activePage === 'products' && <ProductsPage {...pageProps} />}
          {activePage === 'reservations' && <ReservationsPage {...pageProps} />}
          {activePage === 'categories' && <CategoriesPage {...pageProps} />}
          {activePage === 'lodges' && <LodgesPage {...pageProps} />}
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
