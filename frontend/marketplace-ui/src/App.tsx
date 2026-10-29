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
import { MarketplaceProvider } from './context/MarketplaceContext';
import { CustomerProvider } from './context/CustomerContext';

function AppContent() {
  const [currentView, setCurrentView] = useState<MarketplaceView>('catalog');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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
          <VendorDashboardView onNavigateToProfile={() => setCurrentView('profile')} />
        )}

        {currentView === 'admin' && <AdminConsoleView />}

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
          <ProfilePage
            onNavigateToLogin={() => setCurrentView('login')}
            onNavigateToSignup={() => setCurrentView('signup')}
          />
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
