import React, { createContext, useContext, useState, useEffect } from 'react';
import { validateUserToken } from '../utils/customerAuthUtils.ts';
import type {
  Vendor,
  Product,
  CartItem,
  Order,
  SubOrder,
  Payout,
  SagaStep,
  FulfillmentStatus,
} from '../types/marketplace';

// Default Luxury Multi-Vendor Seeds
const INITIAL_VENDORS: Vendor[] = [
  {
    userId: 1001,
    storeName: 'Atelier Minimaliste',
    slug: 'atelier-minimaliste',
    email: 'archivist@atelier-objects.com',
    kycDocs: ['/uploads/kyc/commercial_register_2025.pdf'],
    status: 'verified',
    commissionPct: 12,
    payoutAccountId: 'acct_1NZs9kE1AtelierFR',
    gmv: 48500,
  },
  {
    userId: 1002,
    storeName: 'Aoyama Ceramic Studio',
    slug: 'aoyama-ceramics',
    email: 'kenzo@aoyama-clay.jp',
    kycDocs: ['/uploads/kyc/tokyo_trade_license.pdf'],
    status: 'verified',
    commissionPct: 15,
    payoutAccountId: 'acct_2MNb7xP2TokyoJP',
    gmv: 32400,
  },
  {
    userId: 1003,
    storeName: 'Mercer Architectural Castings',
    slug: 'mercer-castings',
    email: 'foundry@mercer-bronze.com',
    kycDocs: ['/uploads/kyc/mercer_incorporation_ny.pdf'],
    status: 'pending',
    commissionPct: 10,
    payoutAccountId: 'acct_9JKw3mQ3MercerUS',
    gmv: 14200,
  },
  {
    userId: 1004,
    storeName: 'Kyoto Wabi-Sabi Woodworks',
    slug: 'kyoto-woodworks',
    email: 'master@kyoto-wood.jp',
    kycDocs: ['/uploads/kyc/kyoto_guild_cert.pdf'],
    status: 'pending',
    commissionPct: 14,
    payoutAccountId: 'acct_7GHp5rT4KyotoJP',
    gmv: 8900,
  },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    vendorId: 1001,
    vendorName: 'Atelier Minimaliste',
    title: 'Monolith Alabaster Table Lamp',
    price: 1250,
    stock: 14,
    category: 'Architectural Lighting',
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80'],
    description: 'Carved from single-quarry Spanish alabaster with concealed warm LED lumen diode.',
    status: 'active',
  },
  {
    id: 'prod-002',
    vendorId: 1001,
    vendorName: 'Atelier Minimaliste',
    title: 'Brutalist Travertine Console',
    price: 3400,
    stock: 6,
    category: 'Living & Objects',
    images: ['https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80'],
    description: 'Honed Roman travertine console table featuring hand-mitred fluted pedestals.',
    status: 'active',
  },
  {
    id: 'prod-003',
    vendorId: 1002,
    vendorName: 'Aoyama Ceramic Studio',
    title: 'Kuro-Raku Smoked Tea Vessel',
    price: 420,
    stock: 22,
    category: 'Ceramics & Clay',
    images: ['https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80'],
    description: 'Wood-fired stoneware fired at 1280°C in an anagama kiln with natural pine ash glaze.',
    status: 'active',
  },
  {
    id: 'prod-004',
    vendorId: 1002,
    vendorName: 'Aoyama Ceramic Studio',
    title: 'Basalt Mineral Glazed Amphora',
    price: 880,
    stock: 9,
    category: 'Ceramics & Clay',
    images: ['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'],
    description: 'Volcanic basalt reduction vessel with matte tactile exterior and waterproof vitrification.',
    status: 'active',
  },
  {
    id: 'prod-005',
    vendorId: 1003,
    vendorName: 'Mercer Architectural Castings',
    title: 'Solid Patinated Bronze Bookends',
    price: 680,
    stock: 18,
    category: 'Living & Objects',
    images: ['https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=800&q=80'],
    description: 'Lost-wax sand-cast sculptural bronze geometric weights with liver-of-sulfur antique patina.',
    status: 'active',
  },
  {
    id: 'prod-006',
    vendorId: 1001,
    vendorName: 'Atelier Minimaliste',
    title: 'Tactile Architecture: Vol. IV Monograph',
    price: 180,
    stock: 45,
    category: 'Monographs',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'],
    description: 'Linen clothbound publication featuring silver foil debossing and unfiltered photography.',
    status: 'active',
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-9021',
    customerId: 'cust_883',
    customerEmail: 'collector@hautestyle.paris',
    totalAmount: 1670,
    paymentId: 'pi_3Mzb49AtelierSecure',
    idempotencyKey: 'idem_73849102-4820-410a',
    sagaStatus: 'COMPLETED',
    createdAt: '2026-10-25T14:32:00Z',
    shippingAddress: {
      name: 'Claire Beauchamp',
      address: '24 Place des Vosges',
      city: 'Paris',
      country: 'France',
    },
    subOrders: [
      {
        vendorId: 1001,
        vendorName: 'Atelier Minimaliste',
        amount: 1250,
        status: 'shipped',
        trackingNumber: 'DHL-EXPRESS-FR-84910',
        items: [
          {
            productId: 'prod-001',
            title: 'Monolith Alabaster Table Lamp',
            price: 1250,
            quantity: 1,
            image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
          },
        ],
      },
      {
        vendorId: 1002,
        vendorName: 'Aoyama Ceramic Studio',
        amount: 420,
        status: 'processing',
        items: [
          {
            productId: 'prod-003',
            title: 'Kuro-Raku Smoked Tea Vessel',
            price: 420,
            quantity: 1,
            image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
          },
        ],
      },
    ],
  },
];

