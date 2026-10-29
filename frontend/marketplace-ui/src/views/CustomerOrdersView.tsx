import React, { useState, useEffect, useCallback } from 'react';
import { useCustomer } from '../context/useCustomer';
import {
  listOrders,
  getOrder,
  cancelOrder,
  CustomerApiError,
} from '../services/customerApi';
import type { CustomerOrder, CustomerOrderSummary } from '../types/customer';
import {
  SpinnerIcon,
  AtelierLogoGlyph,
  XIcon,
} from '../components/ui/Icons';

export interface CustomerOrdersViewProps {
  initialOrderId?: string | null;
  onNavigateToCatalog: () => void;
  onNavigateToAuth: () => void;
}

export const CustomerOrdersView: React.FC<CustomerOrdersViewProps> = ({
  initialOrderId,
  onNavigateToCatalog,
  onNavigateToAuth,
}) => {
  const { isCustomerAuthenticated, customerUser, logoutCustomer } = useCustomer();

  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Order Detail Modal / Panel
  const [activeOrder, setActiveOrder] = useState<CustomerOrder | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrderList = useCallback(async (targetPage: number) => {
    if (!isCustomerAuthenticated) {
      setOrders([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await listOrders(targetPage, pageSize);
      setOrders(res.items);
      setPage(res.page);
      setTotalPages(res.totalPages || 1);
      setTotalItems(res.totalItems);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Failed to load order history.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isCustomerAuthenticated, pageSize, logoutCustomer, onNavigateToAuth]);

  const viewOrderDetail = useCallback(async (orderId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const data = await getOrder(orderId);
      setActiveOrder(data);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else {
          setDetailError(err.message);
        }
      } else {
        setDetailError('Failed to fetch order specification.');
      }
    } finally {
      setIsLoadingDetail(false);
    }
  }, [logoutCustomer, onNavigateToAuth]);

  // Account switching / session isolation effect
  useEffect(() => {
    if (!isCustomerAuthenticated) {
      setOrders([]);
      setActiveOrder(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    listOrders(page, pageSize)
      .then((res) => {
        if (isMounted) {
          setOrders(res.items);
          setPage(res.page);
          setTotalPages(res.totalPages || 1);
          setTotalItems(res.totalItems);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
            logoutCustomer();
            onNavigateToAuth();
          } else {
            setErrorMessage(err instanceof Error ? err.message : 'Failed to load order history.');
          }
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isCustomerAuthenticated, customerUser?.userId, page, pageSize, logoutCustomer, onNavigateToAuth]);

  // Load initial order ID if passed from checkout
  useEffect(() => {
    if (!initialOrderId || !isCustomerAuthenticated) return;
    let isMounted = true;
    getOrder(initialOrderId)
      .then((data) => {
        if (isMounted) setActiveOrder(data);
      })
      .catch((err) => {
        if (isMounted) setDetailError(err instanceof Error ? err.message : 'Failed to fetch order.');
      });
    return () => {
      isMounted = false;
    };
  }, [initialOrderId, isCustomerAuthenticated]);

  // Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeOrder) {
        setActiveOrder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOrder]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order and restore its inventory?')) {
      return;
    }

    setIsCancelling(true);
    setDetailError(null);
    try {
      const updated = await cancelOrder(orderId);
      setActiveOrder(updated);
      void fetchOrderList(page);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        setDetailError(err.message || 'Unable to cancel order.');
      } else {
        setDetailError('Order cancellation failed.');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isCustomerAuthenticated) {
    return (
      <div className="w-full max-w-2xl mx-auto my-16 px-4">
        <div className="bg-white border border-neutral-200 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          <AtelierLogoGlyph className="w-10 h-10 text-neutral-800 mx-auto" />
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
              CLIENT ORDER ARCHIVE
            </span>
            <h1 className="text-2xl sm:text-3xl font-normal text-neutral-900 tracking-tight">
              Sign In to View Orders
            </h1>
            <p className="text-xs text-neutral-500 font-light max-w-md mx-auto">
              Authenticate with your customer email to inspect historical orders and live order statuses.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToAuth}
            className="px-8 py-3 bg-black text-white text-xs font-semibold tracking-[0.18em] uppercase hover:bg-neutral-800 cursor-pointer"
          >
            Sign In with OTP
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-neutral-200 text-neutral-700 border-neutral-300';
      case 'pending':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
          <span className="w-2 h-2 bg-[#9c784e]" aria-hidden="true" />
          <span>ORDER ARCHIVES & TRANSACTION RECORDS</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-neutral-900">
              Acquisition History
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-xl font-light">
              Authoritative multi-vendor orders created with atomic inventory decrement.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="text-xs font-semibold tracking-wider uppercase text-neutral-800 underline hover:text-black cursor-pointer"
          >
            Browse Catalogue →
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-xs text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="py-24 text-center space-y-3">
          <SpinnerIcon className="w-6 h-6 animate-spin text-neutral-800 mx-auto" />
          <p className="text-xs uppercase tracking-widest text-neutral-400">Loading Order Records...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-neutral-300 bg-[#fafaf8] space-y-4">
          <AtelierLogoGlyph className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-xs uppercase tracking-widest text-neutral-400">
            No historical acquisitions found for your account.
          </p>
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="bg-black text-white px-6 py-2.5 text-xs font-semibold tracking-[0.16em] uppercase hover:bg-neutral-800 cursor-pointer rounded-none"
          >
            ACQUIRE ARTIFACTS
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-neutral-600 pb-2 border-b border-neutral-200">
            TOTAL ORDERS: {totalItems}
          </div>

          <div className="overflow-x-auto bg-white border border-neutral-200 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbfbfa] border-b border-neutral-200 text-neutral-500 font-semibold tracking-wider uppercase text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Order Reference</th>
                  <th className="py-3.5 px-4">Date Placed</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Total (USD)</th>
                  <th className="py-3.5 px-4">Fulfillment Status</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((ord) => (
                  <tr key={ord.orderId} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-4 px-4 font-mono font-medium text-neutral-900">{ord.orderId}</td>
                    <td className="py-4 px-4 text-neutral-600">
                      {new Date(ord.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-4 text-neutral-700">
                      {ord.itemCount} {ord.itemCount === 1 ? 'item' : 'items'}
                    </td>
                    <td className="py-4 px-4 font-semibold text-neutral-900">${ord.total.toFixed(2)}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase border ${getStatusBadge(
                          ord.status
                        )}`}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => viewOrderDetail(ord.orderId)}
                        className="px-3 py-1.5 bg-neutral-900 text-white text-[10px] font-semibold tracking-wider uppercase hover:bg-neutral-700 cursor-pointer"
                      >
                        Inspect Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4 text-xs font-semibold tracking-widest uppercase">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 border border-neutral-300 hover:border-black disabled:border-neutral-200 disabled:text-neutral-300 cursor-pointer"
              >
                ← PREVIOUS
              </button>
              <span className="text-neutral-500">
                PAGE {page} OF {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 border border-neutral-300 hover:border-black disabled:border-neutral-200 disabled:text-neutral-300 cursor-pointer"
              >
                NEXT →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {activeOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-dossier-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        >
          <div className="relative bg-white w-full max-w-3xl border border-neutral-300 shadow-2xl p-6 sm:p-8 space-y-6">
            <button
              type="button"
              onClick={() => setActiveOrder(null)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 text-neutral-400 hover:text-black p-1 cursor-pointer transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>

            {isLoadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500">
                <SpinnerIcon className="w-6 h-6 animate-spin text-neutral-800" />
                <span className="text-xs tracking-widest uppercase">Fetching Order Record...</span>
              </div>
            ) : detailError ? (
              <div className="py-12 text-center space-y-4">
                <p className="text-sm text-red-600">{detailError}</p>
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="px-6 py-2 bg-neutral-900 text-white text-xs font-semibold tracking-wider uppercase cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : activeOrder ? (
              <div className="space-y-6">
                {/* Order Top Banner */}
                <div className="pb-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9c784e]">
                      ORDER DOSSIER SPECIFICATION
                    </span>
                    <h2 id="order-dossier-title" className="text-xl font-normal text-neutral-900 tracking-tight">
                      Order Reference {activeOrder.orderId}
                    </h2>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      Created: {new Date(activeOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase border ${getStatusBadge(
                        activeOrder.status
                      )}`}
                    >
                      {activeOrder.status}
                    </span>
                    <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase bg-neutral-100 text-neutral-800 border border-neutral-200">
                      Payment: {activeOrder.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Vendor Subgroups & Items */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-neutral-500 block">
                    SPLIT ATELIER FULFILLMENT GROUPS ({activeOrder.vendorGroups.length})
                  </span>

                  {activeOrder.vendorGroups.map((group) => {
                    const groupItems = activeOrder.items.filter((item) => item.vendorId === group.vendorId);
                    return (
                      <div key={group.vendorId} className="p-4 bg-[#fbfbfa] border border-neutral-200 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-200 text-xs">
                          <span className="font-bold tracking-wider uppercase text-neutral-900">
                            {group.storeName} (Vendor ID: {group.vendorId})
                          </span>
                          <span className="text-neutral-500">
                            Subtotal: <strong className="text-neutral-900">${group.subtotal.toFixed(2)} USD</strong>
                          </span>
                        </div>
                        <ul className="divide-y divide-neutral-100">
                          {groupItems.map((item, idx) => (
                            <li key={idx} className="py-2 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-medium text-neutral-900">{item.title}</span>
                                <span className="text-neutral-400 font-mono ml-2">ID: {item.productId.slice(-6)}</span>
                              </div>
                              <div className="text-neutral-600">
                                <span>
                                  {item.quantity} × ${item.unitPrice.toFixed(2)} ={' '}
                                </span>
                                <strong className="text-neutral-900">${item.lineTotal.toFixed(2)}</strong>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                {/* Delivery Address Snapshot & Order Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-neutral-200 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500 block">
                      DELIVERY ADDRESS SNAPSHOT
                    </span>
                    <p className="font-semibold text-neutral-900">{activeOrder.deliveryAddress.recipientName}</p>
                    <p className="text-neutral-600">
                      {activeOrder.deliveryAddress.addressLine1}
                      {activeOrder.deliveryAddress.addressLine2 ? `, ${activeOrder.deliveryAddress.addressLine2}` : ''}
                    </p>
                    <p className="text-neutral-600">
                      {activeOrder.deliveryAddress.city}, {activeOrder.deliveryAddress.state}{' '}
                      {activeOrder.deliveryAddress.postalCode}, {activeOrder.deliveryAddress.country}
                    </p>
                    <p className="text-neutral-400 text-[11px]">Phone: {activeOrder.deliveryAddress.phone}</p>
                  </div>

                  <div className="space-y-2 text-right">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500 block">
                      TOTAL SUMMARY
                    </span>
                    <div className="flex justify-between sm:justify-end gap-6 text-neutral-600">
                      <span>Subtotal:</span>
                      <span>${activeOrder.subtotal.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between sm:justify-end gap-6 text-sm font-semibold text-neutral-900 pt-1 border-t border-neutral-200">
                      <span>Total:</span>
                      <span>${activeOrder.total.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>

                {/* Action Area: Cancel Order if permitted */}
                <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveOrder(null)}
                    className="px-5 py-2 border border-neutral-300 text-neutral-700 text-xs font-semibold tracking-wider uppercase hover:border-black cursor-pointer"
                  >
                    Close Dossier
                  </button>

                  {activeOrder.status === 'pending' && activeOrder.paymentStatus === 'pending' && (
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => handleCancelOrder(activeOrder.orderId)}
                      className="px-5 py-2 bg-red-700 text-white text-xs font-semibold tracking-wider uppercase hover:bg-red-800 disabled:bg-neutral-400 cursor-pointer flex items-center gap-2"
                    >
                      {isCancelling ? (
                        <>
                          <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                          <span>RESTORING INVENTORY...</span>
                        </>
                      ) : (
                        <span>CANCEL ORDER</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersView;
