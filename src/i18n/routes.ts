import { Language } from './translations';

export type AppRoute =
  | 'home'
  | 'howItWorks'
  | 'services'
  | 'login'
  | 'signup'
  | 'authCallback'
  | 'clientDashboard'
  | 'cleanerDashboard';

const localizedRouteSegments: Record<
  Exclude<AppRoute, 'home' | 'authCallback' | 'clientDashboard' | 'cleanerDashboard'>,
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
  }
};

const staticRoutePaths: Record<Extract<AppRoute, 'authCallback' | 'clientDashboard' | 'cleanerDashboard'>, string> = {
  authCallback: '/auth/callback',
  clientDashboard: '/dashboard/client',
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
    [Extract<AppRoute, 'authCallback' | 'clientDashboard' | 'cleanerDashboard'>, string]
  >).find(([, value]) => value === pathname);

  if (staticMatch) {
    const savedLanguage = localStorage.getItem('language');
    const language: Language = savedLanguage === 'en' || savedLanguage === 'es' ? savedLanguage : 'fr';
    return { language, route: staticMatch[0] };
  }

  const [, rawLanguage, rawSlug] = pathname.split('/');
  const language: Language = rawLanguage === 'en' || rawLanguage === 'es' ? rawLanguage : 'fr';

  if (!rawSlug) {
    return { language, route: 'home' };
  }

  const matchingRoute = (
    Object.keys(localizedRouteSegments) as Array<
      Exclude<AppRoute, 'home' | 'authCallback' | 'clientDashboard' | 'cleanerDashboard'>
    >
  ).find(
    (route) => localizedRouteSegments[route][language] === rawSlug
  );

  return {
    language,
    route: matchingRoute ?? 'home'
  };
}