const INITIAL_PAYOUTS: Payout[] = [
  {
    id: 'PAY-801',
    vendorId: 1001,
    vendorName: 'Atelier Minimaliste',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-15',
    grossAmount: 14200,
    commission: 1704, // 12%
    refunds: 0,
    netAmount: 12496,
    status: 'settled',
    transferId: 'tr_1N89vKLkAtelierWire',
    createdAt: '2026-10-16T08:00:00Z',
  },
  {
    id: 'PAY-802',
    vendorId: 1002,
    vendorName: 'Aoyama Ceramic Studio',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-15',
    grossAmount: 9600,
    commission: 1440, // 15%
    refunds: 210,
    netAmount: 7950,
    status: 'settled',
    transferId: 'tr_2M49vKLkTokyoWire',
    createdAt: '2026-10-16T08:00:00Z',
  },
];

interface MarketplaceContextType {
  // Catalog & Inventory
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Unified Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;

  // Distributed Saga Orders & Splitting
  orders: Order[];
  currentSagaStatus: SagaStep | null;
  currentIdempotencyKey: string | null;
  placeOrder: (shippingDetails: {
    name: string;
    email: string;
    address: string;
    city: string;
    country: string;
  }) => Promise<Order>;
  updateSubOrderStatus: (orderId: string, vendorId: number, status: FulfillmentStatus) => void;

  // Vendors & Admin Governance
  vendors: Vendor[];
  currentVendor: Vendor | null;
  setCurrentVendorId: (id: number) => void;
  updateVendorStatus: (vendorId: number, status: Vendor['status']) => void;
  updateCommissionPct: (vendorId: number, commissionPct: number) => void;

  // User Authentication & Session
  currentUserEmail: string | null;
  currentUserRole: 'admin' | 'vendor' | null;
  isAdmin: boolean;
  isVendor: boolean;
  isAuthenticated: boolean;
  loginUser: (email: string, token?: string) => void;
  logoutUser: () => void;

  // Payments, Escrow & Settlements
  payouts: Payout[];
  runPayoutSettlement: () => Promise<Payout[]>;
  isSettling: boolean;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    const saved = localStorage.getItem('marketplace_vendors');
    return saved ? JSON.parse(saved) : INITIAL_VENDORS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('marketplace_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('marketplace_cart');
    return saved ? JSON.parse(saved) : [
      {
        productId: 'prod-001',
        vendorId: 1001,
        vendorName: 'Atelier Minimaliste',
        title: 'Monolith Alabaster Table Lamp',
        price: 1250,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
        category: 'Architectural Lighting',
      },
      {
        productId: 'prod-003',
        vendorId: 1002,
        vendorName: 'Aoyama Ceramic Studio',
        title: 'Kuro-Raku Smoked Tea Vessel',
        price: 420,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
        category: 'Ceramics & Clay',
      },
    ];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('marketplace_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [payouts, setPayouts] = useState<Payout[]>(() => {
    const saved = localStorage.getItem('marketplace_payouts');
    return saved ? JSON.parse(saved) : INITIAL_PAYOUTS;
  });

