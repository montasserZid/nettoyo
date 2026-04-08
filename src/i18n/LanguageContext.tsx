import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations } from './translations';
import { AppRoute, getPathForRoute, resolveRoute } from './routes';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  route: AppRoute;
  navigateTo: (route: AppRoute) => void;
  t: typeof translations.fr;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [route, setRoute] = useState<AppRoute>('home');

  useEffect(() => {
    const syncFromLocation = () => {
      const savedLanguage = localStorage.getItem('language') as Language | null;
      const hasLanguageInPath = ['fr', 'en', 'es'].includes(window.location.pathname.split('/')[1] ?? '');

      if (hasLanguageInPath) {
        const nextState = resolveRoute(window.location.pathname);
        setLanguageState(nextState.language);
        setRoute(nextState.route);
        localStorage.setItem('language', nextState.language);
        return;
      }

      const fallbackLanguage = savedLanguage && ['fr', 'en', 'es'].includes(savedLanguage) ? savedLanguage : 'fr';
      setLanguageState(fallbackLanguage);
      setRoute('home');
      localStorage.setItem('language', fallbackLanguage);
      window.history.replaceState({}, '', getPathForRoute(fallbackLanguage, 'home'));
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);

    return () => {
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    window.history.pushState({}, '', getPathForRoute(lang, route));
  };

  const navigateTo = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    window.history.pushState({}, '', getPathForRoute(language, nextRoute));
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, route, navigateTo, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
