import React, { useState, useEffect, useCallback } from 'react';
import { useCustomer } from '../context/useCustomer';
import {
  updateCustomerProfile,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  CustomerApiError,
} from '../services/customerApi';
import type { AddressInput, SavedAddress } from '../types/customer';
import {
  SpinnerIcon,
  TrashIcon,
  AtelierLogoGlyph,
  ShieldLockIcon,
} from '../components/ui/Icons';

export interface CustomerProfileViewProps {
  onNavigateToAuth: () => void;
  onNavigateToOrders: () => void;
  onNavigateToCatalog: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  onNavigateToAuth,
  onNavigateToOrders,
  onNavigateToCatalog,
}) => {
  const {
    isCustomerAuthenticated,
    customerProfile,
    customerUser,
    refreshProfile,
    logoutCustomer,
  } = useCustomer();

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [prevProfileName, setPrevProfileName] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Sync initial display name during render if profile updates
  if (customerProfile?.displayName && customerProfile.displayName !== prevProfileName) {
    setPrevProfileName(customerProfile.displayName);
    setDisplayName(customerProfile.displayName);
  }

  // Addresses State
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [addressMsg, setAddressMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Address Modal / Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressInput>({
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    label: '',
    isDefault: false,
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!isCustomerAuthenticated) {
      setAddresses([]);
      return;
    }
    try {
      const list = await listAddresses();
      setAddresses(list);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else {
          setAddressMsg({ text: err.message, error: true });
        }
      } else {
        setAddressMsg({ text: 'Unable to load saved addresses.', error: true });
      }
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [isCustomerAuthenticated, logoutCustomer, onNavigateToAuth]);

  useEffect(() => {
    if (!isCustomerAuthenticated) {
      setAddresses([]);
      setIsLoadingAddresses(false);
      return;
    }
    let isMounted = true;
    setIsLoadingAddresses(true);

    listAddresses()
      .then((list) => {
        if (isMounted) {
          setAddresses(list);
          setIsLoadingAddresses(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof CustomerApiError && (err.statusCode === 401 || err.statusCode === 403)) {
            logoutCustomer();
            onNavigateToAuth();
          } else {
            setAddressMsg({
              text: err instanceof Error ? err.message : 'Unable to load saved addresses.',
              error: true,
            });
          }
          setIsLoadingAddresses(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [isCustomerAuthenticated, customerUser?.userId, logoutCustomer, onNavigateToAuth]);

  // Escape key listener for address form modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFormOpen) {
        setIsFormOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setProfileMsg({ text: 'Display name cannot be empty.', error: true });
      return;
    }

    setIsUpdatingProfile(true);
    setProfileMsg(null);
    try {
      await updateCustomerProfile(displayName.trim().slice(0, 120));
      await refreshProfile();
      setProfileMsg({ text: 'Client dossier updated successfully.', error: false });
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else {
          setProfileMsg({ text: err.message, error: true });
        }
      } else {
        setProfileMsg({ text: 'Failed to update profile.', error: true });
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleOpenAddForm = () => {
    setEditingAddressId(null);
    setFormData({
      recipientName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      label: '',
      isDefault: addresses.length === 0,
    });
    setAddressMsg(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (addr: SavedAddress) => {
    setEditingAddressId(addr.addressId);
    setFormData({
      recipientName: addr.recipientName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      label: addr.label || '',
      isDefault: addr.isDefault,
    });
    setAddressMsg(null);
    setIsFormOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAddress(true);
    setAddressMsg(null);

    const payload: AddressInput = {
      recipientName: formData.recipientName.trim().slice(0, 100),
      phone: formData.phone.trim().slice(0, 30),
      addressLine1: formData.addressLine1.trim().slice(0, 200),
      ...(formData.addressLine2?.trim() ? { addressLine2: formData.addressLine2.trim().slice(0, 200) } : {}),
      city: formData.city.trim().slice(0, 100),
      state: formData.state.trim().slice(0, 100),
      postalCode: formData.postalCode.trim().slice(0, 20),
      country: formData.country.trim().slice(0, 100),
      ...(formData.label?.trim() ? { label: formData.label.trim().slice(0, 50) } : {}),
      isDefault: formData.isDefault,
    };

    try {
      if (editingAddressId) {
        await updateAddress(editingAddressId, payload);
        setAddressMsg({ text: 'Address dossier modified.', error: false });
      } else {
        await addAddress(payload);
        setAddressMsg({ text: 'New address registered.', error: false });
      }
      setIsFormOpen(false);
      void fetchAddresses();
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else {
          setAddressMsg({ text: err.message, error: true });
        }
      } else {
        setAddressMsg({ text: 'Operation failed.', error: true });
      }
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to remove this delivery destination?')) {
      return;
    }
    setAddressMsg(null);
    try {
      await deleteAddress(addressId);
      setAddressMsg({ text: 'Address removed.', error: false });
      void fetchAddresses();
    } catch (err) {
      if (err instanceof CustomerApiError) {
        setAddressMsg({ text: err.message, error: true });
      } else {
        setAddressMsg({ text: 'Unable to remove address.', error: true });
      }
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setAddressMsg(null);
    try {
      await setDefaultAddress(addressId);
      setAddressMsg({ text: 'Default destination updated.', error: false });
      void fetchAddresses();
    } catch (err) {
      if (err instanceof CustomerApiError) {
        setAddressMsg({ text: err.message, error: true });
      } else {
        setAddressMsg({ text: 'Failed to update default address.', error: true });
      }
    }
  };

  if (!isCustomerAuthenticated) {
    return (
      <div className="w-full max-w-2xl mx-auto my-16 px-4">
        <div className="bg-white border border-neutral-200 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          <ShieldLockIcon className="w-8 h-8 text-neutral-800 mx-auto" />
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
              CLIENT PROFILE DOSSIER
            </span>
            <h1 className="text-2xl sm:text-3xl font-normal text-neutral-900 tracking-tight">
              Customer Authentication Required
            </h1>
            <p className="text-xs text-neutral-500 font-light max-w-md mx-auto">
              Please authenticate with your email OTP to access your customer profile and saved delivery addresses.
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

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
          <span className="w-2 h-2 bg-[#9c784e]" aria-hidden="true" />
          <span>CLIENT IDENTITY & ADDRESS ARCHIVE</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-neutral-900">
              Customer Dossier
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-lg font-light">
              Manage your personal client identity and delivery destinations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="px-4 py-2 border border-neutral-300 text-xs font-semibold tracking-wider uppercase text-neutral-800 hover:border-black cursor-pointer"
            >
              Catalogue
            </button>
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="px-4 py-2 border border-neutral-300 text-xs font-semibold tracking-wider uppercase text-neutral-800 hover:border-black cursor-pointer"
            >
              Order Records →
            </button>
            <button
              type="button"
              onClick={logoutCustomer}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Left Column: Identity Form */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 p-6 space-y-5 shadow-sm">
            <div className="space-y-1 pb-3 border-b border-neutral-200">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#9c784e]">
                IDENTITY SPECIFICATION
              </span>
              <h2 className="text-base font-normal text-neutral-900">Personal Details</h2>
            </div>

            {profileMsg && (
              <div
                className={`p-3 text-xs ${
                  profileMsg.error
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  User ID (Immutable)
                </label>
                <div className="bg-neutral-100 border border-neutral-200 px-3 py-2 text-neutral-600 font-mono">
                  {customerUser?.userId}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  Registered Email (Verified)
                </label>
                <div className="bg-neutral-100 border border-neutral-200 px-3 py-2 text-neutral-600 font-mono">
                  {customerUser?.email}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="display-name" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                  Client Display Name
                </label>
                <input
                  id="display-name"
                  type="text"
                  maxLength={120}
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-black rounded-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="w-full bg-black text-white py-2.5 text-xs font-semibold tracking-[0.16em] uppercase hover:bg-neutral-800 disabled:bg-neutral-300 cursor-pointer flex items-center justify-center gap-2 rounded-none"
              >
                {isUpdatingProfile ? (
                  <>
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    <span>SAVING...</span>
                  </>
                ) : (
                  <span>UPDATE IDENTITY</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Address Book */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#9c784e] block">
                DESTINATION ARCHIVE
              </span>
              <h2 className="text-base font-normal text-neutral-900">
                Saved Delivery Addresses ({addresses.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="px-4 py-2 bg-black text-white text-xs font-semibold tracking-wider uppercase hover:bg-neutral-800 cursor-pointer"
            >
              + Add Address
            </button>
          </div>

          {addressMsg && (
            <div
              className={`p-3 text-xs ${
                addressMsg.error
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {addressMsg.text}
            </div>
          )}

          {isLoadingAddresses ? (
            <div className="py-16 text-center space-y-2">
              <SpinnerIcon className="w-5 h-5 animate-spin text-neutral-800 mx-auto" />
              <p className="text-xs uppercase tracking-widest text-neutral-400">Loading Destinations...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-neutral-300 bg-[#fafaf8] space-y-3">
              <AtelierLogoGlyph className="w-6 h-6 text-neutral-300 mx-auto" />
              <p className="text-xs uppercase tracking-widest text-neutral-400">
                No delivery addresses registered yet.
              </p>
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="px-5 py-2 border border-neutral-400 text-xs font-semibold tracking-wider uppercase hover:border-black cursor-pointer"
              >
                Register First Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.addressId}
                  className={`p-5 bg-white border transition-colors space-y-3 shadow-xs ${
                    addr.isDefault ? 'border-neutral-900 ring-1 ring-neutral-900/10' : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-neutral-900">{addr.recipientName}</span>
                      {addr.label && (
                        <span className="text-[9px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 uppercase font-bold tracking-wider">
                          {addr.label}
                        </span>
                      )}
                    </div>
                    {addr.isDefault && (
                      <span className="text-[9px] bg-neutral-900 text-white px-2 py-0.5 uppercase font-bold tracking-wider">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-neutral-600 space-y-0.5">
                    <p>
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                    </p>
                    <p>
                      {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                    </p>
                    <p className="text-neutral-400 text-[11px]">Phone: {addr.phone}</p>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(addr)}
                        className="text-neutral-700 hover:text-black underline cursor-pointer"
                      >
                        Edit
                      </button>
                      {!addr.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(addr.addressId)}
                          className="text-neutral-700 hover:text-black underline cursor-pointer"
                        >
                          Make Default
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.addressId)}
                      className="text-neutral-400 hover:text-red-700 p-1 cursor-pointer transition-colors"
                      aria-label="Delete address"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address Form Modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        >
          <div className="relative bg-white w-full max-w-lg border border-neutral-300 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="pb-3 border-b border-neutral-200">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9c784e]">
                DESTINATION SPECIFICATION
              </span>
              <h3 id="address-modal-title" className="text-lg font-normal text-neutral-900">
                {editingAddressId ? 'Modify Address Dossier' : 'Register New Address'}
              </h3>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label htmlFor="address-recipient" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                  Recipient Name *
                </label>
                <input
                  id="address-recipient"
                  type="text"
                  required
                  maxLength={100}
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  placeholder="Full recipient name"
                  className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="address-phone" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                    Phone *
                  </label>
                  <input
                    id="address-phone"
                    type="tel"
                    required
                    maxLength={30}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="address-label" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                    Label (Optional)
                  </label>
                  <input
                    id="address-label"
                    type="text"
                    maxLength={50}
                    value={formData.label || ''}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="Home, Atelier, Studio"
                    className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="address-line1" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                  Address Line 1 *
                </label>
                <input
                  id="address-line1"
                  type="text"
                  required
                  maxLength={200}
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  placeholder="Street and house / building number"
                  className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="address-line2" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                  Address Line 2 (Optional)
                </label>
                <input
                  id="address-line2"
                  type="text"
                  maxLength={200}
                  value={formData.addressLine2 || ''}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  placeholder="Suite, apartment, unit"
                  className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="address-city" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                    City *
                  </label>
                  <input
                    id="address-city"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                    className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="address-state" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                    State / Province *
                  </label>
                  <input
                    id="address-state"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                    className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="address-postal" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                    Postal Code *
                  </label>
                  <input
                    id="address-postal"
                    type="text"
                    required
                    maxLength={20}
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="Postal Code"
                    className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="address-country" className="block text-[10px] font-semibold tracking-wider uppercase text-neutral-700">
                    Country *
                  </label>
                  <input
                    id="address-country"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Country"
                    className="w-full bg-[#fbfbfa] border border-neutral-300 px-3 py-2 rounded-none focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-default-check"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="cursor-pointer"
                />
                <label htmlFor="is-default-check" className="text-neutral-700 cursor-pointer">
                  Set as default delivery destination
                </label>
              </div>

              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 text-xs font-semibold tracking-wider uppercase hover:border-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="px-6 py-2 bg-black text-white text-xs font-semibold tracking-wider uppercase hover:bg-neutral-800 disabled:bg-neutral-400 cursor-pointer flex items-center gap-2"
                >
                  {isSavingAddress ? (
                    <>
                      <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : (
                    <span>SAVE DESTINATION</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerProfileView;
