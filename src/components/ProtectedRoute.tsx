import { ReactNode, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { navigateTo, language } = useLanguage();
  const loadingLabel = language === 'fr' ? 'Chargement...' : language === 'es' ? 'Cargando...' : 'Loading...';

  useEffect(() => {
    if (!loading && !user) {
      navigateTo('login');
    }
  }, [loading, navigateTo, user]);

  if (loading && !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F7F7]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E5E7EB] border-t-[#4FC3F7]" />
          <p className="text-sm text-[#6B7280]">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
