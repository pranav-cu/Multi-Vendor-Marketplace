import React, { useState } from 'react';
import {
  AtelierLogoGlyph,
  SearchIcon,
  HeartIcon,
  BagIcon,
  UserAvatarGraphic,
  MenuIcon,
  XIcon,
} from '../ui/Icons';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useCustomer } from '../../context/useCustomer';

export type MarketplaceView =
  | 'catalog'
  | 'cart'
  | 'vendor'
  | 'admin'
  | 'profile'
  | 'login'
  | 'signup'
  | 'customer-auth'
  | 'customer-orders'
  | 'customer-profile';

export interface NavbarProps {
  currentView?: MarketplaceView;
  onNavigate: (view: MarketplaceView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView = 'catalog', onNavigate }) => {
  const { currentUserEmail, isAdmin, isVendor } = useMarketplace();
  const { isCustomerAuthenticated, customerUser, customerProfile, cartCount: customerCartCount } = useCustomer();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const cartBadgeCount = isCustomerAuthenticated ? customerCartCount : 0;
  const customerLabel = customerProfile?.displayName || customerUser?.email || null;

  return (
    <header className="sticky top-0 z-50 w-full bg-[#fcfcfb] border-b border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Left: Brand Monogram & Links */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="flex items-center gap-2.5 group focus:outline-none cursor-pointer"
              aria-label="Atelier Home"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 border border-neutral-300 bg-white flex items-center justify-center p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] group-hover:border-neutral-900 transition-colors">
                <AtelierLogoGlyph className="w-full h-full text-neutral-800" />
              </div>
              <span className="font-semibold text-sm sm:text-base tracking-[0.22em] text-neutral-900">
                ATELIER
              </span>
            </button>

            {/* Desktop Navigation Links */}
            <nav
              className="hidden md:flex items-center space-x-7 text-xs font-semibold tracking-[0.18em]"
              aria-label="Main Navigation"
            >
              <button
                type="button"
                onClick={() => onNavigate('catalog')}
                className={`relative py-2 transition-colors duration-150 cursor-pointer ${
                  currentView === 'catalog'
                    ? 'text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span>CATALOG</span>
                {currentView === 'catalog' && (
                  <span
                    className="absolute bottom-0 left-0 w-full h-[2px] bg-neutral-900"
                    aria-hidden="true"
                  />
                )}
              </button>

              {isCustomerAuthenticated && (
                <button
                  type="button"
                  onClick={() => onNavigate('customer-orders')}
                  className={`relative py-2 transition-colors duration-150 cursor-pointer ${
                    currentView === 'customer-orders'
                      ? 'text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <span>MY ORDERS</span>
                  {currentView === 'customer-orders' && (
                    <span
                      className="absolute bottom-0 left-0 w-full h-[2px] bg-neutral-900"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}

              {!isCustomerAuthenticated && (isVendor || isAdmin) && (
                <button
                  type="button"
                  onClick={() => onNavigate('vendor')}
                  className={`relative py-2 transition-colors duration-150 cursor-pointer ${
                    currentView === 'vendor'
                      ? 'text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <span>VENDOR HUB</span>
                  {currentView === 'vendor' && (
                    <span
                      className="absolute bottom-0 left-0 w-full h-[2px] bg-neutral-900"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className={`relative py-2 transition-colors duration-150 cursor-pointer ${
                    currentView === 'admin'
                      ? 'text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <span>ADMIN CONSOLE</span>
                  {currentView === 'admin' && (
                    <span
                      className="absolute bottom-0 left-0 w-full h-[2px] bg-neutral-900"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}
            </nav>
          </div>

          {/* Right Tools: Search, Wishlist, Cart & Account */}
          <div className="flex items-center space-x-3 sm:space-x-6">
            {/* Search Tool */}
            <div className="relative flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center bg-white border border-neutral-300 px-3 py-1.5 shadow-inner">
                  <SearchIcon className="w-3.5 h-3.5 text-neutral-500 mr-2 shrink-0" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="SEARCH CATALOG..."
                    className="w-32 sm:w-48 text-[11px] tracking-wider uppercase bg-transparent border-none focus:outline-none placeholder:text-neutral-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    aria-label="Close search"
                    className="ml-1 text-neutral-400 hover:text-neutral-800 cursor-pointer"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="group flex items-center gap-2 py-1.5 px-2 text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer focus:outline-none"
                  aria-label="Open search"
                >
                  <SearchIcon className="w-4 h-4 text-neutral-700 group-hover:scale-105 transition-transform" />
                  <span className="hidden lg:inline text-[11px] font-semibold tracking-[0.16em] uppercase">
                    SEARCH CATALOG
                  </span>
                </button>
              )}
            </div>

            {/* Wishlist */}
            <button
              type="button"
              className="p-1.5 text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer"
              aria-label="Wishlist"
            >
              <HeartIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            </button>

            {/* Cart with Dynamic Badge */}
            <button
              type="button"
              onClick={() => onNavigate('cart')}
              className={`relative p-1.5 transition-colors cursor-pointer ${
                currentView === 'cart' ? 'text-black' : 'text-neutral-700 hover:text-neutral-950'
              }`}
              aria-label="Shopping bag"
            >
              <BagIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              {cartBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-black text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {cartBadgeCount}
                </span>
              )}
            </button>

            {/* Account Selector */}
            {isCustomerAuthenticated ? (
              <button
                type="button"
                onClick={() => onNavigate('customer-profile')}
                className={`flex items-center gap-2 pl-1 group cursor-pointer focus:outline-none transition-colors ${
                  currentView === 'customer-profile' ? 'text-black' : 'text-neutral-800'
                }`}
                title={`Client: ${customerLabel} • Click for Dossier`}
              >
                <div
                  className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border transition-all ${
                    currentView === 'customer-profile'
                      ? 'border-neutral-900 ring-2 ring-neutral-900/30'
                      : 'border-neutral-300 bg-neutral-200 group-hover:border-neutral-900'
                  } flex items-center justify-center shadow-sm`}
                >
                  <UserAvatarGraphic />
                </div>
                <span className="hidden sm:inline text-[11px] font-medium tracking-normal lowercase text-neutral-800 group-hover:text-neutral-950 max-w-[130px] md:max-w-[180px] truncate">
                  {customerLabel}
                </span>
              </button>
            ) : currentUserEmail ? (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-2 pl-1 group cursor-pointer focus:outline-none transition-colors ${
                  currentView === 'profile' ? 'text-black' : 'text-neutral-800'
                }`}
                title={`Vendor/Admin: ${currentUserEmail}`}
              >
                <div
                  className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border transition-all ${
                    currentView === 'profile'
                      ? 'border-neutral-900 ring-2 ring-neutral-900/30'
                      : 'border-neutral-300 bg-neutral-200 group-hover:border-neutral-900'
                  } flex items-center justify-center shadow-sm`}
                >
                  <UserAvatarGraphic />
                </div>
                <span className="hidden sm:inline text-[11px] font-medium tracking-normal lowercase text-neutral-800 group-hover:text-neutral-950 max-w-[130px] md:max-w-[180px] truncate">
                  {currentUserEmail}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('customer-auth')}
                className="text-[11px] font-semibold tracking-[0.16em] uppercase text-neutral-800 hover:text-black py-1.5 px-3 border border-neutral-300 hover:border-black cursor-pointer transition-colors"
              >
                SIGN IN
              </button>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 text-neutral-700 hover:text-neutral-950 cursor-pointer"
            >
              {isMobileMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-5 pt-4 pb-6 space-y-3">
          <nav className="flex flex-col space-y-2 text-xs font-semibold tracking-[0.18em]">
            <button
              type="button"
              onClick={() => {
                onNavigate('catalog');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-2 text-neutral-800 hover:bg-neutral-50"
            >
              CATALOG
            </button>
            {isCustomerAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('customer-orders');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2 px-2 text-neutral-800 hover:bg-neutral-50"
              >
                MY ORDERS
              </button>
            )}
            {!isCustomerAuthenticated && (isVendor || isAdmin) && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('vendor');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2 px-2 text-neutral-800 hover:bg-neutral-50"
              >
                VENDOR HUB
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('admin');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2 px-2 text-neutral-800 hover:bg-neutral-50"
              >
                ADMIN CONSOLE
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isCustomerAuthenticated) {
                  onNavigate('customer-profile');
                } else if (currentUserEmail) {
                  onNavigate('profile');
                } else {
                  onNavigate('customer-auth');
                }
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-2 text-neutral-800 hover:bg-neutral-50"
            >
              {isCustomerAuthenticated
                ? 'CUSTOMER DOSSIER'
                : currentUserEmail
                ? 'VENDOR PROFILE'
                : 'SIGN IN'}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
