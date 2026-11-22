import type {
  Category,
  CategoryInput,
  DashboardData,
  LodgeBlockout,
  Lodge,
  LodgeInput,
  LoginResponse,
  Order,
  OrderStatus,
  PaymentRecordInput,
  PaymentRecordResponse,
  PaymentReceipt,
  Paginated,
  Product,
  ProductInput,
  Reservation,
  ReservationInput,
  ReservationSource,
  StaffAccount,
  StaffCreateInput,
  StaffUser,
  TemporaryPasswordResponse,
} from './types'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'https://api.kalitusi.com/api/v1'
).replace(/\/+$/, '')

export interface PushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

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
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
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
  requestStaffPasswordReset(email: string) {
    return request<{ detail: string }>('/auth/password-reset/', undefined, {
      method: 'POST',
      body: jsonBody({ email }),
    })
  },
  confirmStaffPasswordReset(uid: string, token: string, newPassword: string) {
    return request<{ detail: string }>(
      '/auth/password-reset/confirm/',
      undefined,
      {
        method: 'POST',
        body: jsonBody({ uid, token, new_password: newPassword }),
      },
    )
  },
  logout(token: string) {
    return request<void>('/auth/logout/', token, { method: 'POST' })
  },
  staffAccount(token: string) {
    return request<StaffAccount>('/staff/account/', token)
  },
  pushVapidPublicKey(token: string) {
    return request<{ public_key: string }>('/staff/push/vapid-public-key/', token)
  },
  savePushSubscription(token: string, subscription: PushSubscriptionPayload) {
    return request<{ enabled: boolean }>('/staff/push/subscriptions/', token, {
      method: 'POST',
      body: jsonBody(subscription),
    })
  },
  deletePushSubscription(token: string, endpoint: string) {
    return request<void>('/staff/push/subscriptions/', token, {
      method: 'DELETE',
      body: jsonBody({ endpoint }),
    })
  },
  updateStaffAccount(
    token: string,
    updates: Pick<StaffAccount, 'email' | 'first_name' | 'last_name'>,
  ) {
    return request<StaffAccount>('/staff/account/', token, {
      method: 'PATCH',
      body: jsonBody(updates),
    })
  },
  changeStaffPassword(token: string, currentPassword: string, newPassword: string) {
    return request<{ token: string }>('/staff/account/password/', token, {
      method: 'POST',
      body: jsonBody({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  },
  verifyStaffPassword(token: string, currentPassword: string) {
    return request<void>('/staff/account/password/verify/', token, {
      method: 'POST',
      body: jsonBody({ current_password: currentPassword }),
    })
  },
  staffUsers(token: string) {
    return request<StaffUser[]>('/staff/accounts/', token)
  },
  createStaffUser(token: string, input: StaffCreateInput) {
    return request<TemporaryPasswordResponse>('/staff/accounts/', token, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  setStaffUserActive(token: string, id: number, isActive: boolean) {
    return request<StaffUser>(`/staff/accounts/${id}/`, token, {
      method: 'PATCH',
      body: jsonBody({ is_active: isActive }),
    })
  },
  resetStaffUserPassword(token: string, id: number) {
    return request<TemporaryPasswordResponse>(
      `/staff/accounts/${id}/reset-password/`,
      token,
      { method: 'POST' },
    )
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
    updates: {
      status?: OrderStatus
      cancellation_reason?: string
    },
  ) {
    return request<Pick<Order, 'status'>>(`/staff/orders/${id}/`, token, {
      method: 'PATCH',
      body: jsonBody(updates),
    })
  },
  recordPayment(token: string, input: PaymentRecordInput) {
    return request<PaymentRecordResponse>('/staff/payments/', token, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  paymentReceipts(
    token: string,
    filters: {
      query?: string
      status?: PaymentReceipt['payment_status'] | 'all'
      startDate?: string
      endDate?: string
      page?: number
    } = {},
  ) {
    const params = new URLSearchParams()
    if (filters.query) params.set('q', filters.query)
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.startDate) params.set('start_date', filters.startDate)
    if (filters.endDate) params.set('end_date', filters.endDate)
    if (filters.page) params.set('page', String(filters.page))
    const suffix = params.size ? `?${params.toString()}` : ''
    return request<Paginated<PaymentReceipt>>(
      `/staff/payment-receipts/${suffix}`,
      token,
    )
  },
  async downloadPaymentReceipt(token: string, paymentId: number) {
    const headers = new Headers({ Accept: 'application/pdf' })
    headers.set('Authorization', `Token ${token}`)
    const response = await fetch(
      `${API_BASE_URL}/staff/payment-receipts/${paymentId}/download/`,
      { headers },
    )
    if (!response.ok) {
      const text = await response.text()
      let data: unknown = text
      if (text) {
        try {
          data = JSON.parse(text) as unknown
        } catch {
          data = text
        }
      }
      throw new ApiError(formatError(data), response.status)
    }
    return response.blob()
  },
  resendPaymentReceipt(token: string, paymentId: number) {
    return request<{ detail: string }>(
      `/staff/payment-receipts/${paymentId}/resend/`,
      token,
      { method: 'POST' },
    )
  },
  products(token: string) {
    return request<Product[]>('/staff/products/', token)
  },
  saveProduct(token: string, input: ProductInput, id?: number, imageFile?: File) {
    const path = id ? `/staff/products/${id}/` : '/staff/products/'
    let body: BodyInit = jsonBody(input)
    if (imageFile) {
      const form = new FormData()
      Object.entries(input).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => form.append(key, String(item)))
        } else {
          form.append(key, String(value))
        }
      })
      form.append('image_file', imageFile)
      body = form
    }
    return request<Product>(path, token, {
      method: id ? 'PATCH' : 'POST',
      body,
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
  saveLodge(token: string, input: LodgeInput, id?: number, imageFiles: File[] = []) {
    const path = id ? `/staff/lodges/${id}/` : '/staff/lodges/'
    let body: BodyInit = jsonBody(input)
    if (imageFiles.length) {
      const form = new FormData()
      Object.entries(input).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        if (Array.isArray(value)) {
          value.forEach((item) => form.append(key, String(item)))
        } else {
          form.append(key, String(value))
        }
      })
      imageFiles.forEach((file) => form.append('image_files', file))
      body = form
    }
    return request<Lodge>(path, token, {
      method: id ? 'PATCH' : 'POST',
      body,
    })
  },
  reservations(
    token: string,
    filters: {
      status?: string
      query?: string
      source?: ReservationSource | 'all'
      lodge?: number | 'all'
      startDate?: string
      endDate?: string
      page?: number
      ordering?: 'check_in' | '-check_in' | 'created_at' | '-created_at'
    } = {},
  ) {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.query) params.set('q', filters.query)
    if (filters.source && filters.source !== 'all') params.set('source', filters.source)
    if (filters.lodge && filters.lodge !== 'all') params.set('lodge', String(filters.lodge))
    if (filters.startDate) params.set('start_date', filters.startDate)
    if (filters.endDate) params.set('end_date', filters.endDate)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.ordering) params.set('ordering', filters.ordering)
    const suffix = params.size ? `?${params.toString()}` : ''
    return request<Paginated<Reservation>>(`/staff/reservations/${suffix}`, token)
  },
  calendarReservations(token: string, start: string, end: string) {
    const params = new URLSearchParams({ start, end })
    return request<Reservation[]>(`/staff/reservations/calendar/?${params}`, token)
  },
  createReservation(token: string, input: ReservationInput) {
    return request<Reservation>('/staff/reservations/', token, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  updateReservation(
    token: string,
    id: number,
    updates: Partial<ReservationInput> & { cancellation_reason?: string },
  ) {
    return request<Reservation>(`/staff/reservations/${id}/`, token, {
      method: 'PATCH',
      body: jsonBody(updates),
    })
  },
  deleteReservation(token: string, id: number) {
    return request<void>(`/staff/reservations/${id}/`, token, { method: 'DELETE' })
  },
  lodgeBlockouts(token: string) {
    return request<LodgeBlockout[]>('/staff/lodge-blockouts/', token)
  },
  saveLodgeBlockout(
    token: string,
    input: Pick<LodgeBlockout, 'lodge' | 'start_date' | 'end_date' | 'reason'>,
    id?: number,
  ) {
    const path = id ? `/staff/lodge-blockouts/${id}/` : '/staff/lodge-blockouts/'
    return request<LodgeBlockout>(path, token, {
      method: id ? 'PATCH' : 'POST',
      body: jsonBody(input),
    })
  },
  deleteLodgeBlockout(token: string, id: number) {
    return request<void>(`/staff/lodge-blockouts/${id}/`, token, { method: 'DELETE' })
  },
}
