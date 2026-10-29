/**
 * Customer and User authentication and token utilities.
 * Validates JWTs without external dependencies.
 */

export interface ValidatedCustomerToken {
  userId: number;
  email: string;
  role: 'customer';
}

export interface ValidatedUserToken {
  userId: number;
  email: string;
  role: 'admin' | 'vendor' | 'customer';
}

export const validateUserToken = (
  token: string | null
): ValidatedUserToken | null => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const rawPayload =
      typeof atob === 'function'
        ? atob(base64)
        : (globalThis as unknown as { Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } } })
            .Buffer?.from(base64, 'base64')
            .toString('binary') || '';
    if (!rawPayload) return null;
    const payload = JSON.parse(rawPayload);

    if (!payload || !payload.role || typeof payload.userId !== 'number') {
      return null;
    }

    // Expiration check (exp is in seconds)
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email || '',
      role: payload.role,
    };
  } catch {
    return null;
  }
};

export const isAdminToken = (token: string | null): boolean => {
  const validated = validateUserToken(token);
  return Boolean(validated && validated.role === 'admin');
};

export const isVendorToken = (token: string | null): boolean => {
  const validated = validateUserToken(token);
  return Boolean(validated && validated.role === 'vendor');
};

export const validateCustomerToken = (
  token: string | null
): ValidatedCustomerToken | null => {
  const validated = validateUserToken(token);
  if (!validated || validated.role !== 'customer') {
    return null;
  }

  return {
    userId: validated.userId,
    email: validated.email,
    role: 'customer',
  };
};

