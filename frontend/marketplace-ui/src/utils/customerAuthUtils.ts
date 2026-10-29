/**
 * Customer authentication and token utilities.
 * Validates customer JWTs without external dependencies.
 */

export interface ValidatedCustomerToken {
  userId: number;
  email: string;
  role: 'customer';
}

export const validateCustomerToken = (
  token: string | null
): ValidatedCustomerToken | null => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const rawPayload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(rawPayload);

    // Strict role validation: vendor or admin tokens cannot be customer sessions
    if (!payload || payload.role !== 'customer' || typeof payload.userId !== 'number') {
      return null;
    }

    // Expiration check (exp is in seconds)
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email || '',
      role: 'customer',
    };
  } catch {
    return null;
  }
};

