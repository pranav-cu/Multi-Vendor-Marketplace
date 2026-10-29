export interface VendorProduct {
  productId: string;
  title: string;
  description: string;
  price: number;
  stockQuantity: number;
  images?: string[];
  createdAt: string;
  updatedAt: string;
  vendorId: number;
  vendorEmail: string;
  storeName: string;
}

export interface ProductInput {
  title: string;
  description: string;
  price: number;
  stockQuantity: number;
  images?: string[];
}

const resolveBaseUrl = (): string => {
  let url: string | undefined;
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (metaEnv) {
      url = metaEnv.VITE_VENDOR_SERVICE_URL || metaEnv.VENDOR_SERVICE_URL;
    }
  } catch {
    // Environments without import.meta.env
  }
  if (!url) {
    const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
    if (globalProcess?.env) {
      url = globalProcess.env.VITE_VENDOR_SERVICE_URL || globalProcess.env.VENDOR_SERVICE_URL;
    }
  }
  return (url || 'http://localhost:3001').replace(/\/+$/, '');
};

const VENDOR_SERVICE_URL = resolveBaseUrl();

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('vendor_token');
  if (!token) {
    throw new Error('Please sign in before managing products.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${VENDOR_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: T;
  };

  if (!response.ok) {
    throw new Error(payload.message || 'The product request could not be completed.');
  }

  return payload.data as T;
};

export const getMyProducts = async (): Promise<VendorProduct[]> => {
  return request<VendorProduct[]>('/products/my');
};

export const createProduct = async (input: ProductInput): Promise<VendorProduct> => {
  return request<VendorProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

export const updateProduct = async (
  productId: string,
  input: Partial<ProductInput>
): Promise<VendorProduct> => {
  return request<VendorProduct>(`/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
};

export const deleteProduct = async (productId: string): Promise<{ productId: string }> => {
  return request<{ productId: string }>(`/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
};

export const uploadProductImages = async (files: File[]): Promise<string[]> => {
  const token = localStorage.getItem('vendor_token');
  if (!token) {
    throw new Error('Please sign in before uploading images.');
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }

  const response = await fetch(`${VENDOR_SERVICE_URL}/products/upload-images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { images?: string[] };
  };

  if (!response.ok) {
    throw new Error(payload.message || 'Image upload failed.');
  }

  return payload.data?.images || [];
};

export const resolveProductImageUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${VENDOR_SERVICE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};
