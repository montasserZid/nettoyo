import { Menu, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { getLocalizedSectionPath, getPathForRoute } from '../i18n/routes';
import { useNavBookingCounts } from '../hooks/useNavBookingCounts';
import { NettoyoLogo } from './NettoyoLogo';

const accountLabels = {
  fr: { profile: 'Mon profil', logout: 'Se déconnecter' },
  en: { profile: 'My profile', logout: 'Log out' },
  es: { profile: 'Mi perfil', logout: 'Cerrar sesion' }
} as const;

const reservationCtaLabels = {
  fr: {
    cleaner: 'Mes réservations',
    cleanerWithCount: (count: number) => `Mes réservations (${count})`
  },
  en: {
    cleaner: 'My bookings',
    cleanerWithCount: (count: number) => `My bookings (${count})`
  },
  es: {
    cleaner: 'Mis reservas',
    cleanerWithCount: (count: number) => `Mis reservas (${count})`
  }
} as const;

const cleanerNavLabels = {
  fr: 'Historique',
  en: 'History',
  es: 'Historial'
} as const;
const clientNavLabels = {
  fr: 'Historique',
  en: 'History',
  es: 'Historial'
} as const;
const clientReservationsLabels = {
  fr: 'Mes réservations',
  en: 'My bookings',
  es: 'Mis reservas'
} as const;

const homeNavLabels = {
  fr: 'Accueil',
  en: 'Home',
  es: 'Inicio'
} as const;

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { upcomingBookingCount, pendingBookingCount, historyPendingCount } = useNavBookingCounts();
  const { language, setLanguage, route, navigateTo, t } = useLanguage();
  const { user, profile, signOut, isCleaner, isClient } = useAuth();

  const flags: Record<Language, string> = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸' };
  const howItWorksPath = getPathForRoute(language, 'howItWorks');
  const servicesPath = getPathForRoute(language, 'services');
  const loginPath = getPathForRoute(language, 'login');
  const cleanerPath = getLocalizedSectionPath(language, 'become-cleaner');
  const cleanerHistoryPath = getPathForRoute(language, 'cleanerHistory');
  const clientReservationsPath = getPathForRoute(language, 'clientReservations');
  const clientHistoryPath = getPathForRoute(language, 'clientHistory');
  const homePath = getPathForRoute(language, 'home');
  const dashboardRoute = isCleaner() ? 'cleanerDashboard' : 'clientDashboard';
  const dashboardPath = getPathForRoute(language, dashboardRoute);
  const reservationRoute = user ? (isCleaner() ? 'cleanerReservations' : 'clientReservation') : 'login';
  const reservationPath = getPathForRoute(language, reservationRoute);
  const labels = accountLabels[language];
  const reservationLabels = reservationCtaLabels[language];
  const cleanerNavText = cleanerNavLabels[language];
  const clientNavText = clientNavLabels[language];
  const clientReservationsText = clientReservationsLabels[language];
  const homeNavText = homeNavLabels[language];

  const initials = useMemo(() => {
    const first = profile?.first_name?.[0] ?? user?.email?.[0] ?? 'N';
    const second = profile?.last_name?.[0] ?? user?.email?.[1] ?? '';
    return `${first}${second}`.toUpperCase();
  }, [profile?.first_name, profile?.last_name, user?.email]);

  const goTo = (
    nextRoute:
      | typeof dashboardRoute
      | 'howItWorks'
      | 'services'
      | 'login'
      | 'home'
      | 'clientReservation'
      | 'clientReservations'
      | 'clientHistory'
      | 'cleanerReservations'
      | 'cleanerHistory'
  ) => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    navigateTo(nextRoute);
  };

  const handleSignOut = async () => {
    await signOut();
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    window.location.assign('/');
  };

  const howItWorksClass = route === 'howItWorks' ? 'text-[#4FC3F7] font-semibold' : 'text-[#1A1A2E] font-medium hover:text-[#4FC3F7] transition-colors';
  const servicesClass = route === 'services' ? 'text-[#4FC3F7] font-semibold' : 'text-[#1A1A2E] font-medium hover:text-[#4FC3F7] transition-colors';

  const reservationCtaText = user
    ? isCleaner()
      ? reservationLabels.cleanerWithCount(upcomingBookingCount ?? 0)
      : t.nav.bookNow
    : t.nav.bookNow;

  return (
    <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <a href={homePath} className="flex items-center overflow-visible py-2" onClick={(event) => { event.preventDefault(); goTo('home'); }}>
            <NettoyoLogo className="h-14" />
          </a>

          <div className="hidden items-center space-x-8 md:flex">
            <a href={homePath} onClick={(event) => { event.preventDefault(); goTo('home'); }} className={route === 'home' ? 'text-[#4FC3F7] font-semibold' : 'text-[#1A1A2E] font-medium hover:text-[#4FC3F7] transition-colors'}>{homeNavText}</a>
            <a href={howItWorksPath} onClick={(event) => { event.preventDefault(); goTo('howItWorks'); }} className={howItWorksClass}>{t.nav.howItWorks}</a>
            <a href={servicesPath} onClick={(event) => { event.preventDefault(); goTo('services'); }} className={servicesClass}>{t.nav.services}</a>
            {isCleaner() ? (
              <a href={cleanerHistoryPath} onClick={(event) => { event.preventDefault(); goTo('cleanerHistory'); }} className={`font-medium transition-colors hover:text-[#4FC3F7] ${route === 'cleanerHistory' ? 'text-[#4FC3F7] font-semibold' : 'text-[#1A1A2E]'}`}>
                <span className="inline-flex items-center">
                  {cleanerNavText}
                  {historyPendingCount > 0 ? <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-bold text-white">{historyPendingCount}</span> : null}
                </span>
              </a>
            ) : user && isClient() ? (
              <>
                <a href={clientReservationsPath} onClick={(event) => { event.preventDefault(); goTo('clientReservations'); }} className={`font-medium transition-colors hover:text-[#4FC3F7] ${route === 'clientReservations' ? 'text-[#4FC3F7] font-semibold' : 'text-[#1A1A2E]'}`}>
                  {clientReservationsText}
                </a>
                <a href={clientHistoryPath} onClick={(event) => { event.preventDefault(); goTo('clientHistory'); }} className={`font-medium transition-colors hover:text-[#4FC3F7] ${route === 'clientHistory' ? 'text-[#4FC3F7] font-semibold' : 'text-[#1A1A2E]'}`}>
                  <span className="inline-flex items-center">
                    {clientNavText}
                    {historyPendingCount > 0 ? <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-bold text-white">{historyPendingCount}</span> : null}
                  </span>
                </a>
              </>
            ) : (
              <a href={cleanerPath} className="font-medium text-[#1A1A2E] transition-colors hover:text-[#4FC3F7]">{t.nav.becomeCleaner}</a>
            )}
          </div>

          <div className="hidden items-center space-x-4 md:flex">
            <div className="mr-2 flex items-center space-x-2">
              {(Object.keys(flags) as Language[]).map((lang) => (
                <button key={lang} onClick={() => setLanguage(lang)} className={`text-2xl transition-all ${language === lang ? 'scale-110 border-b-2 border-[#A8E6CF]' : 'opacity-60 hover:opacity-100'}`} aria-label={lang}>{flags[lang]}</button>
              ))}
            </div>

            {user ? (
              <div className="relative">
                <button onClick={() => setAccountMenuOpen((value) => !value)} className="flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 shadow-[0_8px_20px_rgba(17,24,39,0.05)]">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile?.first_name || user.email || 'Profile'}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4FC3F7] text-sm font-bold text-white">{initials}</span>
                  )}
                  <span className="max-w-[140px] truncate text-sm font-semibold text-[#1A1A2E]">{profile?.first_name || user.email}</span>
                </button>
                {accountMenuOpen ? (
                  <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
                    <button onClick={() => goTo(dashboardRoute)} className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[#1A1A2E] transition-colors hover:bg-[#F7F7F7]">{labels.profile}</button>
                    <button onClick={() => { void handleSignOut(); }} className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[#1A1A2E] transition-colors hover:bg-[#F7F7F7]">{labels.logout}</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <a href={loginPath} onClick={(event) => { event.preventDefault(); goTo('login'); }} className="px-4 py-2 font-medium text-[#1A1A2E] transition-colors hover:text-[#4FC3F7]">{t.nav.login}</a>
            )}

            <a href={reservationPath} onClick={(event) => { event.preventDefault(); goTo(reservationRoute); }} className="relative rounded-full bg-[#4FC3F7] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#3FAAD4]">{reservationCtaText}{isCleaner() && pendingBookingCount > 0 ? <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[11px] font-bold text-white">{pendingBookingCount}</span> : null}</a>
          </div>

          <button className="text-[#1A1A2E] md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-[#E5E7EB] bg-white md:hidden">
          <div className="space-y-4 px-4 py-4">
            <a href={homePath} onClick={(event) => { event.preventDefault(); goTo('home'); }} className={`block ${route === 'home' ? 'font-semibold text-[#4FC3F7]' : 'font-medium text-[#1A1A2E]'}`}>{homeNavText}</a>
            <a href={howItWorksPath} onClick={(event) => { event.preventDefault(); goTo('howItWorks'); }} className={`block ${route === 'howItWorks' ? 'font-semibold text-[#4FC3F7]' : 'font-medium text-[#1A1A2E]'}`}>{t.nav.howItWorks}</a>
            <a href={servicesPath} onClick={(event) => { event.preventDefault(); goTo('services'); }} className={`block ${route === 'services' ? 'font-semibold text-[#4FC3F7]' : 'font-medium text-[#1A1A2E]'}`}>{t.nav.services}</a>
            {isCleaner() ? (
              <a href={cleanerHistoryPath} onClick={(event) => { event.preventDefault(); goTo('cleanerHistory'); }} className={`block font-medium ${route === 'cleanerHistory' ? 'text-[#4FC3F7]' : 'text-[#1A1A2E]'}`}>
                <span className="inline-flex items-center">
                  {cleanerNavText}
                  {historyPendingCount > 0 ? <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-bold text-white">{historyPendingCount}</span> : null}
                </span>
              </a>
            ) : user && isClient() ? (
              <>
                <a href={clientReservationsPath} onClick={(event) => { event.preventDefault(); goTo('clientReservations'); }} className={`block font-medium ${route === 'clientReservations' ? 'text-[#4FC3F7]' : 'text-[#1A1A2E]'}`}>
                  {clientReservationsText}
                </a>
                <a href={clientHistoryPath} onClick={(event) => { event.preventDefault(); goTo('clientHistory'); }} className={`block font-medium ${route === 'clientHistory' ? 'text-[#4FC3F7]' : 'text-[#1A1A2E]'}`}>
                  <span className="inline-flex items-center">
                    {clientNavText}
                    {historyPendingCount > 0 ? <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-bold text-white">{historyPendingCount}</span> : null}
                  </span>
                </a>
              </>
            ) : (
              <a href={cleanerPath} className="block font-medium text-[#1A1A2E]">{t.nav.becomeCleaner}</a>
            )}

            <div className="flex items-center space-x-3 border-t border-[#E5E7EB] pt-2">
              {(Object.keys(flags) as Language[]).map((lang) => (
                <button key={lang} onClick={() => setLanguage(lang)} className={`text-2xl transition-all ${language === lang ? 'scale-110 border-b-2 border-[#A8E6CF]' : 'opacity-60'}`}>{flags[lang]}</button>
              ))}
            </div>

            {user ? (
              <>
                <button onClick={() => goTo(dashboardRoute)} className="block w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-center font-medium text-[#1A1A2E]">{labels.profile}</button>
                <button onClick={() => { void handleSignOut(); }} className="block w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-center font-medium text-[#1A1A2E]">{labels.logout}</button>
              </>
            ) : (
              <a href={loginPath} onClick={(event) => { event.preventDefault(); goTo('login'); }} className="block w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-center font-medium text-[#1A1A2E]">{t.nav.login}</a>
            )}

            <a href={reservationPath} onClick={(event) => { event.preventDefault(); goTo(reservationRoute); }} className="relative block w-full rounded-full bg-[#4FC3F7] px-6 py-3 text-center font-semibold text-white">{reservationCtaText}{isCleaner() && pendingBookingCount > 0 ? <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[11px] font-bold text-white">{pendingBookingCount}</span> : null}</a>
          </div>
        </div>
      ) : null}
    </nav>
  );
}


