import React, { useState, useEffect } from 'react';
import { useCustomer } from '../context/useCustomer';
import {
  createOrder,
  listAddresses,
  CustomerApiError,
  type CheckoutPayload,
} from '../services/customerApi';
import type { DeliveryAddressSnapshot, SavedAddress } from '../types/customer';
import {
  TrashIcon,
  ShieldLockIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SpinnerIcon,
  AtelierLogoGlyph,
} from '../components/ui/Icons';

export interface CartCheckoutViewProps {
  onNavigateToCatalog: () => void;
  onNavigateToAuth: () => void;
  onNavigateToOrder: (orderId: string) => void;
}

export const CartCheckoutView: React.FC<CartCheckoutViewProps> = ({
  onNavigateToCatalog,
  onNavigateToAuth,
  onNavigateToOrder,
}) => {
  const {
    isCustomerAuthenticated,
    cart,
    isCartLoading,
    cartError,
    refreshCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    logoutCustomer,
  } = useCustomer();

  // Address mode: 'saved' or 'inline'
  const [addressMode, setAddressMode] = useState<'saved' | 'inline'>('saved');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Inline address form
  const [inlineAddress, setInlineAddress] = useState<DeliveryAddressSnapshot>({
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<{ productId: string; reason: string }[] | null>(null);

  // Load saved addresses for authenticated customer
  useEffect(() => {
    if (!isCustomerAuthenticated) {
      setSavedAddresses([]);
      setSelectedAddressId('');
      return;
    }
    let isMounted = true;
    setIsLoadingAddresses(true);

    listAddresses()
      .then((addresses) => {
        if (!isMounted) return;
        setSavedAddresses(addresses);
        setIsLoadingAddresses(false);
        const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.addressId);
          setAddressMode('saved');
        } else {
          setAddressMode('inline');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoadingAddresses(false);
        setAddressMode('inline');
        if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
          logoutCustomer();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isCustomerAuthenticated, logoutCustomer]);

  if (!isCustomerAuthenticated) {
    return (
      <div className="w-full max-w-2xl mx-auto my-16 px-4">
        <div className="bg-white border border-neutral-200 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          <div className="w-12 h-12 mx-auto border border-neutral-300 flex items-center justify-center p-2.5">
            <ShieldLockIcon className="w-6 h-6 text-neutral-800" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
              SECURE CLIENT BAG
            </span>
            <h1 className="text-2xl sm:text-3xl font-normal text-neutral-900 tracking-tight">
              Sign In to View Your Cart
            </h1>
            <p className="text-xs text-neutral-500 font-light max-w-md mx-auto">
              Your cart is persisted securely to your customer account on the marketplace service.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNavigateToAuth}
              className="w-full sm:w-auto px-8 py-3 bg-black text-white text-xs font-semibold tracking-[0.18em] uppercase hover:bg-neutral-800 cursor-pointer"
            >
              Sign In with OTP
            </button>
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="w-full sm:w-auto px-8 py-3 border border-neutral-300 text-neutral-800 text-xs font-semibold tracking-[0.18em] uppercase hover:border-black cursor-pointer"
            >
              Browse Catalogue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const items = cart?.items || [];
  const hasUnavailableItems = items.some((item) => !item.available);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlacingOrder || items.length === 0 || hasUnavailableItems) return;

    setIsPlacingOrder(true);
    setCheckoutError(null);
    setStockIssues(null);

    let payload: CheckoutPayload;

    if (addressMode === 'saved') {
      const targetId = selectedAddressId || savedAddresses[0]?.addressId;
      if (!targetId) {
        setCheckoutError('Please select a saved delivery address or enter an address inline.');
        setIsPlacingOrder(false);
        return;
      }
      payload = { savedAddressId: targetId };
    } else {
      // Validate inline address
      const { recipientName, phone, addressLine1, city, state, postalCode, country } = inlineAddress;
      if (
        !recipientName.trim() ||
        !phone.trim() ||
        !addressLine1.trim() ||
        !city.trim() ||
        !state.trim() ||
        !postalCode.trim() ||
        !country.trim()
      ) {
        setCheckoutError('Please complete all required delivery address fields.');
        setIsPlacingOrder(false);
        return;
      }
      payload = {
        deliveryAddress: {
          recipientName: recipientName.trim().slice(0, 100),
          phone: phone.trim().slice(0, 30),
          addressLine1: addressLine1.trim().slice(0, 200),
          ...(inlineAddress.addressLine2?.trim()
            ? { addressLine2: inlineAddress.addressLine2.trim().slice(0, 200) }
            : {}),
          city: city.trim().slice(0, 100),
          state: state.trim().slice(0, 100),
          postalCode: postalCode.trim().slice(0, 20),
          country: country.trim().slice(0, 100),
        },
      };
    }

    try {
      const order = await createOrder(payload);
      await refreshCart();
      onNavigateToOrder(order.orderId);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else if (err.statusCode === 503) {
          setCheckoutError(
            'Checkout is temporarily unavailable on the server (MongoDB transaction support required). No order was created and your cart was preserved.'
          );
        } else if (err.statusCode === 409) {
          setCheckoutError(err.message || 'Cart cannot be checked out due to inventory changes.');
          if (Array.isArray(err.details)) {
            setStockIssues(err.details as { productId: string; reason: string }[]);
          }
          void refreshCart();
        } else {
          setCheckoutError(err.message || 'Order could not be processed.');
        }
      } else if (err instanceof Error) {
        setCheckoutError(err.message);
      } else {
        setCheckoutError('Checkout failed.');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
          <span className="w-2 h-2 bg-[#9c784e]" aria-hidden="true" />
          <span>AUTHORITATIVE SERVER-BACKED SHOPPING BAG</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-neutral-900">
          Shopping Cart & Checkout
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 max-w-2xl font-light">
          Cart inventory and totals are authoritative from the vendor service in USD.
        </p>
      </div>

      {cartError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
          <span>{cartError}</span>
          <button
            type="button"
            onClick={() => void refreshCart()}
            className="text-[10px] font-bold uppercase underline tracking-wider cursor-pointer ml-4"
          >
            Retry Cart
          </button>
        </div>
      )}

      {isCartLoading && !cart ? (
        <div className="py-24 text-center space-y-3">
          <SpinnerIcon className="w-6 h-6 animate-spin text-neutral-800 mx-auto" />
          <p className="text-xs uppercase tracking-widest text-neutral-400">Loading Shopping Cart...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-neutral-300 bg-[#fafaf8] space-y-4">
          <AtelierLogoGlyph className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-xs uppercase tracking-widest text-neutral-400">
            Your client dossier contains no acquisitions.
          </p>
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="bg-black text-white px-6 py-2.5 text-xs font-semibold tracking-[0.16em] uppercase hover:bg-neutral-800 cursor-pointer rounded-none"
          >
            EXPLORE CATALOGUE
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Cart Items */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <span className="text-xs font-bold tracking-[0.18em] uppercase text-neutral-800">
                ACTIVE ACQUISITIONS ({items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'})
              </span>
              <button
                type="button"
                onClick={() => clearCart()}
                className="text-[11px] text-neutral-500 hover:text-red-700 underline cursor-pointer uppercase tracking-wider"
              >
                Clear Cart
              </button>
            </div>

            {hasUnavailableItems && (
              <div className="p-4 bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                <span className="font-bold">Attention:</span>
                <p>
                  Some items in your cart are no longer available or have insufficient stock. Please remove or adjust them before checking out.
                </p>
              </div>
            )}

            <ul className="divide-y divide-neutral-200 border-b border-neutral-200 bg-white">
              {items.map((item) => (
                <li key={item.productId} className="py-5 px-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="space-y-1 max-w-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[#9c784e]">
                        {item.storeName || 'ATELIER'}
                      </span>
                      {!item.available && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold uppercase tracking-wider">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-normal text-neutral-900">{item.title}</h3>
                    <p className="text-xs text-neutral-500 font-mono">
                      ${(item.currentPrice ?? 0).toFixed(2)} USD each
                    </p>
                    {item.currentStock < item.quantity && (
                      <p className="text-[10px] text-red-600 font-semibold">
                        Stock remaining: {item.currentStock} unit(s)
                      </p>
                    )}
                  </div>

                  {/* Quantity & Removal Controls */}
                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="flex items-center border border-neutral-300 bg-[#fbfbfa]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                        className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-semibold text-neutral-900">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                        className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-xs font-semibold text-neutral-900 min-w-16 text-right">
                      ${item.itemTotal.toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                      aria-label="Remove item"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="text-xs font-semibold tracking-wider uppercase text-neutral-700 underline hover:text-black cursor-pointer"
              >
                ← Continue Shopping
              </button>
              <div className="text-right">
                <span className="text-xs text-neutral-500 uppercase tracking-wider block">Server Calculated Total</span>
                <span className="text-xl font-normal text-neutral-900">
                  ${(cart?.total ?? 0).toFixed(2)} <span className="text-xs text-neutral-500">USD</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Form */}
          <div className="lg:col-span-5 bg-white border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-1 pb-4 border-b border-neutral-200">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9c784e]">
                DELIVERY DESTINATION
              </span>
              <h2 className="text-lg font-normal text-neutral-900 tracking-tight">Checkout Dossier</h2>
            </div>

            {/* Address Mode Selector */}
            {savedAddresses.length > 0 && (
              <div className="flex border border-neutral-200 text-xs">
                <button
                  type="button"
                  onClick={() => setAddressMode('saved')}
                  className={`flex-1 py-2 font-semibold tracking-wider uppercase cursor-pointer ${
                    addressMode === 'saved' ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Saved Address ({savedAddresses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAddressMode('inline')}
                  className={`flex-1 py-2 font-semibold tracking-wider uppercase cursor-pointer ${
                    addressMode === 'inline' ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Enter Address Inline
                </button>
              </div>
            )}

            <form onSubmit={handleCheckout} className="space-y-4">
              {addressMode === 'saved' && savedAddresses.length > 0 ? (
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-neutral-700">
                    Select Saved Address
                  </label>
                  {isLoadingAddresses ? (
                    <div className="text-xs text-neutral-400">Loading saved addresses...</div>
                  ) : (
                    <div className="space-y-2">
                      {savedAddresses.map((addr) => (
                        <label
                          key={addr.addressId}
                          className={`flex items-start gap-3 p-3 border text-xs cursor-pointer transition-colors ${
                            selectedAddressId === addr.addressId
                              ? 'border-black bg-neutral-50'
                              : 'border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedAddress"
                            value={addr.addressId}
                            checked={selectedAddressId === addr.addressId}
                            onChange={() => setSelectedAddressId(addr.addressId)}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-neutral-900">{addr.recipientName}</span>
                              {addr.label && (
                                <span className="text-[9px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 uppercase font-bold tracking-wider">
                                  {addr.label}
                                </span>
                              )}
                              {addr.isDefault && (
                                <span className="text-[9px] bg-neutral-900 text-white px-1.5 py-0.2 uppercase font-bold tracking-wider">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-neutral-600 text-[11px]">
                              {addr.addressLine1}
                              {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city}, {addr.state}{' '}
                              {addr.postalCode}, {addr.country}
                            </p>
                            <p className="text-neutral-400 text-[10px]">Phone: {addr.phone}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="inline-recipient" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                      Recipient Full Name *
                    </label>
                    <input
                      id="inline-recipient"
                      type="text"
                      required
                      maxLength={100}
                      value={inlineAddress.recipientName}
                      onChange={(e) => setInlineAddress({ ...inlineAddress, recipientName: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="inline-phone" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                      Contact Phone *
                    </label>
                    <input
                      id="inline-phone"
                      type="tel"
                      required
                      maxLength={30}
                      value={inlineAddress.phone}
                      onChange={(e) => setInlineAddress({ ...inlineAddress, phone: e.target.value })}
                      placeholder="+1 555-0199"
                      className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="inline-line1" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                      Address Line 1 *
                    </label>
                    <input
                      id="inline-line1"
                      type="text"
                      required
                      maxLength={200}
                      value={inlineAddress.addressLine1}
                      onChange={(e) => setInlineAddress({ ...inlineAddress, addressLine1: e.target.value })}
                      placeholder="Street name and number"
                      className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="inline-line2" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                      Address Line 2 <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="inline-line2"
                      type="text"
                      maxLength={200}
                      value={inlineAddress.addressLine2 || ''}
                      onChange={(e) => setInlineAddress({ ...inlineAddress, addressLine2: e.target.value })}
                      placeholder="Suite, apartment, unit"
                      className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="inline-city" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                        City *
                      </label>
                      <input
                        id="inline-city"
                        type="text"
                        required
                        maxLength={100}
                        value={inlineAddress.city}
                        onChange={(e) => setInlineAddress({ ...inlineAddress, city: e.target.value })}
                        placeholder="City"
                        className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="inline-state" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                        State / Province *
                      </label>
                      <input
                        id="inline-state"
                        type="text"
                        required
                        maxLength={100}
                        value={inlineAddress.state}
                        onChange={(e) => setInlineAddress({ ...inlineAddress, state: e.target.value })}
                        placeholder="State"
                        className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="inline-postal" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                        Postal Code *
                      </label>
                      <input
                        id="inline-postal"
                        type="text"
                        required
                        maxLength={20}
                        value={inlineAddress.postalCode}
                        onChange={(e) => setInlineAddress({ ...inlineAddress, postalCode: e.target.value })}
                        placeholder="Postal Code"
                        className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="inline-country" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                        Country *
                      </label>
                      <input
                        id="inline-country"
                        type="text"
                        required
                        maxLength={100}
                        value={inlineAddress.country}
                        onChange={(e) => setInlineAddress({ ...inlineAddress, country: e.target.value })}
                        placeholder="Country"
                        className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 rounded-none focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Notice */}
              <div className="p-3 bg-[#fafaf8] border border-neutral-200 text-xs text-neutral-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-neutral-900 text-[10px]">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-neutral-700" />
                  <span>PAYMENT GATEWAY NOTICE</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Real payment gateway integration is pending in this release. Orders are submitted with status{' '}
                  <strong className="text-neutral-900">pending</strong> and payment status{' '}
                  <strong className="text-neutral-900">pending</strong>. No payment card is charged.
                </p>
              </div>

              {checkoutError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
                  <p className="font-semibold">{checkoutError}</p>
                  {stockIssues && stockIssues.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      {stockIssues.map((issue, idx) => (
                        <li key={idx}>
                          Product {issue.productId}: {issue.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isPlacingOrder || items.length === 0 || hasUnavailableItems}
                className="w-full bg-black text-white py-3.5 text-xs font-semibold tracking-[0.18em] uppercase hover:bg-neutral-800 transition-colors disabled:bg-neutral-300 cursor-pointer flex items-center justify-center gap-2 rounded-none"
              >
                {isPlacingOrder ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    <span>CHECKING OUT & DECREMENTING STOCK...</span>
                  </>
                ) : (
                  <>
                    <span>SUBMIT ORDER (${(cart?.total ?? 0).toFixed(2)} USD)</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartCheckoutView;
