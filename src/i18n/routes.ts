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
  | 'clientReservation'
  | 'cleanerDashboard';

const localizedRouteSegments: Record<
  Exclude<AppRoute, 'home' | 'authCallback' | 'cleanerDashboard'>,
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
  }
};

const staticRoutePaths: Record<Extract<AppRoute, 'authCallback' | 'cleanerDashboard'>, string> = {
  authCallback: '/auth/callback',
  cleanerDashboard: '/dashboard/nettoyeur'
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
    [Extract<AppRoute, 'authCallback' | 'cleanerDashboard'>, string]
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
      Exclude<AppRoute, 'home' | 'authCallback' | 'cleanerDashboard'>
    >
  ).find(
    (route) => localizedRouteSegments[route][language] === rawSlug
  );

  return {
    language,
    route: matchingRoute ?? 'home'
  };
}
