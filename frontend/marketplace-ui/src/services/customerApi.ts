import type {
  AddressInput,
  CatalogPaginationResult,
  CatalogProduct,
  CustomerAuthResponse,
  CustomerCart,
  CustomerOrder,
  CustomerOrderListResult,
  CustomerProfile,
  DeliveryAddressSnapshot,
  SavedAddress,
} from '../types/customer';

const resolveBaseUrl = (): string => {
  let url: string | undefined;
  try {
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      url = import.meta.env.VITE_VENDOR_SERVICE_URL || import.meta.env.VENDOR_SERVICE_URL;
    }
  } catch {
    // In environments where import.meta.env is not supported
  }
  if (!url) {
    const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
    if (globalProcess?.env) {
      url = globalProcess.env.VITE_VENDOR_SERVICE_URL || globalProcess.env.VENDOR_SERVICE_URL;
    }
  }
  return (url || 'http://localhost:3001').replace(/\/+$/, '');
};

// Sanitize base URL by stripping trailing slashes
export const VENDOR_SERVICE_URL = resolveBaseUrl();

export const CUSTOMER_TOKEN_KEY = 'customer_token';

export class CustomerApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'CustomerApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const getCustomerToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
};

export const setCustomerToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
};

export const removeCustomerToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
};

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export const customerRequest = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const { requiresAuth = false, headers, ...restOptions } = options;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = getCustomerToken();
    if (!token) {
      throw new CustomerApiError('Please sign in to proceed.', 401);
    }
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${VENDOR_SERVICE_URL}${cleanEndpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
    });
  } catch {
    throw new CustomerApiError('Unable to connect to marketplace service. Please check your network connection.', 503);
  }

  const contentType = response.headers.get('content-type') || '';
  let responseData: { message?: string; data?: T; details?: unknown } | null = null;

  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new CustomerApiError(text || `Request failed with status ${response.status}`, response.status);
    }
  }

  if (!response.ok) {
    let message = responseData?.message;
    if (!message) {
      switch (response.status) {
        case 400:
          message = 'The requested operation could not be validated. Please check the inputs.';
          break;
        case 401:
          message = 'Your session has expired or is invalid. Please sign in again.';
          break;
        case 403:
          message = 'Access forbidden. This action requires an authenticated customer account.';
          break;
        case 404:
          message = 'The requested item or resource was not found.';
          break;
        case 409:
          message = 'A conflict occurred with current inventory or account state. Please refresh and try again.';
          break;
        case 429:
          message = 'Too many requests. Please wait a moment before trying again.';
          break;
        case 500:
          message = 'An unexpected server error occurred. Please try again later.';
          break;
        case 503:
          message = 'Marketplace service is temporarily unavailable. Please try again shortly.';
          break;
        default:
          message = `Request failed with status ${response.status}`;
      }
    }
    throw new CustomerApiError(message, response.status, responseData?.details);
  }

  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data as T;
  }

  return responseData as unknown as T;
};

// ---------------- AUTHENTICATION ---------------- //

