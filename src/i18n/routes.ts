import { Language } from './translations';

export type AppRoute = 'home' | 'howItWorks' | 'services' | 'login' | 'signup';

const routeSegments: Record<Exclude<AppRoute, 'home'>, Record<Language, string>> = {
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

export function getPathForRoute(language: Language, route: AppRoute) {
  if (route === 'home') {
    return `/${language}`;
  }

  return `/${language}/${routeSegments[route][language]}`;
}

export function getLocalizedSectionPath(language: Language, sectionId: string) {
  return `${getPathForRoute(language, 'home')}#${sectionId}`;
}

export function resolveRoute(pathname: string): { language: Language; route: AppRoute } {
  const [, rawLanguage, rawSlug] = pathname.split('/');
  const language: Language = rawLanguage === 'en' || rawLanguage === 'es' ? rawLanguage : 'fr';

  if (!rawSlug) {
    return { language, route: 'home' };
  }

  const matchingRoute = (Object.keys(routeSegments) as Array<Exclude<AppRoute, 'home'>>).find(
    (route) => routeSegments[route][language] === rawSlug
  );

  return {
    language,
    route: matchingRoute ?? 'home'
  };
}
