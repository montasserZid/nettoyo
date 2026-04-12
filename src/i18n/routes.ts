import { Language } from './translations';

export type AppRoute =
  | 'home'
  | 'howItWorks'
  | 'services'
  | 'login'
  | 'signup'
  | 'authCallback'
  | 'clientDashboard'
  | 'clientAddSpace'
  | 'clientReservations'
  | 'clientHistory'
  | 'clientReservation'
  | 'clientReservationSuccess'
  | 'adminDashboard'
  | 'cleanerDashboard'
  | 'cleanerReservations'
  | 'cleanerHistory';

const localizedRouteSegments: Record<
  Exclude<AppRoute, 'home' | 'authCallback' | 'adminDashboard' | 'cleanerDashboard' | 'cleanerReservations' | 'cleanerHistory' | 'clientHistory' | 'clientReservations'>,
  Record<Language, string>
> = {
  howItWorks: {
    fr: 'comment-ca-marche',
    en: 'how-it-works',
    es: 'como-funciona'
  },
  services: {
    fr: 'services',
    en: 'services',
    es: 'servicios'
  },
  login: {
    fr: 'connexion',
    en: 'login',
    es: 'iniciar-sesion'
  },
  signup: {
    fr: 'inscription',
    en: 'signup',
    es: 'registro'
  },
  clientDashboard: {
    fr: 'dashboard/client',
    en: 'dashboard/client',
    es: 'dashboard/client'
  },
  clientAddSpace: {
    fr: 'dashboard/client/ajouter-espace',
    en: 'dashboard/client/add-space',
    es: 'dashboard/client/agregar-espacio'
  },
  clientReservation: {
    fr: 'dashboard/client/reservation',
    en: 'dashboard/client/reservation',
    es: 'dashboard/client/reserva'
  },
  clientReservationSuccess: {
    fr: 'dashboard/client/reservation/succes',
    en: 'dashboard/client/reservation/success',
    es: 'dashboard/client/reserva/exito'
  }
};

const staticRoutePaths: Record<Extract<AppRoute, 'authCallback' | 'adminDashboard' | 'clientReservations' | 'clientHistory' | 'cleanerDashboard' | 'cleanerReservations' | 'cleanerHistory'>, string> = {
  authCallback: '/auth/callback',
  adminDashboard: '/dashboard/admin',
  clientReservations: '/dashboard/client/reservations',
  clientHistory: '/dashboard/client/historique',
  cleanerDashboard: '/dashboard/nettoyeur',
  cleanerReservations: '/dashboard/nettoyeur/reservations',
  cleanerHistory: '/dashboard/nettoyeur/historique'
};

export function getPathForRoute(language: Language, route: AppRoute) {
  if (route === 'home') {
    return `/${language}`;
  }

  if (route in staticRoutePaths) {
    return staticRoutePaths[route as keyof typeof staticRoutePaths];
  }

  return `/${language}/${localizedRouteSegments[route as keyof typeof localizedRouteSegments][language]}`;
}

export function getLocalizedSectionPath(language: Language, sectionId: string) {
  return `${getPathForRoute(language, 'home')}#${sectionId}`;
}

export function resolveRoute(pathname: string): { language: Language; route: AppRoute } {
  const staticMatch = (Object.entries(staticRoutePaths) as Array<
    [Extract<AppRoute, 'authCallback' | 'adminDashboard' | 'clientReservations' | 'clientHistory' | 'cleanerDashboard' | 'cleanerReservations' | 'cleanerHistory'>, string]
  >).find(([, value]) => value === pathname);

  if (staticMatch) {
    const savedLanguage = localStorage.getItem('language');
    const language: Language = savedLanguage === 'en' || savedLanguage === 'es' ? savedLanguage : 'fr';
    return { language, route: staticMatch[0] };
  }

  const [, rawLanguage, ...rawSegments] = pathname.split('/');
  const language: Language = rawLanguage === 'en' || rawLanguage === 'es' ? rawLanguage : 'fr';
  const rawSlug = rawSegments.filter(Boolean).join('/');

  if (!rawSlug) {
    return { language, route: 'home' };
  }

  const matchingRoute = (
    Object.keys(localizedRouteSegments) as Array<
      Exclude<AppRoute, 'home' | 'authCallback' | 'adminDashboard' | 'cleanerDashboard' | 'cleanerReservations' | 'cleanerHistory' | 'clientHistory' | 'clientReservations'>
    >
  ).find(
    (route) => localizedRouteSegments[route][language] === rawSlug
  );

  return {
    language,
    route: matchingRoute ?? 'home'
  };
}
