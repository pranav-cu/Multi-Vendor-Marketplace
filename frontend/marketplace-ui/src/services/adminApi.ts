import type { Vendor } from '../types/marketplace';
import { validateUserToken } from '../utils/customerAuthUtils.ts';

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
    throw new Error('Please sign in with an administrator account.');
  }

  const validated = validateUserToken(token);
  if (!validated || validated.role !== 'admin') {
    throw new Error('Access denied: Administrator privileges required.');
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
    throw new Error(payload.message || 'The administrator request could not be completed.');
  }

  return payload.data as T;
};

export const getPendingVendors = async (): Promise<Vendor[]> => {
  return request<Vendor[]>('/admin/pending');
};

export const approveVendor = async (userId: number): Promise<void> => {
  await request<unknown>('/admin/approve', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

export const rejectVendor = async (userId: number): Promise<void> => {
  await request<unknown>('/admin/reject', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};
