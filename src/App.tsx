import { LanguageProvider } from './i18n/LanguageContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { ServicesPage } from './pages/ServicesPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
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
      ) : (
        <HomePage />
      )}
      <Footer />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
