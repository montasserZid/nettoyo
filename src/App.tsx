import { LanguageProvider } from './i18n/LanguageContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Footer } from './components/Footer';
import { FloatingReserveCTA } from './components/FloatingReserveCTA';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { ServicesPage } from './pages/ServicesPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { AuthCallbackPage } from './pages/AuthCallback';
import { CleanerDashboardPage } from './pages/CleanerDashboard';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ClientAddSpacePage, ClientDashboardPage } from './pages/ClientDashboardPage';
import { ClientReservationPage } from './pages/ClientReservationPage';
import { ClientReservationSuccessPage } from './pages/ClientReservationSuccessPage';
import { ClientReservationsPage } from './pages/ClientReservationsPage';
import { ClientHistoryPage } from './pages/ClientHistoryPage';
import { CleanerReservationsPage } from './pages/CleanerReservationsPage';
import { CleanerHistoryPage } from './pages/CleanerHistoryPage';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './i18n/LanguageContext';
import { useEffect } from 'react';
import { buildPageTitle } from './lib/pageTitle';

function AppContent() {
  const { route, navigateTo } = useLanguage();
  const { user, isCleaner, isAdmin, loading } = useAuth();
  const isAdminRoute = route === 'adminDashboard';
  const seoManagedRoutes = ['home', 'howItWorks', 'services', 'login', 'signup'] as const;
  const pageTitleByRoute: Partial<Record<typeof route, string>> = {
    howItWorks: 'How It Works',
    services: 'Services',
    login: 'Login',
    signup: 'Sign Up',
    clientDashboard: 'Dashboard',
    clientAddSpace: 'Add Space',
    clientReservations: 'My Bookings',
    clientHistory: 'Client History',
    clientReservation: 'Reservation',
    clientReservationSuccess: 'Reservation Sent',
    adminDashboard: 'Admin Dashboard',
    cleanerDashboard: 'Cleaner Dashboard',
    cleanerReservations: 'Cleaner Reservations',
    cleanerHistory: 'Cleaner History'
  };

  useEffect(() => {
    if (seoManagedRoutes.includes(route as (typeof seoManagedRoutes)[number])) {
      return;
    }
    document.title = buildPageTitle(pageTitleByRoute[route]);
  }, [route]);

  useEffect(() => {
    if (route === 'services' && !loading && user && isCleaner()) {
      navigateTo('cleanerDashboard');
    }
  }, [isCleaner, loading, navigateTo, route, user]);

  useEffect(() => {
    if (route !== 'adminDashboard' || loading || !user) {
      return;
    }
    if (!isAdmin()) {
      navigateTo(isCleaner() ? 'cleanerDashboard' : 'clientDashboard');
    }
  }, [isAdmin, isCleaner, loading, navigateTo, route, user]);

  return (
    <div className={isAdminRoute ? 'min-h-screen bg-white' : 'min-h-screen bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0'}>
      {!isAdminRoute && <Navbar />}
      {route === 'howItWorks' ? (
        <HowItWorksPage />
      ) : route === 'services' ? (
        user && (loading || isCleaner()) ? null : <ServicesPage />
      ) : route === 'login' ? (
        <LoginPage />
      ) : route === 'signup' ? (
        <SignupPage />
      ) : route === 'authCallback' ? (
        <AuthCallbackPage />
      ) : route === 'clientDashboard' ? (
        <ProtectedRoute>
          <ClientDashboardPage />
        </ProtectedRoute>
      ) : route === 'clientAddSpace' ? (
        <ProtectedRoute>
          <ClientAddSpacePage />
        </ProtectedRoute>
      ) : route === 'clientReservations' ? (
        <ProtectedRoute>
          <ClientReservationsPage />
        </ProtectedRoute>
      ) : route === 'clientHistory' ? (
        <ProtectedRoute>
          <ClientHistoryPage />
        </ProtectedRoute>
      ) : route === 'clientReservation' ? (
        <ProtectedRoute>
          <ClientReservationPage />
        </ProtectedRoute>
      ) : route === 'clientReservationSuccess' ? (
        <ProtectedRoute>
          <ClientReservationSuccessPage />
        </ProtectedRoute>
      ) : route === 'cleanerDashboard' ? (
        <ProtectedRoute>
          <CleanerDashboardPage />
        </ProtectedRoute>
      ) : route === 'adminDashboard' ? (
        <ProtectedRoute>
          <AdminDashboardPage />
        </ProtectedRoute>
      ) : route === 'cleanerReservations' ? (
        <ProtectedRoute>
          <CleanerReservationsPage />
        </ProtectedRoute>
      ) : route === 'cleanerHistory' ? (
        <ProtectedRoute>
          <CleanerHistoryPage />
        </ProtectedRoute>
      ) : (
        <HomePage />
      )}
      {!isAdminRoute && <FloatingReserveCTA />}
      {!isAdminRoute && <MobileBottomNav />}
      {!isAdminRoute && <Footer />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
