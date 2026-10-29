import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChartIcon,
  PackageIcon,
  TruckIcon,
  BanknoteIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SpinnerIcon,
  RefreshIcon,
} from '../components/ui/Icons';
import VendorProductManagement from '../components/VendorProductManagement';
import {
  getVendorProfile,
  getVendorOrders,
  getVendorProducts,
  updateVendorOrderStatus,
  type VendorProfile,
  type VendorSubOrder,
  type VendorProduct,
} from '../services/vendorApi';
import { resolveProductImageUrl } from '../services/productApi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface VendorDashboardViewProps {
  onNavigateToProfile: () => void;
}

export const VendorDashboardView: React.FC<VendorDashboardViewProps> = ({
  onNavigateToProfile,
}) => {
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'products' | 'fulfillment' | 'payouts'
  >('analytics');

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [orders, setOrders] = useState<VendorSubOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [fetchedProfile, fetchedProducts, fetchedOrders] = await Promise.all([
        getVendorProfile().catch(() => null),
        getVendorProducts().catch(() => []),
        getVendorOrders().catch(() => []),
      ]);

      setProfile(fetchedProfile);
      setProducts(fetchedProducts);
      setOrders(fetchedOrders);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to synchronize vendor dashboard data.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // Financial Metrics calculated from real data
  const grossSales = useMemo(() => {
    return orders.reduce((sum, ord) => sum + (ord.subtotal || 0), 0);
  }, [orders]);

  const commissionPct = profile?.commissionPct ?? 10;
  const platformFee = Math.round((grossSales * commissionPct) / 100);
  const netEarnings = grossSales - platformFee;
  const totalStockUnits = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
  }, [products]);

  // Analytics Trend Data from real orders
  const revenueTrendData = useMemo(() => {
    if (orders.length === 0) {
      return [
        { period: 'Past Cycle', gross: 0, net: 0 },
        { period: 'Current', gross: grossSales, net: netEarnings },
      ];
    }

    const groups = new Map<string, { gross: number; net: number }>();
    orders.forEach((ord) => {
      const dateKey = new Date(ord.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const existing = groups.get(dateKey) || { gross: 0, net: 0 };
      const fee = Math.round(((ord.subtotal || 0) * commissionPct) / 100);
      existing.gross += ord.subtotal || 0;
      existing.net += (ord.subtotal || 0) - fee;
      groups.set(dateKey, existing);
    });

    return Array.from(groups.entries()).map(([period, data]) => ({
      period,
      gross: data.gross,
      net: data.net,
    }));
  }, [orders, grossSales, netEarnings, commissionPct]);

  // Category Distribution from real products
  const categoryDistributionData = useMemo(() => {
    if (products.length === 0) {
      return [{ name: 'No Products', count: 0 }];
    }
    const catMap = new Map<string, number>();
    products.forEach((p) => {
      const text = `${p.title} ${p.description}`.toLowerCase();
      let category = 'Curated Objects';
      if (text.includes('lamp') || text.includes('light') || text.includes('luminaire')) {
        category = 'Lighting';
      } else if (text.includes('ceramic') || text.includes('clay') || text.includes('vessel') || text.includes('tea')) {
        category = 'Ceramics';
      } else if (text.includes('table') || text.includes('console') || text.includes('travertine') || text.includes('marble')) {
        category = 'Furniture';
      } else if (text.includes('wood') || text.includes('bronze') || text.includes('casting')) {
        category = 'Sculpture';
      }
      catMap.set(category, (catMap.get(category) || 0) + 1);
    });

    return Array.from(catMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [products]);

  // Real Sub-Orders Fulfillment
  const handleFulfillmentToggle = async (orderId: string, currentStatus: string) => {
    const nextStatusMap: Record<string, string> = {
      pending: 'processing',
      processing: 'completed',
    };
    const nextStatus = nextStatusMap[currentStatus];
    if (!nextStatus) return;

    setUpdatingOrderId(orderId);
    try {
      await updateVendorOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((ord) => (ord.orderId === orderId ? { ...ord, status: nextStatus } : ord))
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update order fulfillment status.'
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Real Payouts Ledger calculated from real orders
  const payoutsLedger = useMemo(() => {
    const completedOrders = orders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');
    const grossCompleted = completedOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const completedFee = Math.round((grossCompleted * commissionPct) / 100);
    const netCompleted = grossCompleted - completedFee;

    const pendingOrders = orders.filter((o) => o.status !== 'completed' && o.paymentStatus !== 'paid');
    const grossPending = pendingOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const pendingFee = Math.round((grossPending * commissionPct) / 100);
    const netPending = grossPending - pendingFee;

    const entries = [];
    if (grossCompleted > 0 || completedOrders.length > 0) {
      entries.push({
        id: `PAY-${profile?.userId || 'VERIFIED'}-01`,
        period: 'Settled Disbursements',
        grossAmount: grossCompleted,
        commission: completedFee,
        netAmount: netCompleted,
        transferId: profile?.payoutAccountId ? `wire_${profile.payoutAccountId.slice(-6)}` : 'ACH-SETTLED',
        status: 'settled',
      });
    }

    if (grossPending > 0 || entries.length === 0) {
      entries.push({
        id: `ESCROW-${profile?.userId || 'ACTIVE'}`,
        period: 'Current Settlement Escrow',
        grossAmount: grossPending,
        commission: pendingFee,
        netAmount: netPending,
        transferId: profile?.payoutAccountId || 'Account Unlinked',
        status: 'escrow',
      });
    }

    return entries;
  }, [orders, commissionPct, profile?.userId, profile?.payoutAccountId]);

  const vendorStatus = profile?.status || 'verified';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      {/* Top Banner & Authenticated Atelier Header */}
      <div className="border border-neutral-200 bg-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[#9c784e]">
            <span className="w-2 h-2 bg-[#9c784e]" />
            <span>AUTHENTICATED ATELIER HUB • VENDOR ID #{profile?.userId || '—'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal text-neutral-900 tracking-tight">
            {profile?.storeName || 'Atelier Studio'}
          </h1>
          <p className="text-xs text-neutral-500 font-light flex flex-wrap items-center gap-3">
            <span>Slug: /{profile?.slug || 'store'}</span>
            <span>•</span>
            <span>Commission Rate: {commissionPct}%</span>
            <span>•</span>
            <span>Payout Account: {profile?.payoutAccountId || 'Pending configuration'}</span>
          </p>
        </div>

        {/* Right side controls: Status, Refresh & KYC Link */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-neutral-400 uppercase tracking-widest">KYC Status</span>
            <span
              className={`text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 ${
                vendorStatus === 'verified' || vendorStatus === 'approved'
                  ? 'text-emerald-700'
                  : vendorStatus === 'pending'
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}
            >
              {vendorStatus === 'verified' || vendorStatus === 'approved' ? (
                <CheckCircleIcon className="w-3.5 h-3.5" />
              ) : (
                <AlertCircleIcon className="w-3.5 h-3.5" />
              )}
              {vendorStatus}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboardData()}
            disabled={isLoading}
            className="p-2 border border-neutral-300 hover:border-black text-neutral-700 hover:text-black transition-colors cursor-pointer"
            title="Refresh Real Vendor Metrics"
            aria-label="Refresh Dashboard"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onNavigateToProfile}
            className="border border-black hover:bg-neutral-900 hover:text-white px-4 py-2 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors rounded-none cursor-pointer"
          >
            KYC & DOSSIER →
          </button>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="flex items-center justify-between gap-4 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => void loadDashboardData()}
            className="font-semibold uppercase tracking-wider underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            GROSS SUB-ORDER GMV
          </span>
          <p className="text-2xl font-normal text-neutral-900 tracking-tight">
            ${grossSales.toLocaleString()}
          </p>
          <span className="text-[10px] text-neutral-500 font-light block">
            Across {orders.length} recorded sub-orders
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            PLATFORM COMMISSION ({commissionPct}%)
          </span>
          <p className="text-2xl font-normal text-[#9c784e] tracking-tight">
            ${platformFee.toLocaleString()}
          </p>
          <span className="text-[10px] text-neutral-500 font-light block">
            Standard contractual deduction
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            NET EARNINGS ESCROW
          </span>
          <p className="text-2xl font-semibold text-neutral-900 tracking-tight">
            ${netEarnings.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-700 font-medium block">
            Accumulated for next payout cycle
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            LIVE CATALOG SPECIMENS
          </span>
          <p className="text-2xl font-normal text-neutral-900 tracking-tight">
            {products.length}{' '}
            <span className="text-xs text-neutral-500 font-normal">({totalStockUnits} units)</span>
          </p>
          <span className="text-[10px] text-neutral-500 font-light block">
            Managed in live inventory database
          </span>
        </div>
      </div>

      {/* Tabs Header Navigation */}
      <div className="flex border-b border-neutral-200 gap-2 sm:gap-6 text-xs font-semibold tracking-[0.18em] uppercase overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <BarChartIcon />
          <span>REVENUE & ANALYTICS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <PackageIcon />
          <span>INVENTORY & CATALOG</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fulfillment')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'fulfillment'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <TruckIcon />
          <span>SUB-ORDER FULFILLMENT ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'payouts'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <BanknoteIcon />
          <span>PAYOUTS LEDGER</span>
        </button>
      </div>

      {/* Tab 1: Analytics & Charts */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-900">
                  Revenue Trajectory & Net Payouts
                </h3>
                <p className="text-xs text-neutral-500 font-light">
                  Comparative analysis of Gross GMV vs. Net Bank Transfers post-commission deduction.
                </p>
              </div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
                USD ($)
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9c784e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#9c784e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeeeec" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e0e0de',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="gross"
                    stroke="#1a1a1a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#grossGradient)"
                    name="Gross GMV"
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#9c784e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#netGradient)"
                    name="Net Payout"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-900">
              Specimens by Category
            </h3>
            <p className="text-xs text-neutral-500 font-light">
              Live inventory distribution across product collections.
            </p>

            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e0e0de',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" fill="#2a2825" radius={[2, 2, 0, 0]} name="Specimens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Products & Inventory Management (Real API Driven) */}
      {activeTab === 'products' && (
        <div className="bg-white border border-neutral-200 p-6 sm:p-8 shadow-sm">
          <VendorProductManagement />
        </div>
      )}

      {/* Tab 3: Order Fulfillment */}
      {activeTab === 'fulfillment' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
                Vendor-Specific Sub-Orders
              </h2>
              <p className="text-xs text-neutral-500 font-light">
                Live customer orders dispatched specifically to {profile?.storeName || 'your atelier'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboardData()}
              disabled={isLoading}
              className="text-[10px] font-semibold tracking-wider uppercase border border-neutral-300 px-3 py-1.5 hover:border-black cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshIcon className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Orders</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-neutral-300 bg-white">
              <p className="text-xs uppercase tracking-widest text-neutral-400">
                No orders currently dispatched to this atelier.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((entry) => (
                <div
                  key={entry.orderId}
                  className="bg-white border border-neutral-200 p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-neutral-900">
                          Order {entry.orderId}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                            entry.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.status === 'processing'
                              ? 'bg-amber-100 text-amber-800'
                              : entry.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        Placed: {new Date(entry.createdAt).toLocaleString()} • Client #{entry.customerUserId}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-neutral-900">
                        ${entry.subtotal.toLocaleString()}
                      </span>

                      {entry.status !== 'completed' && entry.status !== 'cancelled' && (
                        <button
                          type="button"
                          disabled={updatingOrderId === entry.orderId}
                          onClick={() => handleFulfillmentToggle(entry.orderId, entry.status)}
                          className="bg-black hover:bg-neutral-800 text-white px-3.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer rounded-none disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {updatingOrderId === entry.orderId && <SpinnerIcon className="w-3 h-3 animate-spin" />}
                          <span>
                            Mark as {entry.status === 'pending' ? 'Processing' : 'Completed'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-order items list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-neutral-400 block mb-2">
                        DISPATCH SPECIMENS
                      </span>
                      <ul className="space-y-2">
                        {entry.items.map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-xs">
                            <div className="w-10 h-10 border border-neutral-200 bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center">
                              {item.image ? (
                                <img
                                  src={resolveProductImageUrl(item.image)}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[8px] text-neutral-400 uppercase font-mono">SPEC</span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-900">{item.title}</p>
                              <p className="text-[10px] text-neutral-500">
                                Qty: {item.quantity} • ${item.unitPrice.toLocaleString()} each (Line Total: ${item.lineTotal.toLocaleString()})
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="text-xs space-y-1 text-neutral-600 bg-[#f9f9f8] p-3 border border-neutral-200">
                      <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-neutral-400 block mb-1">
                        DELIVERY SANCTUARY
                      </span>
                      {entry.deliveryAddress ? (
                        <>
                          <p className="font-semibold text-neutral-900">{entry.deliveryAddress.recipientName}</p>
                          <p>{entry.deliveryAddress.addressLine1}</p>
                          {entry.deliveryAddress.addressLine2 && <p>{entry.deliveryAddress.addressLine2}</p>}
                          <p>
                            {entry.deliveryAddress.city}, {entry.deliveryAddress.state} {entry.deliveryAddress.postalCode}
                          </p>
                          <p>{entry.deliveryAddress.country}</p>
                          {entry.deliveryAddress.phone && (
                            <p className="text-[11px] text-neutral-500 pt-1 font-mono">
                              Tel: {entry.deliveryAddress.phone}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-neutral-400 italic">No delivery address recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Payouts Ledger */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
              Automated Payouts Ledger
            </h2>
            <p className="text-xs text-neutral-500 font-light">
              Auditable settlement disbursements associated with {profile?.payoutAccountId || 'your verified banking destination'}.
            </p>
          </div>

          <div className="bg-white border border-neutral-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-[#fbfbfa] text-[10px] font-bold tracking-[0.18em] uppercase text-neutral-600">
                  <th className="py-3 px-4">Cycle ID</th>
                  <th className="py-3 px-4">Settlement Cycle</th>
                  <th className="py-3 px-4">Gross Sales</th>
                  <th className="py-3 px-4">Fee ({commissionPct}%)</th>
                  <th className="py-3 px-4">Net Transfer</th>
                  <th className="py-3 px-4">Wire / Account Destination</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payoutsLedger.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-neutral-900">{p.id}</td>
                    <td className="py-3 px-4 text-neutral-500">{p.period}</td>
                    <td className="py-3 px-4 font-mono">${p.grossAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-neutral-400 font-mono">
                      -${p.commission.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-800 font-mono">
                      ${p.netAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">{p.transferId}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          p.status === 'settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDashboardView;
