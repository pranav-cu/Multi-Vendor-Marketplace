import React, { useState, useEffect, useCallback } from 'react';
import type { CustomerCart, CustomerProfile, CustomerUser } from '../types/customer';
import { CustomerContext } from './customerContextDef';
import {
  getCustomerToken,
  setCustomerToken,
  removeCustomerToken,
  getCustomerProfile as fetchCustomerProfileApi,
  getCart as fetchCartApi,
  addCartItem as addCartItemApi,
  updateCartItem as updateCartItemApi,
  removeCartItem as removeCartItemApi,
  clearCart as clearCartApi,
  CustomerApiError,
} from '../services/customerApi';
import { validateCustomerToken } from '../utils/customerAuthUtils';

export { validateCustomerToken };

const CUSTOMER_USER_KEY = 'customer_user';

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize and validate token
  const [customerToken, setCustomerTokenState] = useState<string | null>(() => {
    const token = getCustomerToken();
    const validated = validateCustomerToken(token);
    if (!validated && token) {
      removeCustomerToken();
      if (typeof window !== 'undefined') localStorage.removeItem(CUSTOMER_USER_KEY);
      return null;
    }
    return token;
  });

  // Initialize and validate customer user
  const [customerUser, setCustomerUserState] = useState<CustomerUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = getCustomerToken();
    const validated = validateCustomerToken(token);
    if (!validated) return null;

    const saved = localStorage.getItem(CUSTOMER_USER_KEY);
    if (!saved) return validated;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role === 'customer' && parsed.userId === validated.userId) {
        return parsed;
      }
      return validated;
    } catch {
      return validated;
    }
  });

  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [cart, setCart] = useState<CustomerCart | null>(null);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const isCustomerAuthenticated = Boolean(
    customerToken &&
    customerUser?.role === 'customer' &&
    validateCustomerToken(customerToken)
  );

  const logoutCustomer = useCallback(() => {
    removeCustomerToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CUSTOMER_USER_KEY);
    }
    setCustomerTokenState(null);
    setCustomerUserState(null);
    setCustomerProfile(null);
    setCart(null);
    setCartError(null);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!isCustomerAuthenticated) {
      setCart(null);
      return;
    }
    setIsCartLoading(true);
    setCartError(null);
    try {
      const data = await fetchCartApi();
      setCart(data);
    } catch (err) {
      if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        logoutCustomer();
      } else if (err instanceof Error) {
        setCartError(err.message);
      }
    } finally {
      setIsCartLoading(false);
    }
  }, [isCustomerAuthenticated, logoutCustomer]);

  const refreshProfile = useCallback(async () => {
    if (!isCustomerAuthenticated) {
      setCustomerProfile(null);
      return;
    }
    try {
      const data = await fetchCustomerProfileApi();
      setCustomerProfile(data);
    } catch (err) {
      if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        logoutCustomer();
      }
    }
  }, [isCustomerAuthenticated, logoutCustomer]);

  // Synchronize initial cart and profile upon authentication or account switch
  useEffect(() => {
    if (!isCustomerAuthenticated) {
      setCart(null);
      setCustomerProfile(null);
      return;
    }

    let isMounted = true;
    setIsCartLoading(true);

    fetchCartApi()
      .then((data) => {
        if (isMounted) setCart(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
          logoutCustomer();
        } else if (err instanceof Error) {
          setCartError(err.message);
        }
      })
      .finally(() => {
        if (isMounted) setIsCartLoading(false);
      });

    fetchCustomerProfileApi()
      .then((data) => {
        if (isMounted) setCustomerProfile(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
          logoutCustomer();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isCustomerAuthenticated, customerUser?.userId, logoutCustomer]);

  const loginCustomer = (token: string, user: CustomerUser, profile: CustomerProfile) => {
    // Defense-in-depth: Reject any token that does not meet customer constraints
    const validated = validateCustomerToken(token);
    if (!validated) {
      logoutCustomer();
      throw new Error('Authentication rejected: Provided credentials do not grant customer role.');
    }

    setCustomerToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
    }
    setCustomerTokenState(token);
    setCustomerUserState(user);
    setCustomerProfile(profile);

    // Isolate accounts: clear previous customer's cart state immediately
    setCart(null);
    setCartError(null);
    setIsCartLoading(true);

    fetchCartApi()
      .then((freshCart) => setCart(freshCart))
      .catch(() => {})
      .finally(() => setIsCartLoading(false));
  };

  const addToCart = async (productId: string, quantity = 1) => {
    setIsCartLoading(true);
    setCartError(null);
    try {
      const updated = await addCartItemApi(productId, quantity);
      setCart(updated);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
        } else {
          setCartError(err.message);
        }
      }
      throw err;
    } finally {
      setIsCartLoading(false);
    }
  };

  const updateCartQuantity = async (productId: string, quantity: number) => {
    setIsCartLoading(true);
    setCartError(null);
    try {
      const updated = await updateCartItemApi(productId, quantity);
      setCart(updated);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
        } else {
          setCartError(err.message);
        }
      }
      throw err;
    } finally {
      setIsCartLoading(false);
    }
  };

  const removeFromCart = async (productId: string) => {
    setIsCartLoading(true);
    setCartError(null);
    try {
      const updated = await removeCartItemApi(productId);
      setCart(updated);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
        } else {
          setCartError(err.message);
        }
      }
      throw err;
    } finally {
      setIsCartLoading(false);
    }
  };

  const clearCart = async () => {
    setIsCartLoading(true);
    setCartError(null);
    try {
      const updated = await clearCartApi();
      setCart(updated);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
        } else {
          setCartError(err.message);
        }
      }
      throw err;
    } finally {
      setIsCartLoading(false);
    }
  };

  const cartCount = cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;

  return (
    <CustomerContext.Provider
      value={{
        customerToken,
        customerUser,
        customerProfile,
        isCustomerAuthenticated,
        cart,
        cartCount,
        isCartLoading,
        cartError,
        loginCustomer,
        logoutCustomer,
        refreshCart,
        refreshProfile,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};
