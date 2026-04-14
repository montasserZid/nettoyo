import type { Language } from '../i18n/translations';
import { getPathForRoute } from '../i18n/routes';
import type { PublicSeoRoute } from './metadata';

const BASE_URL = 'https://nettoyo.ca';
const SEO_LOCALES: Language[] = ['fr', 'en', 'es'];

const ROUTE_KEY_BY_SEO_ROUTE: Record<PublicSeoRoute, 'home' | 'howItWorks' | 'services' | 'login' | 'signup'> = {
  home: 'home',
  howItWorks: 'howItWorks',
  services: 'services',
  login: 'login',
  signup: 'signup'
};

export interface HreflangLink {
  locale: string;
  url: string;
}

export function getHreflangAlternates(route: PublicSeoRoute): HreflangLink[] {
  const appRoute = ROUTE_KEY_BY_SEO_ROUTE[route];
  return SEO_LOCALES.map((locale) => ({
    locale,
    url: `${BASE_URL}${getPathForRoute(locale, appRoute)}`
  }));
}
