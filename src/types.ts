export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'cancelled'

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  sort_order: number
  is_active: boolean
}

export interface Product {
  id: number
  name: string
  slug: string
  category_id: number
  category_name: string
  description: string
  price_ugx: number
  image_url: string
  is_available: boolean
  is_featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Lodge {
  id: number
  name: string
  slug: string
  description: string
  capacity: number
  image_url: string
  is_active: boolean
}

export interface OrderItem {
  id: number
  product_name: string
  unit_price_ugx: number
  quantity: number
  line_total_ugx: number
}

export interface Order {
  id: number
  number: string
  status: OrderStatus
  order_type: 'dine_in' | 'lodge'
  location: string
  guest_name: string
  phone: string
  payment_method: 'cash' | 'card_at_counter'
  payment_status: 'unpaid' | 'paid'
  note: string
  total_ugx: number
  created_at: string
  items: OrderItem[]
}

export interface Reservation {
  id: number
  reference: string
  status: ReservationStatus
  lodge: number
  lodge_name: string
  guest_name: string
  email: string
  phone: string
  check_in: string
  check_out: string
  adults: number
  children: number
  note: string
  created_at: string
}

export interface DashboardData {
  orders_total: number
  orders_by_status: Partial<Record<OrderStatus, number>>
  new_orders: number
  pending_reservations: number
  products_total: number
  categories_total: number
  lodges_total: number
  recent_orders: Order[]
  recent_reservations: Reservation[]
}

export interface LoginResponse {
  token: string
  username: string
}

export type ProductInput = Omit<
  Product,
  'id' | 'slug' | 'category_name' | 'created_at' | 'updated_at'
>

export type CategoryInput = Omit<Category, 'id' | 'slug'>

export type LodgeInput = Omit<Lodge, 'id' | 'slug'>
