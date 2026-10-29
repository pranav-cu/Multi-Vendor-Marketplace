export interface CustomerUser {
  userId: number;
  email: string;
  role: 'customer';
}

export interface CustomerProfile {
  customerId: string;
  userId: number;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAuthResponse {
  message: string;
  token: string;
  user: CustomerUser;
  customer: CustomerProfile;
}

export interface CatalogProduct {
  productId: string;
  title: string;
  description: string;
  price: number;
  stockQuantity: number;
  images?: string[];
  createdAt: string;
  updatedAt: string;
  vendorId: number;
  storeName?: string;
}

export interface CatalogPaginationResult {
  items: CatalogProduct[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CartItemProduct {
  productId: string;
  title: string | null;
  description: string | null;
  currentPrice: number | null;
  quantity: number;
  currentStock: number;
  storeName: string | null;
  available: boolean;
  itemTotal: number;
}

export interface CustomerCart {
  cartId: string;
  items: CartItemProduct[];
  total: number;
  currency: string;
  updatedAt: string;
}

export interface SavedAddress {
  addressId: string;
  userId: number;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label?: string;
  isDefault?: boolean;
}

export interface DeliveryAddressSnapshot {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderItemSnapshot {
  productId: string;
  vendorId: number;
  title: string;
  storeName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderVendorGroup {
  vendorId: number;
  storeName: string;
  itemProductIds: string[];
  subtotal: number;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface CustomerOrderSummary {
  orderId: string;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderListResult {
  items: CustomerOrderSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomerOrder {
  orderId: string;
  customerUserId: number;
  items: OrderItemSnapshot[];
  vendorGroups: OrderVendorGroup[];
  subtotal: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryAddress: DeliveryAddressSnapshot;
  createdAt: string;
  updatedAt: string;
}

