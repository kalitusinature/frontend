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
  | 'checked_in'
  | 'completed'

export type ReservationSource = 'website' | 'walk_in' | 'phone' | 'staff'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentMethod =
  | 'cash'
  | 'card_at_counter'
  | 'mobile_money'
  | 'bank_transfer'
  | 'other'

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

export interface LodgeImage {
  id: number
  image_url: string
  sort_order: number
}

export interface Lodge {
  id: number
  name: string
  slug: string
  description: string
  capacity: number
  min_nights: number
  max_nights: number
  min_advance_days: number
  max_advance_days: number
  checkin_weekdays: number[]
  image_url: string
  images: LodgeImage[]
  is_active: boolean
}

export interface OrderItem {
  id: number
  product_name: string
  product_image_url: string
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
  email: string
  payment_method: 'cash' | 'card_at_counter'
  payment_status: PaymentStatus
  amount_paid_ugx: number
  balance_ugx: number
  note: string
  cancellation_reason: string
  total_ugx: number
  created_at: string
  items: OrderItem[]
}

export interface ChatConversation {
  id: number
  guest_name: string
  email: string
  updated_at: string
  unread_count: number
  last_message_body: string
  last_message_sender: 'customer' | 'staff' | ''
  last_message_at: string | null
}

export interface ChatMessage {
  id: number
  sender: 'customer' | 'staff'
  body: string
  created_at: string
}

export interface SupportTicket {
  id: number
  name: string
  email: string
  phone: string
  subject: string
  message: string
  email_sent: boolean
  created_at: string
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
  total_due_ugx: number
  amount_paid_ugx: number
  balance_ugx: number
  payment_status: PaymentStatus
  note: string
  cancellation_reason: string
  occasion: string
  source: ReservationSource
  created_at: string
  updated_at: string
}

export type ReservationInput = Pick<
  Reservation,
  | 'status'
  | 'source'
  | 'lodge'
  | 'guest_name'
  | 'email'
  | 'phone'
  | 'check_in'
  | 'check_out'
  | 'adults'
  | 'children'
  | 'total_due_ugx'
  | 'note'
  | 'occasion'
>

export interface PaymentReceipt {
  id: number
  receipt_number: string
  customer_name: string
  customer_email: string
  order_number: string | null
  reservation_reference: string | null
  method: PaymentMethod
  method_label: string
  transaction_reference: string
  amount_ugx: number
  total_due_ugx: number
  paid_to_date_ugx: number
  balance_ugx: number
  payment_status: Exclude<PaymentStatus, 'unpaid'>
  verified_at: string
}

export interface PaymentRecordInput {
  order_id?: number
  reservation_id?: number
  amount_ugx: number
  method: PaymentMethod
  transaction_reference: string
}

export interface PaymentRecordResponse extends PaymentReceipt {
  email_available: boolean
  email_sent: boolean
}

export interface LodgeBlockout {
  id: number
  lodge: number
  lodge_name: string
  start_date: string
  end_date: string
  reason: string
  created_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface DashboardData {
  orders_total: number
  orders_by_status: Partial<Record<OrderStatus, number>>
  new_orders: number
  pending_reservations: number
  reservations_total: number
  reservations_by_status: Partial<Record<ReservationStatus, number>>
  products_total: number
  categories_total: number
  lodges_total: number
  recent_orders: Order[]
  recent_reservations: Reservation[]
}

export type LodgeInput = Omit<Lodge, 'id' | 'slug' | 'images'> & {
  remove_image_ids?: number[]
}

export interface LoginResponse {
  token: string
  username: string
  must_change_password: boolean
}

export interface StaffAccount {
  username: string
  email: string
  first_name: string
  last_name: string
  is_superuser: boolean
  must_change_password: boolean
}

export interface StaffUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  must_change_password: boolean
}

export interface StaffCreateInput {
  username: string
  email: string
  first_name: string
  last_name: string
}

export interface TemporaryPasswordResponse {
  staff: StaffUser
  temporary_password: string
}

export type ProductInput = Omit<
  Product,
  'id' | 'slug' | 'category_name' | 'created_at' | 'updated_at'
>

export type CategoryInput = Omit<Category, 'id' | 'slug'>
