import type { AuthSession } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { fetchProfile } from '../context/AuthContext';
import { getPathForRoute } from '../i18n/routes';
import supabase from '../lib/supabase';

type AuthApi = {
  getSession: () => Promise<{ data: { session: AuthSession | null } }>;
  onAuthStateChange: (
    callback: (event: string, session: AuthSession | null) => void | Promise<void>
  ) => { data: { subscription: { unsubscribe: () => void } } };
};

const auth = supabase.auth as unknown as AuthApi;

const loadingMessages = {
  fr: 'Connexion en cours...',
  en: 'Logging you in...',
  es: 'Iniciando sesión...'
} as const;

export function AuthCallbackPage() {
  const { language, navigateTo } = useLanguage();
  const [message, setMessage] = useState(loadingMessages[language]);

  const redirectMessage = useMemo(() => loadingMessages[language], [language]);

  useEffect(() => {
    let active = true;

    const resolveAuth = async () => {
      setMessage(redirectMessage);

      const handleProfileRedirect = async () => {
        const {
          data: { session }
        } = await auth.getSession();

        if (!active) {
          return;
        }

        if (!session?.user) {
          return;
        }

        const profile = await fetchProfile(session.user.id);

        if (!active) {
          return;
        }

        if (!profile) {
          navigateTo('signup');
          return;
        }

        const nextPath =
          profile.role === 'nettoyeur'
            ? '/dashboard/nettoyeur'
            : getPathForRoute(language, 'clientDashboard');

        if (profile.role === 'nettoyeur') {
          window.history.replaceState({}, '', nextPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }

        window.history.replaceState({}, '', nextPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      };

      await handleProfileRedirect();

      const {
        data: { subscription }
      } = auth.onAuthStateChange(async (_event: string, session: AuthSession | null) => {
        if (!session?.user || !active) {
          return;
        }

        const profile = await fetchProfile(session.user.id);

        if (!active) {
          return;
        }

        if (!profile) {
          navigateTo('signup');
          return;
        }

        const nextPath =
          profile.role === 'nettoyeur'
            ? '/dashboard/nettoyeur'
            : getPathForRoute(language, 'clientDashboard');

        window.history.replaceState(
          {},
          '',
          nextPath
        );
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    let cleanup: (() => void) | undefined;

    void resolveAuth().then((maybeCleanup) => {
      cleanup = maybeCleanup;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [language, navigateTo, redirectMessage]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F7F7] px-4 py-16">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-10 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E5E7EB] border-t-[#4FC3F7]" />
        <p className="text-base font-medium text-[#1A1A2E]">{message}</p>
      </div>
    </div>
  );
}
