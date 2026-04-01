import { LanguageProvider } from './i18n/LanguageContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { ServicesPage } from './pages/ServicesPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { AuthCallbackPage } from './pages/AuthCallback';
import { CleanerDashboardPage } from './pages/CleanerDashboard';
import { ClientAddSpacePage, ClientDashboardPage } from './pages/ClientDashboardPage';
import { AuthProvider } from './context/AuthContext';
import { useLanguage } from './i18n/LanguageContext';

function AppContent() {
  const { route } = useLanguage();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      {route === 'howItWorks' ? (
        <HowItWorksPage />
      ) : route === 'services' ? (
        <ServicesPage />
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
      ) : route === 'cleanerDashboard' ? (
        <ProtectedRoute>
          <CleanerDashboardPage />
        </ProtectedRoute>
      ) : (
        <HomePage />
      )}
      <Footer />
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
