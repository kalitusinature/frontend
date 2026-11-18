import type {
  Category,
  CategoryInput,
  DashboardData,
  Lodge,
  LodgeInput,
  LoginResponse,
  Order,
  OrderStatus,
  Product,
  ProductInput,
  Reservation,
  ReservationStatus,
} from './types'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'https://backend-bte7.onrender.com/api/v1'
).replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function formatError(data: unknown): string {
  if (typeof data === 'string' && data) return data
  if (typeof data !== 'object' || data === null) {
    return 'The request could not be completed.'
  }

  if ('detail' in data && typeof data.detail === 'string') {
    return data.detail
  }

  const messages = Object.entries(data).flatMap(([field, value]) => {
    const items = Array.isArray(value) ? value : [value]
    return items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => `${field}: ${item}`)
  })
  return messages.length
    ? messages.join(' ')
    : 'The request could not be completed.'
}

async function request<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Token ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let data: unknown = text
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    throw new ApiError(formatError(data), response.status)
  }

  return data as T
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}

export const api = {
  login(username: string, password: string) {
    return request<LoginResponse>('/auth/token/', undefined, {
      method: 'POST',
      body: jsonBody({ username, password }),
    })
  },
  logout(token: string) {
    return request<void>('/auth/logout/', token, { method: 'POST' })
  },
  dashboard(token: string) {
    return request<DashboardData>('/staff/dashboard/', token)
  },
  orders(token: string, status?: string, query?: string) {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (query) params.set('q', query)
    const suffix = params.size ? `?${params.toString()}` : ''
    return request<Order[]>(`/staff/orders/${suffix}`, token)
  },
  updateOrder(
    token: string,
    id: number,
    updates: { status?: OrderStatus; payment_status?: 'unpaid' | 'paid' },
  ) {
    return request<Pick<Order, 'status' | 'payment_status'>>(`/staff/orders/${id}/`, token, {
      method: 'PATCH',
      body: jsonBody(updates),
    })
  },
  products(token: string) {
    return request<Product[]>('/staff/products/', token)
  },
  saveProduct(token: string, input: ProductInput, id?: number) {
    const path = id ? `/staff/products/${id}/` : '/staff/products/'
    return request<Product>(path, token, {
      method: id ? 'PATCH' : 'POST',
      body: jsonBody(input),
    })
  },
  categories(token: string) {
    return request<Category[]>('/staff/categories/', token)
  },
  saveCategory(token: string, input: CategoryInput, id?: number) {
    const path = id ? `/staff/categories/${id}/` : '/staff/categories/'
    return request<Category>(path, token, {
      method: id ? 'PATCH' : 'POST',
      body: jsonBody(input),
    })
  },
  lodges(token: string) {
    return request<Lodge[]>('/staff/lodges/', token)
  },
  saveLodge(token: string, input: LodgeInput, id?: number) {
    const path = id ? `/staff/lodges/${id}/` : '/staff/lodges/'
    return request<Lodge>(path, token, {
      method: id ? 'PATCH' : 'POST',
      body: jsonBody(input),
    })
  },
  reservations(token: string, status?: string) {
    const suffix =
      status && status !== 'all'
        ? `?status=${encodeURIComponent(status)}`
        : ''
    return request<Reservation[]>(`/staff/reservations/${suffix}`, token)
  },
  updateReservation(token: string, id: number, status: ReservationStatus) {
    return request<Pick<Reservation, 'status'>>(`/staff/reservations/${id}/`, token, {
      method: 'PATCH',
      body: jsonBody({ status }),
    })
  },
}