export const requestCustomerOtp = async (email: string): Promise<{ message: string }> => {
  return customerRequest<{ message: string }>('/auth/customer/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
};

export const verifyCustomerOtp = async (
  email: string,
  otp: string,
  displayName?: string
): Promise<CustomerAuthResponse> => {
  const body: { email: string; otp: string; displayName?: string } = {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  };
  if (displayName && displayName.trim()) {
    body.displayName = displayName.trim();
  }

  const res = await customerRequest<CustomerAuthResponse>('/auth/customer/verify-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (res.token) {
    setCustomerToken(res.token);
  }
  return res;
};

// ---------------- CATALOGUE ---------------- //

export const getCatalogProducts = async (params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<CatalogPaginationResult> => {
  const query = new URLSearchParams();
  if (params.page && params.page > 0) query.set('page', String(params.page));
  if (params.pageSize && params.pageSize > 0) query.set('pageSize', String(params.pageSize));
  if (params.search && params.search.trim()) {
    // Truncate to 100 characters to prevent backend 400 rejection
    query.set('search', params.search.trim().slice(0, 100));
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return customerRequest<CatalogPaginationResult>(`/catalog/products${queryString}`);
};

export const getCatalogProduct = async (productId: string): Promise<CatalogProduct> => {
  return customerRequest<CatalogProduct>(`/catalog/products/${encodeURIComponent(productId.trim())}`);
};

// ---------------- CART ---------------- //

export const getCart = async (): Promise<CustomerCart> => {
  return customerRequest<CustomerCart>('/cart', { requiresAuth: true });
};

export const addCartItem = async (productId: string, quantity = 1): Promise<CustomerCart> => {
  return customerRequest<CustomerCart>('/cart/items', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify({ productId: productId.trim(), quantity }),
  });
};

export const updateCartItem = async (productId: string, quantity: number): Promise<CustomerCart> => {
  return customerRequest<CustomerCart>(`/cart/items/${encodeURIComponent(productId.trim())}`, {
    method: 'PATCH',
    requiresAuth: true,
    body: JSON.stringify({ quantity }),
  });
};

export const removeCartItem = async (productId: string): Promise<CustomerCart> => {
  return customerRequest<CustomerCart>(`/cart/items/${encodeURIComponent(productId.trim())}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
};

export const clearCart = async (): Promise<CustomerCart> => {
  return customerRequest<CustomerCart>('/cart', {
    method: 'DELETE',
    requiresAuth: true,
  });
};

// ---------------- PROFILE & SAVED ADDRESSES ---------------- //

export const getCustomerProfile = async (): Promise<CustomerProfile> => {
  return customerRequest<CustomerProfile>('/customers/me', { requiresAuth: true });
};

export const updateCustomerProfile = async (displayName: string): Promise<CustomerProfile> => {
  return customerRequest<CustomerProfile>('/customers/me', {
    method: 'PATCH',
    requiresAuth: true,
    body: JSON.stringify({ displayName: displayName.trim().slice(0, 120) }),
  });
};

export const listAddresses = async (): Promise<SavedAddress[]> => {
  return customerRequest<SavedAddress[]>('/customers/me/addresses', { requiresAuth: true });
};

export const addAddress = async (data: AddressInput): Promise<SavedAddress> => {
  return customerRequest<SavedAddress>('/customers/me/addresses', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
};

export const getAddress = async (addressId: string): Promise<SavedAddress> => {
  return customerRequest<SavedAddress>(`/customers/me/addresses/${encodeURIComponent(addressId.trim())}`, {
    requiresAuth: true,
  });
};

export const updateAddress = async (addressId: string, data: Partial<AddressInput>): Promise<SavedAddress> => {
  return customerRequest<SavedAddress>(`/customers/me/addresses/${encodeURIComponent(addressId.trim())}`, {
    method: 'PATCH',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
};

export const deleteAddress = async (addressId: string): Promise<{ addressId: string }> => {
  return customerRequest<{ addressId: string }>(`/customers/me/addresses/${encodeURIComponent(addressId.trim())}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
};

export const setDefaultAddress = async (addressId: string): Promise<SavedAddress> => {
  return customerRequest<SavedAddress>(`/customers/me/addresses/${encodeURIComponent(addressId.trim())}/default`, {
    method: 'PATCH',
    requiresAuth: true,
  });
};

// ---------------- ORDERS ---------------- //

export interface CheckoutPayload {
  savedAddressId?: string;
  deliveryAddress?: DeliveryAddressSnapshot;
}

export const createOrder = async (payload: CheckoutPayload): Promise<CustomerOrder> => {
  return customerRequest<CustomerOrder>('/orders', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
};

export const listOrders = async (page = 1, pageSize = 20): Promise<CustomerOrderListResult> => {
  const p = Math.max(1, page);
  const ps = Math.min(50, Math.max(1, pageSize));
  return customerRequest<CustomerOrderListResult>(`/orders?page=${p}&pageSize=${ps}`, {
    requiresAuth: true,
  });
};

export const getOrder = async (orderId: string): Promise<CustomerOrder> => {
  return customerRequest<CustomerOrder>(`/orders/${encodeURIComponent(orderId.trim())}`, {
    requiresAuth: true,
  });
};

export const cancelOrder = async (orderId: string): Promise<CustomerOrder> => {
  return customerRequest<CustomerOrder>(`/orders/${encodeURIComponent(orderId.trim())}/cancel`, {
    method: 'POST',
    requiresAuth: true,
  });
};
