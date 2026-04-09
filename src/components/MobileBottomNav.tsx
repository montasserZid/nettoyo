import { CalendarDays, ClipboardList, Home, Info, LogIn, UserRound } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavBookingCounts } from '../hooks/useNavBookingCounts';
import { useLanguage } from '../i18n/LanguageContext';
import { AppRoute, getPathForRoute } from '../i18n/routes';

type CleanerReservationsView = 'pending' | 'accepted';

type NavItem = {
  key: string;
  label: string;
  icon: typeof Home;
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  isActive: boolean;
  badge?: number;
};

function getCleanerViewFromSearch() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  return view === 'accepted' ? 'accepted' : 'pending';
}

function compactBadgeCount(value: number) {
  if (value > 9) return '9+';
  return String(value);
}

export function MobileBottomNav() {
  const { language, route, navigateTo } = useLanguage();
  const { user, isClient, isCleaner } = useAuth();
  const { pendingBookingCount } = useNavBookingCounts();
  const [cleanerView, setCleanerView] = useState<CleanerReservationsView>(() => getCleanerViewFromSearch());

  useEffect(() => {
    const syncCleanerView = () => setCleanerView(getCleanerViewFromSearch());
    const onCustomView = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string }>).detail;
      if (detail?.view === 'accepted' || detail?.view === 'pending') {
        setCleanerView(detail.view);
      } else {
        syncCleanerView();
      }
    };
    window.addEventListener('popstate', syncCleanerView);
    window.addEventListener('cleaner-reservations-view', onCustomView as EventListener);
    return () => {
      window.removeEventListener('popstate', syncCleanerView);
      window.removeEventListener('cleaner-reservations-view', onCustomView as EventListener);
    };
  }, []);

  const goToRoute = (nextRoute: AppRoute) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigateTo(nextRoute);
  };

  const goToCleanerReservationsView = (view: CleanerReservationsView) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigateTo('cleanerReservations');
    const basePath = getPathForRoute(language, 'cleanerReservations');
    const nextUrl = `${basePath}?view=${view}`;
    window.history.replaceState({}, '', nextUrl);
    setCleanerView(view);
    window.dispatchEvent(new CustomEvent('cleaner-reservations-view', { detail: { view } }));
  };

  const items: NavItem[] = useMemo(() => {
    if (user && isClient()) {
      return [
        {
          key: 'client-home',
          label: language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home',
          icon: Home,
          href: getPathForRoute(language, 'home'),
          onClick: goToRoute('home'),
          isActive: route === 'home'
        },
        {
          key: 'client-reservations',
          label: language === 'fr' ? 'Réservations' : language === 'es' ? 'Reservas' : 'Bookings',
          icon: CalendarDays,
          href: getPathForRoute(language, 'clientReservations'),
          onClick: goToRoute('clientReservations'),
          isActive: route === 'clientReservations'
        },
        {
          key: 'client-profile',
          label: language === 'fr' ? 'Profil' : language === 'es' ? 'Perfil' : 'Profile',
          icon: UserRound,
          href: getPathForRoute(language, 'clientDashboard'),
          onClick: goToRoute('clientDashboard'),
          isActive: route === 'clientDashboard' || route === 'clientAddSpace'
        }
      ];
    }

    if (user && isCleaner()) {
      return [
        {
          key: 'cleaner-requests',
          label: language === 'fr' ? 'Demandes' : language === 'es' ? 'Solicitudes' : 'Requests',
          icon: ClipboardList,
          href: `${getPathForRoute(language, 'cleanerReservations')}?view=pending`,
          onClick: goToCleanerReservationsView('pending'),
          isActive: route === 'cleanerReservations' && cleanerView === 'pending',
          badge: pendingBookingCount > 0 ? pendingBookingCount : undefined
        },
        {
          key: 'cleaner-reservations',
          label: language === 'fr' ? 'Réservations' : language === 'es' ? 'Reservas' : 'Bookings',
          icon: CalendarDays,
          href: `${getPathForRoute(language, 'cleanerReservations')}?view=accepted`,
          onClick: goToCleanerReservationsView('accepted'),
          isActive: route === 'cleanerReservations' && cleanerView === 'accepted'
        },
        {
          key: 'cleaner-profile',
          label: language === 'fr' ? 'Profil' : language === 'es' ? 'Perfil' : 'Profile',
          icon: UserRound,
          href: getPathForRoute(language, 'cleanerDashboard'),
          onClick: goToRoute('cleanerDashboard'),
          isActive: route === 'cleanerDashboard'
        }
      ];
    }

    return [
      {
        key: 'guest-home',
        label: language === 'fr' ? 'Accueil' : language === 'es' ? 'Inicio' : 'Home',
        icon: Home,
        href: getPathForRoute(language, 'home'),
        onClick: goToRoute('home'),
        isActive: route === 'home'
      },
      {
        key: 'guest-how',
        label: language === 'fr' ? 'Comment ça marche' : language === 'es' ? 'Como funciona' : 'How it works',
        icon: Info,
        href: getPathForRoute(language, 'howItWorks'),
        onClick: goToRoute('howItWorks'),
        isActive: route === 'howItWorks'
      },
      {
        key: 'guest-login',
        label: language === 'fr' ? 'Se connecter' : language === 'es' ? 'Conectarse' : 'Log in',
        icon: LogIn,
        href: getPathForRoute(language, 'login'),
        onClick: goToRoute('login'),
        isActive: route === 'login' || route === 'signup'
      }
    ];
  }, [cleanerView, isCleaner, isClient, language, pendingBookingCount, route, user]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#E5E7EB] bg-white/95 shadow-[0_-10px_24px_rgba(17,24,39,0.08)] backdrop-blur-sm md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-3 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition-colors ${
                item.isActive ? 'text-[#0284C7] bg-[rgba(79,195,247,0.12)]' : 'text-[#1A1A2E]'
              }`}
            >
              <span className="relative inline-flex">
                <Icon size={18} />
                {typeof item.badge === 'number' && item.badge > 0 ? (
                  <span className="absolute -right-3 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
                    {compactBadgeCount(item.badge)}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

