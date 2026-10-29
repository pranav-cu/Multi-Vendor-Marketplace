import { createContext } from 'react';
import type { CustomerCart, CustomerProfile, CustomerUser } from '../types/customer';

export interface CustomerContextType {
  customerToken: string | null;
  customerUser: CustomerUser | null;
  customerProfile: CustomerProfile | null;
  isCustomerAuthenticated: boolean;
  cart: CustomerCart | null;
  cartCount: number;
  isCartLoading: boolean;
  cartError: string | null;
  loginCustomer: (token: string, user: CustomerUser, profile: CustomerProfile) => void;
  logoutCustomer: () => void;
  refreshCart: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateCartQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

