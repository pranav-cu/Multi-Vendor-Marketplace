import { useState } from 'react';
import Navbar, { type MarketplaceView } from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import SignupPage from './auth/signup/page';
import LoginPage from './auth/login/page';
import ProfilePage from './profile/page';
import CatalogView from './views/CatalogView';
import CartCheckoutView from './views/CartCheckoutView';
import VendorDashboardView from './views/VendorDashboardView';
import AdminConsoleView from './views/AdminConsoleView';
import CustomerOrdersView from './views/CustomerOrdersView';
import CustomerProfileView from './views/CustomerProfileView';
import { CustomerAuthView } from './auth/CustomerAuthView';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';
import { CustomerProvider } from './context/CustomerContext';
import { useCustomer } from './context/useCustomer';

function AppContent() {
  const [currentView, setCurrentView] = useState<MarketplaceView>('catalog');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { isAdmin } = useMarketplace();
  const { isCustomerAuthenticated } = useCustomer();

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#fcfcfb] text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      {/* Atelier Luxury Header with navigation hooks */}
      <Navbar currentView={currentView} onNavigate={(view) => setCurrentView(view)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center">
        {currentView === 'catalog' && (
          <CatalogView
            onNavigateToCart={() => setCurrentView('cart')}
            onNavigateToAuth={() => setCurrentView('customer-auth')}
          />
        )}

        {currentView === 'cart' && (
          <CartCheckoutView
            onNavigateToCatalog={() => setCurrentView('catalog')}
            onNavigateToAuth={() => setCurrentView('customer-auth')}
            onNavigateToOrder={(orderId) => {
              setSelectedOrderId(orderId);
              setCurrentView('customer-orders');
            }}
          />
        )}

        {currentView === 'customer-orders' && (
          <CustomerOrdersView
            initialOrderId={selectedOrderId}
            onNavigateToCatalog={() => setCurrentView('catalog')}
            onNavigateToAuth={() => setCurrentView('customer-auth')}
          />
        )}

        {currentView === 'customer-profile' && (
          <CustomerProfileView
            onNavigateToAuth={() => setCurrentView('customer-auth')}
            onNavigateToOrders={() => setCurrentView('customer-orders')}
            onNavigateToCatalog={() => setCurrentView('catalog')}
          />
        )}

        {currentView === 'customer-auth' && (
          <CustomerAuthView
            onSuccess={() => setCurrentView('catalog')}
            onNavigateToVendorAuth={() => setCurrentView('login')}
          />
        )}

        {currentView === 'vendor' && (
          isCustomerAuthenticated ? (
            <div className="w-full max-w-xl mx-auto my-16 px-4 text-center">
              <div className="bg-white border border-neutral-200 p-8 sm:p-12 shadow-sm">
                <h2 className="text-sm font-semibold tracking-widest uppercase text-neutral-900 mb-2">
                  Vendor Portal Access Restricted
                </h2>
                <p className="text-xs text-neutral-600 mb-6 font-light leading-relaxed">
                  You are currently signed in as a customer. Customers cannot edit vendor stores or publish atelier products.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setCurrentView('customer-profile')}
                    className="px-5 py-2.5 bg-neutral-900 text-white text-[11px] font-semibold tracking-widest uppercase hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Go to Customer Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('catalog')}
                    className="px-5 py-2.5 border border-neutral-300 text-neutral-800 text-[11px] font-semibold tracking-widest uppercase hover:border-black transition-colors cursor-pointer"
                  >
                    Browse Catalog
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <VendorDashboardView onNavigateToProfile={() => setCurrentView('profile')} />
          )
        )}

        {currentView === 'admin' && (
          isAdmin ? (
            <AdminConsoleView onNavigateToCatalog={() => setCurrentView('catalog')} />
          ) : (
            <div className="w-full max-w-xl mx-auto my-16 px-4 text-center">
              <div className="bg-white border border-neutral-200 p-8 sm:p-12 shadow-sm">
                <h2 className="text-sm font-semibold tracking-widest uppercase text-neutral-900 mb-2">
                  Administrator Access Restricted
                </h2>
                <p className="text-xs text-neutral-600 mb-6 font-light leading-relaxed">
                  Platform governance and settlement controls require an authenticated administrator session.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView('catalog')}
                  className="px-6 py-2.5 bg-neutral-900 text-white text-[11px] font-semibold tracking-widest uppercase hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>
            </div>
          )
        )}

        {currentView === 'login' && (
          <LoginPage
            onNavigateToSignup={() => setCurrentView('signup')}
            onNavigateToProfile={() => setCurrentView('profile')}
          />
        )}

        {currentView === 'signup' && (
          <SignupPage
            onNavigateToLogin={() => setCurrentView('login')}
            onNavigateToProfile={() => setCurrentView('profile')}
          />
        )}

        {currentView === 'profile' && (
          isCustomerAuthenticated ? (
            <div className="w-full max-w-xl mx-auto my-16 px-4 text-center">
              <div className="bg-white border border-neutral-200 p-8 sm:p-12 shadow-sm">
                <h2 className="text-sm font-semibold tracking-widest uppercase text-neutral-900 mb-2">
                  Vendor Dossier Restricted
                </h2>
                <p className="text-xs text-neutral-600 mb-6 font-light leading-relaxed">
                  You are signed in with a customer account. For customer orders, profile, and shipping addresses, visit your customer dossier.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView('customer-profile')}
                  className="px-6 py-2.5 bg-neutral-900 text-white text-[11px] font-semibold tracking-widest uppercase hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Go to Customer Dossier
                </button>
              </div>
            </div>
          ) : (
            <ProfilePage
              onNavigateToLogin={() => setCurrentView('login')}
              onNavigateToSignup={() => setCurrentView('signup')}
            />
          )
        )}
      </main>

      {/* Atelier Architectural Footer */}
      <Footer />
    </div>
  );
}

function App() {
  return (
    <MarketplaceProvider>
      <CustomerProvider>
        <AppContent />
      </CustomerProvider>
    </MarketplaceProvider>
  );
}

export default App;