  const [currentVendorId, setCurrentVendorId] = useState<number>(1001);
  const [currentSagaStatus, setCurrentSagaStatus] = useState<SagaStep | null>(null);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  // User Session, Email & Role state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('vendor_email') || null;
  });

  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'vendor' | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('vendor_token');
    const validated = validateUserToken(token);
    if (validated && (validated.role === 'admin' || validated.role === 'vendor')) {
      return validated.role;
    }
    return null;
  });

  const isAdmin = currentUserRole === 'admin';
  const isVendor = currentUserRole === 'vendor';

  const isAuthenticated = Boolean(
    currentUserEmail || (typeof window !== 'undefined' && localStorage.getItem('vendor_token'))
  );

  const loginUser = (email: string, token?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    setCurrentUserEmail(cleanEmail);
    localStorage.setItem('vendor_email', cleanEmail);
    const targetToken = token || (typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null);
    if (token) {
      localStorage.setItem('vendor_token', token);
    }
    const validated = validateUserToken(targetToken);
    if (validated && (validated.role === 'admin' || validated.role === 'vendor')) {
      setCurrentUserRole(validated.role);
    } else {
      setCurrentUserRole(null);
    }
  };

  const logoutUser = () => {
    setCurrentUserEmail(null);
    setCurrentUserRole(null);
    localStorage.removeItem('vendor_email');
    localStorage.removeItem('vendor_token');
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('marketplace_vendors', JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem('marketplace_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('marketplace_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('marketplace_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('marketplace_payouts', JSON.stringify(payouts));
  }, [payouts]);

  // Current active vendor profile
  const currentVendor = vendors.find((v) => v.userId === currentVendorId) || vendors[0];

  // Cart Calculations
  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          vendorId: product.vendorId,
          vendorName: product.vendorName,
          title: product.title,
          price: product.price,
          quantity,
          image: product.images[0] || '',
          category: product.category,
        },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  // Product CRUD
  const addProduct = (newProd: Omit<Product, 'id'>) => {
    const id = `prod-${Date.now().toString().slice(-4)}`;
    setProducts((prev) => [{ id, ...newProd }, ...prev]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  /**
   * Distributed Saga Order Pipeline Implementation
   * 1. Requires unique Idempotency-Key
   * 2. Emits order.created
   * 3. Simulates Payments Service capture (payment.succeeded)
   * 4. Simulates Catalogue Service stock reservation (stock.reserved)
   * 5. Splits order into vendor-specific subOrders
   */
  const placeOrder = async (shippingDetails: {
    name: string;
    email: string;
    address: string;
    city: string;
    country: string;
  }): Promise<Order> => {
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    setCurrentIdempotencyKey(idempotencyKey);
    setCurrentSagaStatus('ORDER_CREATED');

    // Step 1: Split unified cart into Vendor-Specific subOrders
    const subOrderMap = new Map<number, SubOrder>();

    cart.forEach((item) => {
      if (!subOrderMap.has(item.vendorId)) {
        subOrderMap.set(item.vendorId, {
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          amount: 0,
          status: 'pending',
          items: [],
        });
      }
      const sub = subOrderMap.get(item.vendorId)!;
      sub.items.push({
        productId: item.productId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      });
      sub.amount += item.price * item.quantity;
    });

    const subOrders = Array.from(subOrderMap.values());
    const totalAmount = cartTotal;

    // Saga Step 2: Payment Processing & Capture
    await new Promise((r) => setTimeout(r, 600));
    setCurrentSagaStatus('PAYMENT_PROCESSING');

    await new Promise((r) => setTimeout(r, 700));
    setCurrentSagaStatus('PAYMENT_CAPTURED');

    // Saga Step 3: Stock Reservation & Inventory Update
    await new Promise((r) => setTimeout(r, 600));
    setCurrentSagaStatus('STOCK_RESERVING');

    setProducts((prev) =>
      prev.map((prod) => {
        const orderedItem = cart.find((c) => c.productId === prod.id);
        if (orderedItem) {
          const newStock = Math.max(0, prod.stock - orderedItem.quantity);
          return {
            ...prod,
            stock: newStock,
            status: newStock === 0 ? 'out_of_stock' : prod.status,
          };
        }
        return prod;
      })
    );

    await new Promise((r) => setTimeout(r, 500));
    setCurrentSagaStatus('STOCK_RESERVED');

    // Final Order Creation
    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: `cust_${Math.floor(100 + Math.random() * 900)}`,
      customerEmail: shippingDetails.email,
      subOrders,
      totalAmount,
      paymentId: `pi_stripe_${Date.now().toString(36)}`,
      idempotencyKey,
      sagaStatus: 'COMPLETED',
      createdAt: new Date().toISOString(),
      shippingAddress: shippingDetails,
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();

    await new Promise((r) => setTimeout(r, 400));
    setCurrentSagaStatus('COMPLETED');

    return newOrder;
  };

  const updateSubOrderStatus = (
    orderId: string,
    vendorId: number,
    newStatus: FulfillmentStatus
  ) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          subOrders: order.subOrders.map((sub) =>
            sub.vendorId === vendorId
              ? {
                  ...sub,
                  status: newStatus,
                  trackingNumber:
                    newStatus === 'shipped' && !sub.trackingNumber
                      ? `ATELIER-EXP-${Math.floor(10000 + Math.random() * 90000)}`
                      : sub.trackingNumber,
                }
              : sub
          ),
        };
      })
    );
  };

  // Vendor & Admin Governance
  const updateVendorStatus = (vendorId: number, newStatus: Vendor['status']) => {
    setVendors((prev) =>
      prev.map((v) => (v.userId === vendorId ? { ...v, status: newStatus } : v))
    );
  };

  const updateCommissionPct = (vendorId: number, commissionPct: number) => {
    setVendors((prev) =>
      prev.map((v) => (v.userId === vendorId ? { ...v, commissionPct } : v))
    );
  };

  /**
   * Automated Payouts Engine (POST /api/payouts/run)
   * Runs platform settlement calculating:
   * Net Amount = Gross Amount - (Gross * commissionPct / 100) - Refunds
   */
  const runPayoutSettlement = async (): Promise<Payout[]> => {
    setIsSettling(true);
    await new Promise((r) => setTimeout(r, 1200));

    const today = new Date().toISOString().split('T')[0];
    const generatedPayouts: Payout[] = [];

    vendors
      .filter((v) => v.status === 'verified')
      .forEach((vendor) => {
        // Calculate gross earnings from delivered subOrders
        let grossAmount = 0;
        orders.forEach((ord) => {
          ord.subOrders
            .filter((sub) => sub.vendorId === vendor.userId)
            .forEach((sub) => {
              grossAmount += sub.amount;
            });
        });

        if (grossAmount === 0) grossAmount = Math.floor(2500 + Math.random() * 5000);

        const commission = Math.round((grossAmount * vendor.commissionPct) / 100);
        const refunds = 0;
        const netAmount = grossAmount - commission - refunds;

        const newPayout: Payout = {
          id: `PAY-${Math.floor(100 + Math.random() * 900)}`,
          vendorId: vendor.userId,
          vendorName: vendor.storeName,
          periodStart: '2026-10-16',
          periodEnd: today,
          grossAmount,
          commission,
          refunds,
          netAmount,
          status: 'settled',
          transferId: `tr_wire_${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
        };

        generatedPayouts.push(newPayout);
      });

    setPayouts((prev) => [...generatedPayouts, ...prev]);
    setIsSettling(false);
    return generatedPayouts;
  };

  return (
    <MarketplaceContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotal,
        cartCount,
        orders,
        currentSagaStatus,
        currentIdempotencyKey,
        placeOrder,
        updateSubOrderStatus,
        vendors,
        currentVendor,
        setCurrentVendorId,
        updateVendorStatus,
        updateCommissionPct,
        currentUserEmail,
        currentUserRole,
        isAdmin,
        isVendor,
        isAuthenticated,
        loginUser,
        logoutUser,
        payouts,
        runPayoutSettlement,
        isSettling,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
};

export default MarketplaceContext;

